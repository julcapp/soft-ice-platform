'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {TimoPosShiftService}=require('../src/modules/timopos/TimoPosShiftService');
const now=new Date('2026-11-16T06:00:00Z');
const schedule={timeZone:'Asia/Tomsk',mode:'24_7',days:{}};
const seller={id:'seller-1',authenticated:true,status:'ACTIVE',allowedForPoint:true};
const terminal={id:'POS-001',pointId:'point-1',active:true,boundToPoint:true};
const session={active:true,sellerId:'seller-1',terminalId:'POS-001',tokenHash:'hashed',revokedAt:null};
const fixture=()=>{let shift=null,revoked=false;const repo={
 async findActiveShift(){return shift},
 async startShiftAtomic(p){shift={...p,id:'shift-1',status:'OPEN'};return shift},
 async closeShiftAndRevokeSessionsAtomic(p){
  if(!shift || shift.status!=='OPEN')return null;
  shift={...shift,status:'CLOSED',closedAt:p.closedAt};
  revoked=true;
  return {...shift,summary:{sales:0}};
 }
 };return {service:new TimoPosShiftService({repository:repo,clock:()=>now}),getShift:()=>shift,revoked:()=>revoked}};
test('seller must explicitly tap start; round-the-clock point is allowed',async()=>{
 const f=fixture(),args={session,seller,terminal,schedule};
 await assert.rejects(f.service.start(args),{code:'EXPLICIT_CONFIRMATION_REQUIRED'});
 assert.equal(f.getShift(),null);
 const result=await f.service.start({...args,requestedBySeller:true});
 assert.equal(result.status,'OPEN');assert.equal(result.startedBySeller,true);
});
test('cannot reopen active shift',async()=>{
 const f=fixture(),args={session,seller,terminal,schedule,requestedBySeller:true};
 await f.service.start(args);
 await assert.rejects(f.service.start(args),{code:'SHIFT_OPEN_NOT_ALLOWED'});
});
test('seller must explicitly close, then server session revoked immediately',async()=>{
 const f=fixture();await f.service.start({session,seller,terminal,schedule,requestedBySeller:true});
 await assert.rejects(f.service.close({session,seller,terminal}),{code:'EXPLICIT_CONFIRMATION_REQUIRED'});
 assert.equal(f.revoked(),false);
 const out=await f.service.close({session,seller,terminal,requestedBySeller:true});
 assert.equal(out.status,'CLOSED');assert.equal(out.sessionRevoked,true);
 assert.equal(f.revoked(),true);
 assert.equal(new Date(out.lockDisplayAt).getTime()-new Date(out.closedAt).getTime(),30000);
});
test('revoked session cannot close shift or start another',async()=>{
 const f=fixture(),s={...session,active:false,revokedAt:now};
 await assert.rejects(f.service.start({session:s,seller,terminal,schedule,requestedBySeller:true}),{code:'AUTH_REQUIRED'});
 await assert.rejects(f.service.close({session:s,seller,terminal,requestedBySeller:true}),{code:'AUTH_REQUIRED'});
});
test('closed shift requires new MAX auth before new shift',async()=>{
 const f=fixture(),args={session,seller,terminal,schedule,requestedBySeller:true};
 await f.service.start(args);await f.service.close({session,seller,terminal,requestedBySeller:true});
 await assert.rejects(f.service.start({...args,session:{...session,active:false,revokedAt:now}}),{code:'AUTH_REQUIRED'});
});
test('if close transaction fails the service does not falsely confirm',async()=>{
 const repo={findActiveShift:async()=>null,closeShiftAndRevokeSessionsAtomic:async()=>{throw Error('DATABASE_UNAVAILABLE')}};
 const service=new TimoPosShiftService({repository:repo,clock:()=>now});
 await assert.rejects(service.close({session,seller,terminal,requestedBySeller:true}),/DATABASE_UNAVAILABLE/);
});
