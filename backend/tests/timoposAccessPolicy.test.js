'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {isBusinessOpen,evaluateSalesAccess,canStartShift,shouldLockAfterShift,classifyDevices}=require('../src/modules/timopos/TimoPosAccessPolicy');
const schedule={timeZone:'Asia/Tomsk',days:Object.fromEntries([0,1,2,3,4,5,6].map(d=>[String(d),[{from:'08:00',to:'18:00'}]]))};
const local=(hour,minute=0)=>new Date(Date.UTC(2026,10,16,hour-7,minute));
const seller={id:'ivanov',authenticated:true,status:'ACTIVE',allowedForPoint:true};
const terminal={id:'POS-001',active:true,boundToPoint:true};
const shift={status:'OPEN',sellerId:'ivanov',terminalId:'POS-001'};
const devices=[{type:'PAYMENT_CHANNEL',expected:true,status:'READY'},{type:'PRINTER',expected:true,status:'READY'}];
const context=(now)=>({now,schedule,seller,terminal,shift,devices});
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
