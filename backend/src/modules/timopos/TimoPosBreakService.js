'use strict';

function breakError(code) {
  return Object.assign(new Error('Операция технологического перерыва недоступна.'), {code});
}

/**
 * Repository methods are server-side atomic transactions, enforcing a single
 * active break per shift, ACTIVE seller session, and point/terminal ownership.
 * Clock is server-sourced. Never trust client-provided timestamps.
 *
 * A shift may close during a break. The close transaction MUST complete the
 * active break at shift.closedAt, revoke all seller sessions, and close shift.
 */
class TimoPosBreakService {
  constructor({repository, clock=()=>new Date()}={}) {
    if (!repository || typeof repository.startBreakAtomic !== 'function' ||
        typeof repository.endBreakAtomic !== 'function') throw new Error('break repository required');
    this.repository=repository; this.clock=clock;
  }
  ensureContext({session,seller,terminal,requestedBySeller}) {
    if(requestedBySeller !== true)throw breakError('EXPLICIT_CONFIRMATION_REQUIRED');
    if(!session?.active || session.revokedAt || session.sellerId !== seller?.id ||
       session.terminalId !== terminal?.id || !terminal?.pointId ||
       !seller?.authenticated || seller.status !== 'ACTIVE' || !seller.allowedForPoint)
      throw breakError('AUTH_REQUIRED');
    return {
      sellerId:seller.id, terminalId:terminal.id, pointId:terminal.pointId,
      sessionTokenHash:session.tokenHash,
    };
  }
  async start(args) {
    const context=this.ensureContext(args);
    const event=await this.repository.startBreakAtomic({...context, startedAt:this.clock(), reason:'TECHNICAL'});
    if(!event || event.status!=='ACTIVE')throw breakError('BREAK_NOT_CONFIRMED');
    return {breakId:event.id,shiftId:event.shiftId,status:'ACTIVE',
      startedAt:new Date(event.startedAt).toISOString(), salesBlocked:true};
  }
  async finish(args) {
    const context=this.ensureContext(args);
    const event=await this.repository.endBreakAtomic({...context, endedAt:this.clock()});
    if(!event || event.status!=='ENDED')throw breakError('BREAK_END_NOT_CONFIRMED');
    const ms=new Date(event.endedAt).getTime()-new Date(event.startedAt).getTime();
    if(!Number.isFinite(ms) || ms<0)throw breakError('INVALID_BREAK_DURATION');
    return {breakId:event.id,shiftId:event.shiftId,status:'ENDED',
      endedAt:new Date(event.endedAt).toISOString(),durationSeconds:Math.floor(ms/1000)};
  }
}

function summarizeShiftTime({shiftStartedAt,shiftClosedAt,breaks}) {
  const start=new Date(shiftStartedAt).getTime(),end=new Date(shiftClosedAt).getTime();
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||!Array.isArray(breaks))
    throw breakError('INVALID_SHIFT_INTERVAL');
  let pauseMs=0;
  const intervals=breaks.map(b=>({
    start:new Date(b.startedAt).getTime(),end:new Date(b.endedAt).getTime(),
  })).sort((a,b)=>a.start-b.start);
  let previous=start;
  for(const b of intervals){
    if(!Number.isFinite(b.start)||!Number.isFinite(b.end)||
      b.start<start||b.end>end||b.end<b.start||b.start<previous)
      throw breakError('INVALID_BREAK_INTERVAL');
    pauseMs+=b.end-b.start;previous=b.end;
  }
  return {shiftSeconds:Math.floor((end-start)/1000),breakSeconds:Math.floor(pauseMs/1000),
    operationalSeconds:Math.floor((end-start-pauseMs)/1000)};
}
module.exports={TimoPosBreakService,summarizeShiftTime};
