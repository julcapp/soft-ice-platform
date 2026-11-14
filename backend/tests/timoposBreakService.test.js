'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {TimoPosBreakService,summarizeShiftTime}=require('../src/modules/timopos/TimoPosBreakService');
const {evaluateSalesAccess}=require('../src/modules/timopos/TimoPosAccessPolicy');
const seller={id:'s1',authenticated:true,status:'ACTIVE',allowedForPoint:true};
const terminal={id:'POS1',pointId:'p1',active:true,boundToPoint:true};
const session={sellerId:'s1',terminalId:'POS1',active:true,tokenHash:'h',revokedAt:null};
const schedule={timeZone:'Asia/Tomsk',mode:'24_7',days:{}};
const devices=[{expected:true,type:'BACKEND',status:'READY'}];
const begin=new Date('2026-11-14T12:00:00Z');
function fixture(){
 let now=begin,active=null,events=[];
 const repository={
   async startBreakAtomic(data){
     if(active)throw Error('BREAK_ALREADY_ACTIVE');
     active={id:'b'+(events.length+1),shiftId:'shift1',status:'ACTIVE',startedAt:data.startedAt};
     return active;
   },
   async endBreakAtomic(data){
     if(!active)throw Error('NO_ACTIVE_BREAK');
     const result={...active,status:'ENDED',endedAt:data.endedAt};
     events.push(result);active=null;return result;
   }
 };
 const service=new TimoPosBreakService({repository,clock:()=>now});
 return {service,setNow:d=>{now=new Date(d)},active:()=>active,events:()=>events};
}
test('break requires physical tap and authenticated seller',async()=>{
 const f=fixture(),args={session,seller,terminal};
 await assert.rejects(f.service.start(args),{code:'EXPLICIT_CONFIRMATION_REQUIRED'});
 await assert.rejects(f.service.start({...args,requestedBySeller:true,session:{...session,active:false}}),{code:'AUTH_REQUIRED'});
 assert.equal(f.active(),null);
});
test('break starts, blocks sales and ends without closing shift',async()=>{
 const f=fixture(),args={session,seller,terminal,requestedBySeller:true};
 const started=await f.service.start(args);
 assert.equal(started.status,'ACTIVE');assert.equal(started.salesBlocked,true);
 const base={now:begin,schedule,seller,terminal,session,devices,
   shift:{status:'OPEN',sellerId:'s1',terminalId:'POS1',startedBySeller:true,breakStatus:'ACTIVE'}};
 const result=evaluateSalesAccess(base);
 assert.equal(result.canSell,false);assert.equal(result.canAcceptPayment,false);
 assert.ok(result.reasons.includes('TECHNICAL_BREAK_ACTIVE'));
 f.setNow('2026-11-14T12:10:30Z');
 const ended=await f.service.finish(args);
 assert.equal(ended.durationSeconds,630);
 assert.equal(evaluateSalesAccess({...base,shift:{...base.shift,breakStatus:'ENDED'}}).canSell,true);
});
test('no overlapping active break and cannot finish without break',async()=>{
 const f=fixture(),args={session,seller,terminal,requestedBySeller:true};
 await assert.rejects(f.service.finish(args),/NO_ACTIVE_BREAK/);
 await f.service.start(args);
 await assert.rejects(f.service.start(args),/BREAK_ALREADY_ACTIVE/);
});
test('wrong seller, wrong terminal or revoked session cannot finish break',async()=>{
 const f=fixture(),args={session,seller,terminal,requestedBySeller:true};
 await f.service.start(args);
 await assert.rejects(f.service.finish({...args,seller:{...seller,id:'another'}}),{code:'AUTH_REQUIRED'});
 await assert.rejects(f.service.finish({...args,terminal:{...terminal,id:'POS2'}}),{code:'AUTH_REQUIRED'});
 await assert.rejects(f.service.finish({...args,session:{...session,revokedAt:begin}}),{code:'AUTH_REQUIRED'});
});
test('gross shift, break and operational time are counted separately',()=>{
 const result=summarizeShiftTime({
  shiftStartedAt:'2026-11-14T08:00:00Z',shiftClosedAt:'2026-11-14T16:00:00Z',
  breaks:[{startedAt:'2026-11-14T10:00:00Z',endedAt:'2026-11-14T10:15:00Z'},
  {startedAt:'2026-11-14T13:20:00Z',endedAt:'2026-11-14T13:30:00Z'}]
 });
 assert.deepEqual(result,{shiftSeconds:28800,breakSeconds:1500,operationalSeconds:27300});
});
test('overlapping breaks or breaks outside shift are rejected',()=>{
 const args={shiftStartedAt:'2026-11-14T08:00:00Z',shiftClosedAt:'2026-11-14T16:00:00Z'};
 assert.throws(()=>summarizeShiftTime({...args,breaks:[
  {startedAt:'2026-11-14T10:00:00Z',endedAt:'2026-11-14T10:30:00Z'},
  {startedAt:'2026-11-14T10:20:00Z',endedAt:'2026-11-14T10:40:00Z'}]}),{code:'INVALID_BREAK_INTERVAL'});
 assert.throws(()=>summarizeShiftTime({...args,breaks:[
  {startedAt:'2026-11-14T07:00:00Z',endedAt:'2026-11-14T08:10:00Z'}]}),{code:'INVALID_BREAK_INTERVAL'});
});
