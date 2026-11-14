'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {SYNC_INTERVAL_MS,evaluateClockSample,needsClockSync,evaluateClockHealth}
  =require('../src/modules/timopos/TimoPosClockPolicy');

test('synchronization due at startup and every two hours',()=>{
 const start=Date.UTC(2026,10,16,0,0,0);
 assert.equal(SYNC_INTERVAL_MS,7200000);
 assert.equal(needsClockSync({nowEpochMs:start,lastSyncEpochMs:null}),true);
 assert.equal(needsClockSync({nowEpochMs:start+7199999,lastSyncEpochMs:start}),false);
 assert.equal(needsClockSync({nowEpochMs:start+7200000,lastSyncEpochMs:start}),true);
});
test('server sample compensates request round trip and reports skew',()=>{
 const base=Date.UTC(2026,10,16);
 const sample=evaluateClockSample({
  serverEpochMs:base+115,clientSentEpochMs:base,clientReceivedEpochMs:base+200,
  monotonicSentMs:500,monotonicReceivedMs:700
 });
 assert.equal(sample.status,'OK');assert.equal(sample.offsetMs,15);
 assert.equal(sample.rttMs,200);assert.equal(sample.uncertaintyMs,100);
});
test('warning and critical clock drift classification',()=>{
 const input={clientSentEpochMs:100000,clientReceivedEpochMs:100100,
 monotonicSentMs:1000,monotonicReceivedMs:1100};
 assert.equal(evaluateClockSample({...input,serverEpochMs:102300}).status,'WARNING');
 assert.equal(evaluateClockSample({...input,serverEpochMs:140050}).status,'CRITICAL');
});
test('unreliable latency, clock step and malformed values are not accepted',()=>{
 const input={serverEpochMs:1000,clientSentEpochMs:900,clientReceivedEpochMs:1500,
 monotonicSentMs:100,monotonicReceivedMs:200};
 assert.equal(evaluateClockSample(input).status,'ERROR');
 assert.equal(evaluateClockSample({...input,clientReceivedEpochMs:900,monotonicReceivedMs:9000}).status,'ERROR');
 assert.equal(evaluateClockSample({...input,serverEpochMs:NaN}).status,'ERROR');
});
test('status stale if two hour check was skipped; clock jumping backwards requires check',()=>{
 const start=Date.UTC(2026,10,16);
 const sample={status:'OK',offsetMs:30,uncertaintyMs:5,rttMs:10};
 assert.equal(evaluateClockHealth({nowEpochMs:start+7200000,lastSyncEpochMs:start,lastSample:sample}).status,'STALE');
 assert.equal(evaluateClockHealth({nowEpochMs:start-1,lastSyncEpochMs:start,lastSample:sample}).status,'STALE');
 assert.equal(evaluateClockHealth({nowEpochMs:start+500,lastSyncEpochMs:start,lastSample:sample}).status,'OK');
});
