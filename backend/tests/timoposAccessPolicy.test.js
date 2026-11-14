'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {isBusinessOpen,evaluateSalesAccess,canStartShift,shouldLockAfterShift,classifyDevices}=require('../src/modules/timopos/TimoPosAccessPolicy');
const schedule={timeZone:'Asia/Tomsk',days:Object.fromEntries([0,1,2,3,4,5,6].map(d=>[String(d),[{from:'08:00',to:'18:00'}]]))};
const local=(hour,minute=0)=>new Date(Date.UTC(2026,10,16,hour-7,minute));
const seller={id:'ivanov',authenticated:true,status:'ACTIVE',allowedForPoint:true};
const terminal={id:'POS-001',active:true,boundToPoint:true};
const shift={status:'OPEN',sellerId:'ivanov',terminalId:'POS-001',startedBySeller:true};
const session={active:true,sellerId:'ivanov',terminalId:'POS-001',revokedAt:null};
const devices=[{type:'PAYMENT_CHANNEL',expected:true,status:'READY'},{type:'PRINTER',expected:true,status:'READY'}];
const context=(now)=>({now,schedule,seller,terminal,shift,session,devices});
test('business hours 08:00 inclusive and 18:00 exclusive',()=>{
 assert.equal(isBusinessOpen({now:local(7,59),schedule}),false);
 assert.equal(isBusinessOpen({now:local(8),schedule}),true);
 assert.equal(isBusinessOpen({now:local(17,59),schedule}),true);
 assert.equal(isBusinessOpen({now:local(18),schedule}),false);
});
test('signed-in seller can view before opening but cannot sell/start shift',()=>{
 const ctx=context(local(7,59)),result=evaluateSalesAccess(ctx);
 assert.equal(result.canView,true);assert.equal(result.canSell,false);
 assert.deepEqual(result.reasons,['OUTSIDE_BUSINESS_HOURS']);
 assert.equal(canStartShift({...ctx,shift:{status:'CLOSED'}}),false);
});
test('shift start during business hours if not yet open',()=>{
 assert.equal(canStartShift({...context(local(8)),shift:null}),true);
 assert.equal(canStartShift(context(local(8))),false);
});
test('open shift alone is insufficient after 18:00',()=>{
 const result=evaluateSalesAccess(context(local(18)));
 assert.equal(result.canSell,false);assert.ok(result.reasons.includes('OUTSIDE_BUSINESS_HOURS'));
});
test('only correct seller/terminal may sell with open shift',()=>{
 assert.equal(evaluateSalesAccess(context(local(12))).canSell,true);
 assert.equal(evaluateSalesAccess({...context(local(12)),shift:{...shift,sellerId:'other'}}).canSell,false);
 assert.equal(evaluateSalesAccess({...context(local(12)),seller:{...seller,allowedForPoint:false}}).canSell,false);
});
test('printer out-of-paper warns, but payment may proceed only if fiscal policy allows',()=>{
 const result=evaluateSalesAccess({...context(local(12)),devices:[{type:'PRINTER',expected:true,status:'PAPER_OUT'},devices[0]]});
 assert.equal(result.canSell,true);
 assert.deepEqual(result.deviceHealth.problems,[{code:'DEVICE_NOT_READY',type:'PRINTER',status:'PAPER_OUT',severity:'WARNING'}]);
});
test('backend or payment communications missing block sales',()=>{
 const result=evaluateSalesAccess({...context(local(12)),devices:[{type:'BACKEND',expected:true,status:'OFFLINE'}]});
 assert.equal(result.canSell,false);assert.ok(result.reasons.includes('CRITICAL_DEVICE_UNAVAILABLE'));
});
test('expected unavailable equipment is reported; optional devices ignored',()=>{
 const result=classifyDevices([{type:'SCANNER',expected:true,status:'MISSING'},{type:'PRINTER',expected:false,status:'MISSING'}]);
 assert.equal(result.ready,true);assert.equal(result.problems.length,1);
 assert.equal(result.problems[0].code,'DEVICE_MISSING');
});
test('unknown devices inventory blocks sales',()=>{
 const result=evaluateSalesAccess({...context(local(12)),devices:undefined});
 assert.equal(result.canSell,false);
});
test('automatic server lock after closing shift in 30 seconds',()=>{
 const closed={status:'CLOSED',closedAt:new Date('2026-11-16T11:00:00Z')};
 assert.equal(shouldLockAfterShift({now:new Date('2026-11-16T11:00:29.999Z'),shift:closed}),false);
 assert.equal(shouldLockAfterShift({now:new Date('2026-11-16T11:00:30Z'),shift:closed}),true);
 assert.equal(shouldLockAfterShift({now:new Date('2026-11-16T11:01:00Z'),shift:{...closed,status:'OPEN'}}),false);
});
test('missing schedule fails closed',()=>{
 assert.equal(evaluateSalesAccess({...context(local(12)),schedule:null}).canSell,false);
 assert.equal(isBusinessOpen({now:local(12),schedule:{timeZone:'Asia/Tomsk',days:{1:[{from:'18:00',to:'08:00'}]}}}),false);
});

