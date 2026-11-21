'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildJournalEvent,TimoPosJournalService,DEFAULT_INTERVAL_MS,MAX_BATCH_SIZE}
  =require('../src/modules/timopos/TimoPosJournalService');
function input(n=1){return {terminalId:'POS-001',pointId:'P-001',bootId:'BOOT-A',sequence:n,
 eventType:'GOODS_RECEIVED',actorId:'seller-1',payload:{quantity:50,phone:'+79991234567',otp:'123456',sku:'CUP'}}}
test('every event is numbered with boot ID and no customer private data',()=>{
 const e=buildJournalEvent(input());
 assert.equal(e.sequence,1);assert.equal(e.bootId,'BOOT-A');assert.equal(e.payload.quantity,50);
 assert.ok(!('phone' in e.payload));assert.ok(!('otp' in e.payload));
});
test('unknown event types and invalid identity fail closed',()=>{
 assert.throws(()=>buildJournalEvent({...input(),eventType:'FREE_TEXT'}),{code:'UNKNOWN_EVENT_TYPE'});
 assert.throws(()=>buildJournalEvent({...input(),sequence:0}),{code:'INVALID_EVENT_IDENTITY'});
});
test('requires durable append before reporting an event ID',async()=>{
 let saved=false;
 const service=new TimoPosJournalService({
 outbox:{async appendDurable(){saved=true;},async readPending(){return []}},
 transport:{async postBatch(){return {acknowledgedEventIds:[]}}}});
 const id=await service.record(input());
 assert.ok(id);assert.equal(saved,true);
});
test('partial server ack does not remove unacknowledged journal events',async()=>{
 const events=[buildJournalEvent(input(1)),buildJournalEvent(input(2)),buildJournalEvent(input(3))];
 let acked=[];
 const service=new TimoPosJournalService({outbox:{
 async readPending(){return events.filter(e=>!acked.includes(e.eventId));},
 async markAcknowledgedDurable({eventIds}){acked.push(...eventIds);}
 },transport:{async postBatch({events:e}){return {acknowledgedEventIds:[e[0].eventId,'foreign-event']}}}});
 const first=await service.sync({terminalId:'POS-001'});
 assert.deepEqual(first,{sent:3,acknowledged:1});assert.equal(acked.length,1);
 const second=await service.sync({terminalId:'POS-001'});
 assert.deepEqual(second,{sent:2,acknowledged:1});assert.equal(acked.length,2);
});
test('network error never acknowledges events',async()=>{
 let acked=false;
 const service=new TimoPosJournalService({outbox:{
 async readPending(){return [buildJournalEvent(input())]},
 async markAcknowledgedDurable(){acked=true;}
 },transport:{async postBatch(){throw Error('offline')}}});
 await assert.rejects(service.sync({terminalId:'POS-001'}),/offline/);
 assert.equal(acked,false);
});
test('journal flush interval and batch limit',()=>{
 assert.equal(DEFAULT_INTERVAL_MS,300000);assert.equal(MAX_BATCH_SIZE,100);
});
