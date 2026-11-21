'use strict';

// Issuing pre-paid goods is a settlement of an existing advance obligation,
// NOT a second customer charge. Keep customer receipt, material movement,
// liability fulfilment and shift log in one server transaction.
function error(code){return Object.assign(new Error('Нельзя подтвердить выдачу предоплаченного заказа'),{code});}
function asDate(value){const date=new Date(value);if(!Number.isFinite(date.getTime()))throw error('INVALID_TIME');return date;}
function buildPickupRecord({order,point,terminal,seller,shift,issuedAt,fulfillmentId,
 paymentVerified,pickupVerified}){
 if(!order?.orderId||!order.customerId||order.status!=='PICKUP_AVAILABLE'||
   paymentVerified!==true||pickupVerified!==true)throw error('ORDER_OR_PICKUP_NOT_VERIFIED');
 if(!point?.id||!point.code||!point.name||!terminal?.id||terminal.pointId!==point.id||
   !seller?.id||!shift?.id||shift.status!=='OPEN'||shift.sellerId!==seller.id||
   shift.terminalId!==terminal.id||!fulfillmentId)throw error('ISSUE_CONTEXT_INVALID');
 const at=asDate(issuedAt);
 if(at.getTime()>=asDate(order.pickupUntil).getTime())throw error('PICKUP_EXPIRED');
 if(!Number.isSafeInteger(order.amountKopecks)||order.amountKopecks<=0)
   throw error('INVALID_ORDER_AMOUNT');
 return Object.freeze({
  fulfillmentId,orderId:order.orderId,customerId:order.customerId,
  pointId:point.id,pointCode:point.code,pointName:point.name,
  terminalId:terminal.id,sellerId:seller.id,shiftId:shift.id,
  issuedAt:at.toISOString(),status:'ISSUED',
  prepaidObligationSettledKopecks:order.amountKopecks,
  newCustomerChargeKopecks:0,newPointRevenueKopecks:0,
  issuedGoodsValueKopecks:order.amountKopecks
 });
}
function customerPickupView(record){
 if(!record||record.status!=='ISSUED'||!record.fulfillmentId)throw error('NOT_ISSUED');
 return {
  orderId:record.orderId,status:'RECEIVED',label:'Мороженое получено',
  receivedAt:record.issuedAt,
  pickupPoint:{id:record.pointId,number:record.pointCode,name:record.pointName},
  paymentStatus:'PREVIOUSLY_PAID',additionalChargeKopecks:0
 };
}
class PrepaidPickupConfirmationService {
 constructor({repository,clock=()=>new Date()}={}){
  if(!repository?.confirmPickupAtomic)throw Error('Atomic pickup repository required');
  this.repository=repository;this.clock=clock;
 }
 async confirm({orderId,terminalId,pointId,sellerId,shiftId,pickupVerificationId,idempotencyKey}){
  if(!orderId||!terminalId||!pointId||!sellerId||!shiftId||
     !pickupVerificationId||!idempotencyKey)throw error('MISSING_SCOPE');
  // Repository must lock the order and its advance obligation. Revalidate
  // verified SUCCEEDED payment, 48h, seller/shift/site, pickup OTP or QR,
  // current operating schedule, session, hardware state, and absence of
  // another issued/credited/refunded status. In the SAME transaction:
  // (1) consume pickup token, (2) record immutable point/terminal fulfillment,
  // (3) settle the advance liability without a new charge, (4) append
  // inventory recipe consumption for this actual point (idempotent),
  // (5) write EventRecord/outbox for customer account & shift.
  // A replay returns the original result; different terminal must not move
  // an already issued order.
  return this.repository.confirmPickupAtomic({orderId,terminalId,pointId,
    sellerId,shiftId,pickupVerificationId,idempotencyKey,at:this.clock(),
    buildPickupRecord});
 }
}
module.exports={buildPickupRecord,customerPickupView,PrepaidPickupConfirmationService};
