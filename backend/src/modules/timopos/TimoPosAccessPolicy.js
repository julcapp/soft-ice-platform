'use strict';

/** Pure, fail-closed POS policy. Time must come from backend, not browser.
 * schedule: {timeZone:'Asia/Tomsk', mode:'SCHEDULED', days:{'1':[{from:'08:00',to:'18:00'}],...}}
 * or {timeZone:'Asia/Tomsk', mode:'24_7', days:{}} for all-day operation.
 * 00:00-00:01 is a real one-minute interval, never a 24-hour shortcut.
 * Weekday: 0 Sun .. 6 Sat. Intervals are [from, to), end exclusive.
 * Overnight intervals must be configured as two weekday segments.
 */
const DTF_CACHE = new Map();
function dateParts(now, timeZone) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw Error('INVALID_CLOCK');
  if (!timeZone) throw Error('TIMEZONE_REQUIRED');
  if (!DTF_CACHE.has(timeZone)) DTF_CACHE.set(timeZone,
    new Intl.DateTimeFormat('en-US', {timeZone, hourCycle:'h23',
      weekday:'short',hour:'2-digit',minute:'2-digit'}));
  const parts = Object.fromEntries(DTF_CACHE.get(timeZone).formatToParts(now).map(x=>[x.type,x.value]));
  return {day:{Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[parts.weekday],
    minute:Number(parts.hour)*60+Number(parts.minute)};
}
function parseTime(s) {
  if (typeof s!=='string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw Error('INVALID_SCHEDULE');
  const [h,m]=s.split(':').map(Number);
  return h*60+m;
}
function isBusinessOpen({now,schedule}) {
  if (!schedule || !schedule.timeZone || !schedule.days || typeof schedule.days!=='object') return false;
  try {
    const {day,minute}=dateParts(now,schedule.timeZone);
    if (schedule.mode === '24_7') return true;
    if (schedule.mode && schedule.mode !== 'SCHEDULED') return false;
    const slots=schedule.days[String(day)];
    if (!Array.isArray(slots)) return false;
    return slots.some(slot=>{
      const from=parseTime(slot.from), to=parseTime(slot.to);
      if (from>=to) return false; // overnight explicitly split; fail closed
      return minute>=from && minute<to;
    });
  } catch {return false;}
}
const CRITICAL=new Set(['PAYMENT_CHANNEL','BACKEND','POS_CORE']);
const DEGRADED=new Set(['PRINTER','SCANNER','COFFEE_MACHINE','ICE_CREAM_FREEZER']);
function classifyDevices(devices) {
  if (!Array.isArray(devices)) return {ready:false,problems:[{code:'DEVICE_INVENTORY_UNKNOWN',severity:'BLOCK'}]};
  const problems=[];
  for(const device of devices) {
    if(!device?.expected)continue;
    const name=String(device.type||'UNKNOWN').toUpperCase();
    const status=String(device.status||'UNKNOWN').toUpperCase();
    if(status==='READY')continue;
    let severity=CRITICAL.has(name)?'BLOCK':'WARNING';
    if(!CRITICAL.has(name)&&!DEGRADED.has(name))severity='WARNING';
    problems.push({code:status==='MISSING'?'DEVICE_MISSING':'DEVICE_NOT_READY',type:name,status,severity});
  }
  return {ready:!problems.some(p=>p.severity==='BLOCK'),problems};
}
function evaluateSalesAccess({now=new Date(),schedule,seller,terminal,shift,session,devices}) {
  const reasons=[];
  if(!seller?.authenticated||seller.status!=='ACTIVE'||!seller.allowedForPoint)reasons.push('SELLER_NOT_AUTHORIZED');
  if(!session?.active || session.revokedAt || !session.sellerId || session.sellerId!==seller?.id || session.terminalId!==terminal?.id)reasons.push('SESSION_NOT_ACTIVE');
  if(!terminal?.active||!terminal.boundToPoint)reasons.push('TERMINAL_NOT_ASSIGNED');
  if(!isBusinessOpen({now,schedule}))reasons.push('OUTSIDE_BUSINESS_HOURS');
  if(!shift||shift.status!=='OPEN'||shift.sellerId!==seller?.id||shift.terminalId!==terminal?.id||!shift.startedBySeller)reasons.push('SHIFT_NOT_OPEN');
  const deviceHealth=classifyDevices(devices);
  if(!deviceHealth.ready)reasons.push('CRITICAL_DEVICE_UNAVAILABLE');
  return {canView:!!seller?.authenticated,canSell:reasons.length===0,
    canAcceptPayment:reasons.length===0,reasons,deviceHealth};
}
function canStartShift({now=new Date(),schedule,seller,terminal,shift,session}) {
  return !!seller?.authenticated&&seller.status==='ACTIVE'&&seller.allowedForPoint&&
    !!session?.active&&!session.revokedAt&&session.sellerId===seller?.id&&session.terminalId===terminal?.id&&
    !!terminal?.active&&terminal.boundToPoint&&isBusinessOpen({now,schedule})&&shift?.status!=='OPEN';
}
// UI grace period only: server-side seller session must be revoked immediately.
function shouldLockAfterShift({now=new Date(),shift,delayMs=30000}) {
  return !!shift&&shift.status==='CLOSED'&&!!shift.closedAt&&
    now.getTime()>=new Date(shift.closedAt).getTime()+delayMs;
}
module.exports={isBusinessOpen,classifyDevices,evaluateSalesAccess,canStartShift,shouldLockAfterShift};
