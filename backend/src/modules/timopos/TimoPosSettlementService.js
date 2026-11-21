'use strict';

/**
 * POS settlement and handover policy.
 * No browser-controlled payment success. Repository transactions must enforce
 * one unique settlement per order, serialized issue confirmation and audit.
 * CASH: cashier explicitly confirms received notes/coins and verified fiscal
 * operation. CASHLESS: bank/acquirer/provider webhook or verified polling only.
 * Physical issue is a separate, explicit seller action for both methods.
 */
const METHODS=Object.freeze({CASH:'CASH',CARD:'CARD',SBP:'SBP'});
const MAX_AMOUNT_KOPECKS=100000000000;
function fail(code){return Object.assign(new Error('Расчёт или выдача не разрешены.'),{code});}
function validMoney(value){return Number.isSafeInteger(value)&&value>=0&&value<=MAX_AMOUNT_KOPECKS;}
function cashTender({dueKopecks,receivedKopecks}){
 if(!validMoney(dueKopecks)||dueKopecks<=0||!validMoney(receivedKopecks))
   throw fail('CASH_AMOUNT_INVALID');
 if(receivedKopecks<dueKopecks)throw fail('INSUFFICIENT_CASH');
 return Object.freeze({dueKopecks,receivedKopecks,changeKopecks:receivedKopecks-dueKopecks});
}
function assertCashConfirmation({order,tender,fiscalStatus,operatorConfirmed}) {
 if(order?.paymentMethod!==METHODS.CASH)throw fail('PAYMENT_METHOD_MISMATCH');
 if(operatorConfirmed!==true)throw fail('CASH_NOT_CONFIRMED');
 if(fiscalStatus!=='FISCALIZED')throw fail('FISCALIZATION_REQUIRED');
 const computed=cashTender({dueKopecks:order.totalKopecks,receivedKopecks:tender?.receivedKopecks});
 if(tender.dueKopecks!==computed.dueKopecks || tender.changeKopecks!==computed.changeKopecks)
   throw fail('CASH_AMOUNT_MISMATCH');
 return computed;
}
function canIssueGoods({order,payment,fiscalStatus,session,shift,technicalBreak}){
 const reasons=[];
 if(!order?.id||order.status==='CANCELLED'||order.status==='REFUNDED')reasons.push('ORDER_NOT_ACTIVE');
 if(!session?.active||session.revokedAt||session.sellerId!==order?.sellerId||
    session.terminalId!==order?.terminalId)reasons.push('SESSION_INVALID');
 if(!shift||shift.id!==order?.shiftId||shift.status!=='OPEN')reasons.push('SHIFT_NOT_OPEN');
 if(technicalBreak==='ACTIVE')reasons.push('TECHNICAL_BREAK_ACTIVE');
 if(fiscalStatus!=='FISCALIZED')reasons.push('FISCALIZATION_REQUIRED');
 if(!payment||payment.orderId!==order?.id||payment.method!==order?.paymentMethod)
   reasons.push('PAYMENT_NOT_VERIFIED');
 else if(payment.method===METHODS.CASH) {
   if(payment.status!=='CASH_CONFIRMED'||!payment.operatorConfirmed||!validMoney(payment.receivedKopecks)||
      payment.receivedKopecks<order.totalKopecks)reasons.push('CASH_NOT_CONFIRMED');
 } else if([METHODS.CARD,METHODS.SBP].includes(payment.method)) {
   if(payment.status!=='SUCCEEDED'||payment.verifiedByBackend!==true||!payment.providerReference)
     reasons.push('BANK_PAYMENT_NOT_SUCCEEDED');
 } else reasons.push('UNKNOWN_PAYMENT_METHOD');
 if(order?.fulfillmentStatus==='ISSUED')reasons.push('ALREADY_ISSUED');
 return {allowed:reasons.length===0,reasons};
}
class TimoPosSettlementService {
 constructor({repository,access,clock=()=>new Date()}={}){
  if(!repository?.recordCashPaymentAtomic||!repository?.recordIssuedAtomic||
     !access?.assertSalesAccess)throw Error('settlement repository and access required');
  this.repository=repository;this.access=access;this.clock=clock;
 }
 async confirmCash({context,orderId,receivedKopecks,fiscalOperationId,idempotencyKey,operatorConfirmed}){
  await this.access.assertSalesAccess({...context,at:this.clock()});
  const order=await this.repository.getOrderForPoint({orderId,...context});
  if(!order||order.paymentMethod!==METHODS.CASH)throw fail('ORDER_NOT_CASH');
  const tender=cashTender({dueKopecks:order.totalKopecks,receivedKopecks});
  if(operatorConfirmed!==true||!fiscalOperationId)throw fail('CASH_OR_FISCAL_NOT_CONFIRMED');
  // Adapter MUST look up verified fiscal document, enforce idempotency,
  // and commit payment, tender fields and journal entry atomically.
  return this.repository.recordCashPaymentAtomic({
   orderId,pointId:context.pointId,terminalId:context.terminalId,
   sellerId:context.sellerId,shiftId:context.shiftId,
   ...tender,fiscalOperationId,operatorConfirmed:true,idempotencyKey,at:this.clock()
  });
 }
 async confirmIssued({context,orderId,idempotencyKey,requestedBySeller}){
  if(requestedBySeller!==true)throw fail('EXPLICIT_HANDOVER_REQUIRED');
  await this.access.assertSalesAccess({...context,at:this.clock()});
  // Repository MUST transactionally lock order, read authoritative payment
  // including verified external provider state, fiscal record, shift and break.
  // It MUST revalidate canIssueGoods before commit and enforce idempotency.
  return this.repository.recordIssuedAtomic({
   orderId,pointId:context.pointId,terminalId:context.terminalId,
   sellerId:context.sellerId,shiftId:context.shiftId,
   idempotencyKey,at:this.clock(),policy:canIssueGoods
  });
 }
}
function interimXReport({shiftId,from,to,transactions}){
 if(!shiftId||!Array.isArray(transactions))throw fail('X_REPORT_INPUT_INVALID');
 const totals={cashKopecks:0,cardKopecks:0,sbpKopecks:0,refundKopecks:0,paidCount:0};
 const seen=new Set();
 for(const tx of transactions){
  if(!tx||!tx.id||seen.has(tx.id))throw fail('X_REPORT_DUPLICATE_TRANSACTION');
  seen.add(tx.id);
  if(tx.shiftId!==shiftId || !validMoney(tx.amountKopecks))throw fail('X_REPORT_INPUT_INVALID');
  if(tx.status==='REFUNDED'){totals.refundKopecks+=tx.amountKopecks;continue;}
  if(tx.status!=='SUCCEEDED'&&tx.status!=='CASH_CONFIRMED')continue;
  if(tx.method===METHODS.CASH)totals.cashKopecks+=tx.amountKopecks;
  else if(tx.method===METHODS.CARD)totals.cardKopecks+=tx.amountKopecks;
  else if(tx.method===METHODS.SBP)totals.sbpKopecks+=tx.amountKopecks;
  else throw fail('UNKNOWN_PAYMENT_METHOD');
  totals.paidCount++;
 }
 const gross=totals.cashKopecks+totals.cardKopecks+totals.sbpKopecks;
 totals.grossKopecks=gross;
 totals.netKopecks=gross-totals.refundKopecks;
 return {type:'INTERNAL_INTERIM',shiftId,from,to,totals,closesShift:false};
}
module.exports={METHODS,cashTender,assertCashConfirmation,canIssueGoods,
 TimoPosSettlementService,interimXReport};
