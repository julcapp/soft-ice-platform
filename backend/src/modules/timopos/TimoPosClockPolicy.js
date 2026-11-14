'use strict';

/**
 * TimoPOS clock alignment telemetry (not an OS clock setter).
 * Trusted backend endpoint must return its UTC Unix milliseconds over HTTPS
 * with Cache-Control: no-store and authenticate the terminal.
 * Agent supplies monotonic timestamps for RTT measurement and wall times
 * captured at the same instants; a system clock jump between measurements
 * invalidates the sample.
 *
 * The server is the sole authority for sale/shift permission.
 */
const SYNC_INTERVAL_MS=2*60*60*1000;
const WARNING_SKEW_MS=2000;
const BLOCK_SKEW_MS=30000;
const MAX_RTT_MS=5000;

function evaluateClockSample({serverEpochMs,clientSentEpochMs,clientReceivedEpochMs,
  monotonicSentMs,monotonicReceivedMs}){
 const values=[serverEpochMs,clientSentEpochMs,clientReceivedEpochMs,monotonicSentMs,monotonicReceivedMs];
 if(!values.every(Number.isFinite))return {status:'ERROR',reason:'INVALID_SAMPLE'};
 const rtt=monotonicReceivedMs-monotonicSentMs;
 const wallElapsed=clientReceivedEpochMs-clientSentEpochMs;
 if(rtt<0||rtt>MAX_RTT_MS || Math.abs(wallElapsed-rtt)>1000)
   return {status:'ERROR',reason:'UNRELIABLE_SAMPLE',rttMs:rtt};
 const midpoint=clientSentEpochMs+wallElapsed/2;
 const offsetMs=serverEpochMs-midpoint;
 const abs=Math.abs(offsetMs);
 return {
  status:abs>BLOCK_SKEW_MS?'CRITICAL':abs>WARNING_SKEW_MS?'WARNING':'OK',
  offsetMs,rttMs:rtt,uncertaintyMs:rtt/2,
  observedAt:new Date(clientReceivedEpochMs).toISOString()
 };
}
function needsClockSync({nowEpochMs,lastSyncEpochMs,intervalMs=SYNC_INTERVAL_MS}){
 if(!Number.isFinite(nowEpochMs))return true;
 if(!Number.isFinite(lastSyncEpochMs))return true;
 return nowEpochMs<lastSyncEpochMs || nowEpochMs-lastSyncEpochMs>=intervalMs;
}
function evaluateClockHealth({nowEpochMs,lastSyncEpochMs,lastSample}) {
 if(!lastSample || lastSample.status==='ERROR')return {status:'UNKNOWN',reason:'TIME_NOT_VERIFIED'};
 if(needsClockSync({nowEpochMs,lastSyncEpochMs}))return {status:'STALE',reason:'SYNC_OVERDUE'};
 return {status:lastSample.status,offsetMs:lastSample.offsetMs,
   uncertaintyMs:lastSample.uncertaintyMs,rttMs:lastSample.rttMs};
}
module.exports={SYNC_INTERVAL_MS,WARNING_SKEW_MS,BLOCK_SKEW_MS,MAX_RTT_MS,
 evaluateClockSample,needsClockSync,evaluateClockHealth};
