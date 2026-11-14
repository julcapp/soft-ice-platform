'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildPickupRecord,customerPickupView,PrepaidPickupConfirmationService}
=require('../src/modules/timopos/PrepaidPickupConfirmationService');
const order={orderId:'order-7',customerId:'customer-3',status:'PICKUP_AVAILABLE',
 amountKopecks:9500,pickupUntil:'2026-11-16T12:00:00.000Z'};
const point={id:'point-1',code:'001',name:'Точка №001, тестовая'};
const terminal={id:'POS-001',pointId:'point-1'};
const seller={id:'seller-1'},shift={id:'shift-1',sellerId:'seller-1',terminalId:'POS-001',status:'OPEN'};
const args={order,point,terminal,seller,shift,issuedAt:'2026-11-15T12:00:00Z',
 fulfillmentId:'fulfillment-1',paymentVerified:true,pickupVerified:true};
test('customer history shows received time and exact point',()=>{
 const r=buildPickupRecord(args),view=customerPickupView(r);
 assert.equal(view.status,'RECEIVED');assert.equal(view.label,'Мороженое получено');
 assert.equal(view.receivedAt,'2026-11-15T12:00:00.000Z');
 assert.deepEqual(view.pickupPoint,{id:'point-1',number:'001',name:'Точка №001, тестовая'});
 assert.equal(view.additionalChargeKopecks,0);
});
test('advance liability settles on pickup without second charge or local revenue',()=>{
 const r=buildPickupRecord(args);
 assert.equal(r.prepaidObligationSettledKopecks,9500);
 assert.equal(r.newCustomerChargeKopecks,0);assert.equal(r.newPointRevenueKopecks,0);
 assert.equal(r.issuedGoodsValueKopecks,9500);
 assert.equal(r.terminalId,'POS-001');
});
test('cannot issue on wrong point or unverified pickup',()=>{
 assert.throws(()=>buildPickupRecord({...args,terminal:{id:'POS-002',pointId:'point-2'}}),{code:'ISSUE_CONTEXT_INVALID'});
 assert.throws(()=>buildPickupRecord({...args,pickupVerified:false}),{code:'ORDER_OR_PICKUP_NOT_VERIFIED'});
});
test('expired, already issued or credited order cannot be issued',()=>{
 assert.throws(()=>buildPickupRecord({...args,issuedAt:order.pickupUntil}),{code:'PICKUP_EXPIRED'});
 for(const status of ['ISSUED','BALANCE_CREDITED','REFUNDED'])
 assert.throws(()=>buildPickupRecord({...args,order:{...order,status}}),{code:'ORDER_OR_PICKUP_NOT_VERIFIED'});
});
test('customer history never exposes seller or terminal identifiers',()=>{
 const view=customerPickupView(buildPickupRecord(args));
 assert.equal('sellerId' in view,false);assert.equal('terminalId' in view,false);
 assert.equal('customerId' in view,false);
});
test('confirmation service delegates atomic issue to repository',async()=>{
 let call;
 const service=new PrepaidPickupConfirmationService({repository:{async confirmPickupAtomic(input){call=input;return {status:'ISSUED'}}}});
 const result=await service.confirm({orderId:'order-7',terminalId:'POS-001',pointId:'point-1',
 sellerId:'seller-1',shiftId:'shift-1',pickupVerificationId:'verified-qr-1',idempotencyKey:'pick-1'});
 assert.equal(result.status,'ISSUED');assert.equal(call.pointId,'point-1');
 assert.equal(typeof call.buildPickupRecord,'function');
});
