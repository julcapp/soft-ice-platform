'use strict';

// Domain rules: money amounts are integer kopecks, physical ingredients tracked
// in their native units. No transfer to bonus points and no revenue entry on
// expiry of pickup window. Every transition MUST use an atomic/idempotent DB
// transaction and verified payment identity.
const PICKUP_WINDOW_MS=48*60*60*1000;
const STATES=Object.freeze({
 AWAITING_PAYMENT:'AWAITING_PAYMENT',PICKUP_AVAILABLE:'PICKUP_AVAILABLE',
 ISSUED:'ISSUED',BALANCE_CREDITED:'BALANCE_CREDITED',REFUNDED:'REFUNDED'
});
function fail(code){return Object.assign(new Error('Предоплата: операция недопустима'),{code});}
function requireMoney(amount){
 if(!Number.isSafeInteger(amount)||amount<=0)throw fail('INVALID_MONEY');
 return amount;
}
function validDate(d){const v=new Date(d);if(!Number.isFinite(v.getTime()))throw fail('INVALID_DATE');return v;}
function prepaidPaid({orderId,customerId,amountKopecks,paidAt,paymentVerified,paymentId}){
 if(!orderId||!customerId||!paymentId||paymentVerified!==true)throw fail('PAYMENT_NOT_VERIFIED');
 const at=validDate(paidAt);
 return {orderId,customerId,paymentId,amountKopecks:requireMoney(amountKopecks),
  status:STATES.PICKUP_AVAILABLE,paidAt:at.toISOString(),
  pickupUntil:new Date(at.getTime()+PICKUP_WINDOW_MS).toISOString()};
}
function pickupDecision({order,at,issueConfirmed,paymentVerified}){
 if(!order||order.status!==STATES.PICKUP_AVAILABLE||paymentVerified!==true)
  throw fail('PICKUP_NOT_AVAILABLE');
 if(issueConfirmed!==true)throw fail('HANDOVER_NOT_CONFIRMED');
 if(validDate(at).getTime()>=validDate(order.pickupUntil).getTime())throw fail('PICKUP_WINDOW_ENDED');
 return {type:'PREPAID_GOODS_ISSUED',orderId:order.orderId,
  customerId:order.customerId,pointRevenueKopecks:0,
  goodsIssuedValueKopecks:order.amountKopecks,status:STATES.ISSUED};
}
function expiredOrderDecision({order,at}){
 if(!order||order.status!==STATES.PICKUP_AVAILABLE)throw fail('ORDER_NOT_ELIGIBLE');
 if(validDate(at).getTime()<validDate(order.pickupUntil).getTime())throw fail('NOT_EXPIRED');
 return {type:'CREDIT_CUSTOMER_PREPAYMENT',orderId:order.orderId,
  customerId:order.customerId,liabilityCreditKopecks:requireMoney(order.amountKopecks),
  pointRevenueKopecks:0,stockDelta:0,status:STATES.BALANCE_CREDITED};
}
function ingredientConsumption({batchLiters,plannedPortions,issuedPortions,unit='ml'}){
 if(unit!=='ml'||!Number.isSafeInteger(plannedPortions)||plannedPortions<1||
   !Number.isSafeInteger(issuedPortions)||issuedPortions<0||
   issuedPortions>plannedPortions||!Number.isFinite(batchLiters)||batchLiters<=0)
  throw fail('RECIPE_INVALID');
 const batchMilliliters=Math.round(batchLiters*1000);
 if(Math.abs(batchMilliliters-batchLiters*1000)>1e-6)throw fail('RECIPE_PRECISION_INVALID');
 // A batch equivalent is only a recipe plan, not a replacement for the
 // measured physical ingredient ledger; recipes must be versioned by SKU.
 const consumedMilliliters=Math.round(batchMilliliters*issuedPortions/plannedPortions);
 return {batchMilliliters,recipeMillilitersPerPortion:batchMilliliters/plannedPortions,
  issuedPortions,consumedMilliliters,remainingMilliliters:batchMilliliters-consumedMilliliters,
  theoreticalRemainingPortions:plannedPortions-issuedPortions};
}
class TimoPosPrepaymentService{
 constructor({repository,clock=()=>new Date()}={}){
  if(!repository?.issuePrepaidAtomic||!repository?.creditExpiredPrepaymentAtomic)
    throw Error('Prepayment persistence adapter required');
  this.repository=repository;this.clock=clock;
 }
 async issue({orderId,pointId,terminalId,sellerId,shiftId,idempotencyKey}){
  if(!orderId||!pointId||!terminalId||!sellerId||!shiftId||!idempotencyKey)
   throw fail('MISSING_SCOPE');
  // Repository MUST lock the order row, validate pickup code, seller/shift,
  // verified prior payment, expiry and safety; atomically update order state,
  // append one consumption by recipe, log handover & honor idempotency.
  return this.repository.issuePrepaidAtomic({orderId,pointId,terminalId,sellerId,
   shiftId,idempotencyKey,at:this.clock(),policy:pickupDecision});
 }
 async expire({orderId,idempotencyKey}){
  if(!orderId||!idempotencyKey)throw fail('MISSING_REFERENCE');
  // Atomic compare-and-swap on order status, preventing issue/expiry race.
  // Credit monetary advance liability, NOT club bonus account.
  return this.repository.creditExpiredPrepaymentAtomic({orderId,idempotencyKey,
   at:this.clock(),policy:expiredOrderDecision});
 }
}
module.exports={PICKUP_WINDOW_MS,STATES,prepaidPaid,pickupDecision,expiredOrderDecision,
 ingredientConsumption,TimoPosPrepaymentService};