test('round-the-clock operating mode allows 23:59, midnight and 00:01',()=>{
 const roundTheClock={timeZone:'Asia/Tomsk',mode:'24_7',days:{}};
 for(const time of [local(0),local(0,1),local(12),local(23,59)]) {
  assert.equal(isBusinessOpen({now:time,schedule:roundTheClock}),true);
  assert.equal(evaluateSalesAccess({...context(time),schedule:roundTheClock}).canSell,true);
 }
});
test('00:00-00:01 scheduled mode is exactly one minute, not 24 hours',()=>{
 const oneMinute={timeZone:'Asia/Tomsk',mode:'SCHEDULED',days:{'1':[{from:'00:00',to:'00:01'}]}};
 assert.equal(isBusinessOpen({now:local(0),schedule:oneMinute}),true);
 assert.equal(isBusinessOpen({now:local(0,1),schedule:oneMinute}),false);
 assert.equal(isBusinessOpen({now:local(12),schedule:oneMinute}),false);
});
test('closed session denies sales despite an open shift and a 24/7 point',()=>{
 const roundTheClock={timeZone:'Asia/Tomsk',mode:'24_7',days:{}};
 const ctx={...context(local(12)),schedule:roundTheClock,session:{...session,active:false,revokedAt:new Date()}};
 const result=evaluateSalesAccess(ctx);
 assert.equal(result.canSell,false);
 assert.ok(result.reasons.includes('SESSION_NOT_ACTIVE'));
 assert.equal(canStartShift({...ctx,shift:null}),false);
});
test('a shift must be explicitly started by the seller',()=>{
 const ctx={...context(local(12)),shift:{...shift,startedBySeller:false}};
 assert.equal(evaluateSalesAccess(ctx).canSell,false);
 assert.ok(evaluateSalesAccess(ctx).reasons.includes('SHIFT_NOT_OPEN'));
});
test('fresh authorization is necessary after shift close; seller cannot reuse old session',()=>{
 const ctx=context(local(12));
 assert.equal(evaluateSalesAccess({...ctx,shift:{...shift,status:'CLOSED'},session:{...session,active:false,revokedAt:new Date()}}).canSell,false);
 assert.equal(evaluateSalesAccess({...ctx,session:{...session,active:false,revokedAt:new Date()}}).canSell,false);
 assert.equal(evaluateSalesAccess({...ctx,shift:null}).canSell,false);
});
test('invalid all-day timezone and unsupported mode fail closed',()=>{
 assert.equal(isBusinessOpen({now:local(12),schedule:{timeZone:'Fake/Zone',mode:'24_7',days:{}}}),false);
 assert.equal(isBusinessOpen({now:local(12),schedule:{timeZone:'Asia/Tomsk',mode:'UNKNOWN',days:{}}}),false);
});
