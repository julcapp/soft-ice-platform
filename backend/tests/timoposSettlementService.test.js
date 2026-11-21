'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {METHODS,cashTender,canIssueGoods,TimoPosSettlementService,interimXReport}
 =require('../src/modules/timopos/TimoPosSettlementService');
const order={id:'order-1',sellerId:'seller-1',terminalId:'POS-001',shiftId:'shift-1',
 totalKopecks:23500,paymentMethod:METHODS.CASH,status:'ACTIVE',fulfillmentStatus:'PENDING'};
const session={active:true,sellerId:'seller-1',terminalId:'POS-001'};
const shift={id:'shift-1',status:'OPEN'};
const context={pointId:'point-1',terminalId:'POS-001',sellerId:'seller-1',shiftId:'shift-1'};
function cashPayment(){return {orderId:'order-1',method:'CASH',status:'CASH_CONFIRMED',operatorConfirmed:true,receivedKopecks:30000};}
test('cash received 300.00 for basket 235.00 returns 65.00 change',()=>{
 assert.deepEqual(cashTender({dueKopecks:23500,receivedKopecks:30000}),
 {dueKopecks:23500,receivedKopecks:30000,changeKopecks:6500});
});
test('cash less than purchase price, decimals and invalid amounts denied',()=>{
 assert.throws(()=>cashTender({dueKopecks:23500,receivedKopecks:23499}),{code:'INSUFFICIENT_CASH'});
 assert.throws(()=>cashTender({dueKopecks:23500.3,receivedKopecks:30000}),{code:'CASH_AMOUNT_INVALID'});
});
test('cash issue requires operator confirmation and fiscal document',()=>{
 const p=cashPayment();
 assert.equal(canIssueGoods({order,payment:p,fiscalStatus:'FISCALIZED',session,shift}).allowed,true);
 assert.equal(canIssueGoods({order,payment:{...p,operatorConfirmed:false},fiscalStatus:'FISCALIZED',session,shift}).allowed,false);
 assert.equal(canIssueGoods({order,payment:p,fiscalStatus:'PENDING',session,shift}).allowed,false);
});
test('card and SBP cannot issue until bank verified successful status',()=>{
 for(const method of [METHODS.CARD,METHODS.SBP]){
 const ord={...order,paymentMethod:method};
 const payment={orderId:order.id,method,status:'PENDING',verifiedByBackend:false,providerReference:'bank-ref'};
 assert.equal(canIssueGoods({order:ord,payment,fiscalStatus:'FISCALIZED',session,shift}).allowed,false);
 assert.equal(canIssueGoods({order:ord,payment:{...payment,status:'SUCCEEDED',verifiedByBackend:false},fiscalStatus:'FISCALIZED',session,shift}).allowed,false);
 assert.equal(canIssueGoods({order:ord,payment:{...payment,status:'SUCCEEDED',verifiedByBackend:true},fiscalStatus:'FISCALIZED',session,shift}).allowed,true);
 }
});
test('already issued, active technical break or revoked session block handover',()=>{
 const p=cashPayment();
 const arg={order,payment:p,fiscalStatus:'FISCALIZED',session,shift};
 assert.equal(canIssueGoods({...arg,order:{...order,fulfillmentStatus:'ISSUED'}}).allowed,false);
 assert.equal(canIssueGoods({...arg,technicalBreak:'ACTIVE'}).allowed,false);
 assert.equal(canIssueGoods({...arg,session:{...session,revokedAt:new Date()}}).allowed,false);
});
test('cash confirmation passes tender values to atomic backend adapter, never fabricates paid state',async()=>{
 let called=null;
 const service=new TimoPosSettlementService({
 repository:{getOrderForPoint:async()=>order,recordCashPaymentAtomic:async x=>(called=x,{status:'CASH_CONFIRMED',...x}),recordIssuedAtomic:async()=>null},
 access:{assertSalesAccess:async()=>true}});
 const output=await service.confirmCash({context,orderId:'order-1',receivedKopecks:30000,
 fiscalOperationId:'fiscal-abc',operatorConfirmed:true,idempotencyKey:'cash-payment-00001'});
 assert.equal(output.changeKopecks,6500);assert.equal(called.dueKopecks,23500);
});
test('cash cannot be confirmed without explicit cashier confirmation',async()=>{
 const service=new TimoPosSettlementService({
 repository:{getOrderForPoint:async()=>order,recordCashPaymentAtomic:async()=>{throw Error('MUST_NOT_CALL')},recordIssuedAtomic:async()=>null},
 access:{assertSalesAccess:async()=>true}});
 await assert.rejects(service.confirmCash({context,orderId:'order-1',receivedKopecks:30000,
 idempotencyKey:'cash-000000001',fiscalOperationId:'fiscal',operatorConfirmed:false}),{code:'CASH_OR_FISCAL_NOT_CONFIRMED'});
});
test('goods issue requires explicit press and access is rechecked',async()=>{
 let count=0;const service=new TimoPosSettlementService({
 repository:{recordCashPaymentAtomic:async()=>null,recordIssuedAtomic:async()=>{count++;return {status:'ISSUED'};}},
 access:{assertSalesAccess:async()=>true}});
 await assert.rejects(service.confirmIssued({context,orderId:'order-1',idempotencyKey:'issue-00000001'}),{code:'EXPLICIT_HANDOVER_REQUIRED'});
 assert.equal(count,0);
 assert.equal((await service.confirmIssued({context,orderId:'order-1',
 idempotencyKey:'issue-00000001',requestedBySeller:true})).status,'ISSUED');
 assert.equal(count,1);
});
test('interim X totals cash, card and SBP without closing shift',()=>{
 const transactions=[
 {id:'1',shiftId:'sh',method:'CASH',status:'CASH_CONFIRMED',amountKopecks:20000},
 {id:'2',shiftId:'sh',method:'CARD',status:'SUCCEEDED',amountKopecks:10000},
 {id:'3',shiftId:'sh',method:'SBP',status:'SUCCEEDED',amountKopecks:5000},
 {id:'4',shiftId:'sh',method:'CARD',status:'PENDING',amountKopecks:9000},
 {id:'5',shiftId:'sh',method:'CASH',status:'REFUNDED',amountKopecks:2000}
 ];
 const report=interimXReport({shiftId:'sh',from:'start',to:'now',transactions});
 assert.equal(report.type,'INTERNAL_INTERIM');assert.equal(report.closesShift,false);
 assert.deepEqual(report.totals,{cashKopecks:20000,cardKopecks:10000,
 sbpKopecks:5000,refundKopecks:2000,paidCount:3,grossKopecks:35000,netKopecks:33000});
});
test('duplicate monetary event cannot inflate X totals',()=>{
 assert.throws(()=>interimXReport({shiftId:'sh',transactions:[
 {id:'a',shiftId:'sh',method:'CASH',status:'CASH_CONFIRMED',amountKopecks:100},
 {id:'a',shiftId:'sh',method:'CASH',status:'CASH_CONFIRMED',amountKopecks:100}]}),
 {code:'X_REPORT_DUPLICATE_TRANSACTION'});
});
