'use strict';

/**
 * TimoPOS local journal command policy.
 * Device-local durable outbox is implemented by a separate agent adapter.
 * No reliance on browser localStorage. Every event has a stable eventId and
 * per-boot strictly increasing sequence; do not include OTP, phone, tokens.
 * The server receiver must dedupe (terminalId,eventId) and acknowledge only
 * durable acceptance; device deletes/marks ACKED after that response.
 */
const crypto=require('node:crypto');
const EVENT_TYPES=Object.freeze([
 'DEVICE_STARTED','DEVICE_SHUTDOWN','DEVICE_CONNECTED','DEVICE_DISCONNECTED',
 'HARDWARE_SELF_TEST','HARDWARE_WARNING','CLOCK_SYNC',
 'SELLER_LOGIN_REQUESTED','SELLER_LOGIN_SUCCEEDED','SELLER_LOGIN_FAILED','SELLER_LOGGED_OUT',
 'SHIFT_STARTED','SHIFT_CLOSED','BREAK_STARTED','BREAK_ENDED',
 'SALE_CREATED','PAYMENT_SUCCEEDED','PAYMENT_FAILED','SALE_CANCELLED',
 'PICKUP_REQUESTED','PICKUP_CONFIRMED','PICKUP_FAILED',
 'GOODS_RECEIVED','GOODS_CONSUMED','GOODS_DEFECT_WRITTEN_OFF',
 'INVENTORY_COUNT','INVENTORY_ADJUSTMENT','REFUND_CREATED',
 'JOURNAL_SYNC_REQUESTED','JOURNAL_SYNC_FAILED','JOURNAL_SYNC_COMPLETED',
 'OPERATOR_ACTION','SYSTEM_ERROR'
]);
const EVENT_SET=new Set(EVENT_TYPES);
const DEFAULT_INTERVAL_MS=5*60*1000;
const MAX_BATCH_SIZE=100;
function reject(code){return Object.assign(new Error('TimoPOS journal operation rejected'),{code})}
function sanitizePayload(payload){
 if(payload==null)return {};
 if(!payload||Array.isArray(payload)||typeof payload!=='object')throw reject('INVALID_PAYLOAD');
 const blocked=/otp|password|secret|token|session|phone|email|personName|customerName|cardNumber/i;
 const out={};
 for(const [key,val] of Object.entries(payload)){
   if(blocked.test(key))continue;
   if(['string','number','boolean'].includes(typeof val)||val===null){
     if(typeof val==='string'&&val.length>256)continue;
     out[key]=val;
   }
 }
 return out;
}
function buildJournalEvent({eventId=crypto.randomUUID(),terminalId,pointId,bootId,
 sequence,eventType,actorId=null,shiftId=null,occurredAt=new Date(),payload={}}){
 if(!EVENT_SET.has(eventType))throw reject('UNKNOWN_EVENT_TYPE');
 if(!terminalId||!pointId||!bootId||!Number.isSafeInteger(sequence)||sequence<1)
   throw reject('INVALID_EVENT_IDENTITY');
 const date=new Date(occurredAt);
 if(!Number.isFinite(date.getTime()))throw reject('INVALID_OCCURRED_AT');
 return Object.freeze({eventId,terminalId,pointId,bootId,sequence,eventType,
   actorId,shiftId,occurredAt:date.toISOString(),payload:sanitizePayload(payload)});
}
class TimoPosJournalService {
 constructor({outbox,transport,clock=()=>new Date()}={}){
  if(!outbox||!transport?.postBatch)throw Error('journal storage and transport required');
  this.outbox=outbox;this.transport=transport;this.clock=clock;
 }
 async record(input){
  const event=buildJournalEvent({...input,occurredAt:input.occurredAt||this.clock()});
  await this.outbox.appendDurable(event);return event.eventId;
 }
 async sync({terminalId}){
  const pending=await this.outbox.readPending({terminalId,limit:MAX_BATCH_SIZE});
  if(!Array.isArray(pending)||!pending.length)return {sent:0,acknowledged:0};
  // Trust only explicit acknowledgement of matching IDs, not HTTP 200 alone.
  const response=await this.transport.postBatch({terminalId,events:pending});
  const offered=new Set(pending.map(e=>e.eventId));
  const acked=[...new Set((response?.acknowledgedEventIds||[]).filter(id=>offered.has(id)))];
  if(acked.length)await this.outbox.markAcknowledgedDurable({terminalId,eventIds:acked});
  return {sent:pending.length,acknowledged:acked.length};
 }
}
module.exports={EVENT_TYPES,DEFAULT_INTERVAL_MS,MAX_BATCH_SIZE,
 buildJournalEvent,sanitizePayload,TimoPosJournalService};
