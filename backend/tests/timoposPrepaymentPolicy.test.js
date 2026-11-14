'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {PICKUP_WINDOW_MS,STATES,prepaidPaid,pickupDecision,
expiredOrderDecision,ingredientConsumption,TimoPosPrepaymentService}
=require('../src/modules/timopos/TimoPosPrepaymentPolicy');
function paid(){return prepaidPaid({orderId:'o1',customerId:'c1',paymentId:'p1',
amountKopecks:9500,paymentVerified:true,paidAt:'2026-11-14T10:00:00Z'})}
test('prepaid order opens exactly 48-hour pickup window',()=>{
 const o=paid();assert.equal(PICKUP_WINDOW_MS,172800000);
 assert.equal(o.status,STATES.PICKUP_AVAILABLE);
 assert.equal(o.pickupUntil,'2026-11-16T10:00:00.000Z');
});
test('prior prepaid handover is not new point revenue',()=>{
 const o=paid();
 const result=pickupDecision({order:o,at:'2026-11-15T12:00:00Z',
 issueConfirmed:true,paymentVerified:true});
 assert.equal(result.status,STATES.ISSUED);
 assert.equal(result.pointRevenueKopecks,0);
 assert.equal(result.goodsIssuedValueKopecks,9500);
});
test('physical portion accounting 8 liters / 50 = 160 ml, after one: 49 equivalent portions',()=>{
 const m=ingredientConsumption({batchLiters:8,plannedPortions:50,issuedPortions:1});
 assert.deepEqual(m,{batchMilliliters:8000,recipeMillilitersPerPortion:160,
 issuedPortions:1,consumedMilliliters:160,remainingMilliliters:7840,
 theoreticalRemainingPortions:49});
});
test('48h expiry credits balance obligation, never revenue or physical consumption',()=>{
 const o=paid();
 const result=expiredOrderDecision({order:o,at:o.pickupUntil});
 assert.deepEqual(result,{type:'CREDIT_CUSTOMER_PREPAYMENT',orderId:'o1',
 customerId:'c1',liabilityCreditKopecks:9500,pointRevenueKopecks:0,
 stockDelta:0,status:STATES.BALANCE_CREDITED});
});
test('before expiration cannot credit cash balance',()=>{
 const o=paid();
 assert.throws(()=>expiredOrderDecision({order:o,at:'2026-11-16T09:59:59.999Z'}),{code:'NOT_EXPIRED'});
});
test('pickup exactly at expiry is forbidden and resolved through liability policy',()=>{
 const o=paid();assert.throws(()=>pickupDecision({order:o,at:o.pickupUntil,
 issueConfirmed:true,paymentVerified:true}),{code:'PICKUP_WINDOW_ENDED'});
});
test('unverified payment and no handover never issue product',()=>{
 const o=paid();assert.throws(()=>pickupDecision({order:o,at:o.paidAt,
 issueConfirmed:false,paymentVerified:true}),{code:'HANDOVER_NOT_CONFIRMED'});
 assert.throws(()=>pickupDecision({order:o,at:o.paidAt,
 issueConfirmed:true,paymentVerified:false}),{code:'PICKUP_NOT_AVAILABLE'});
});
test('issued or balance-credited orders cannot expire twice or issue twice',()=>{
 const o=paid();for(const status of [STATES.ISSUED,STATES.BALANCE_CREDITED,STATES.REFUNDED]){
 assert.throws(()=>expiredOrderDecision({order:{...o,status},at:'2026-11-17T00:00:00Z'}),{code:'ORDER_NOT_ELIGIBLE'});
 assert.throws(()=>pickupDecision({order:{...o,status},at:o.paidAt,issueConfirmed:true,paymentVerified:true}),{code:'PICKUP_NOT_AVAILABLE'});
 }
});
test('no prepayment claim without verified payment',()=>{
 assert.throws(()=>prepaidPaid({orderId:'o',customerId:'c',paymentId:'p',
amountKopecks:9500,paymentVerified:false,paidAt:new Date()}),{code:'PAYMENT_NOT_VERIFIED'});
});
test('transaction adapters receive atomic policy and idempotency keys',async()=>{
 let issue=null,expire=null;
 const svc=new TimoPosPrepaymentService({repository:{
 async issuePrepaidAtomic(input){issue=input;return {status:'ISSUED'}},
 async creditExpiredPrepaymentAtomic(input){expire=input;return {status:'BALANCE_CREDITED'}},
 },clock:()=>new Date('2026-11-17T01:00:00Z')});
 await svc.issue({orderId:'o1',pointId:'pt1',terminalId:'terminal1',sellerId:'seller1',
 shiftId:'shift1',idempotencyKey:'issue-1'});
 await svc.expire({orderId:'o2',idempotencyKey:'credit-2'});
 assert.equal(typeof issue.policy,'function');assert.equal(typeof expire.policy,'function');
 assert.equal(issue.orderId,'o1');assert.equal(expire.orderId,'o2');
});
