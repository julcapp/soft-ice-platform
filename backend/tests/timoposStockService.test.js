'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {TYPE,stockDelta,quantityAfterMovement,TimoPosStockService}
  =require('../src/modules/timopos/TimoPosStockService');

function fixture(){
 let quantity=0;
 const ids=new Map(),movements=[];
 const repo={
 async applyMovementAtomic(data){
  if(ids.has(data.idempotencyKey))return ids.get(data.idempotencyKey);
  quantity=quantityAfterMovement({physicalQuantity:quantity,delta:data.delta});
  const result={id:'m'+(movements.length+1),quantity,delta:data.delta,type:data.type};
  ids.set(data.idempotencyKey,result);movements.push({...data,result});return result;
 }};
 const service=new TimoPosStockService({repository:repo});
 const context={pointId:'point1',terminalId:'POS1',sellerId:'seller1',shiftId:'shift1',
 sessionActive:true,shiftOpen:true,itemId:'cup',quantity:1};
 return {service,context,quantity:()=>quantity,movements:()=>movements};
}
test('50 cups receipt minus 30 cups sold equals 20 remaining',async()=>{
 const f=fixture();
 await f.service.move({...f.context,type:TYPE.RECEIPT,quantity:50,idempotencyKey:'delivery-001-50'});
 const result=await f.service.move({...f.context,type:TYPE.SALE_CONSUMPTION,quantity:30,
 idempotencyKey:'order-batch-001-30',confirmedFulfillment:true,sourceOrderId:'order-1'});
 assert.equal(result.quantity,20);assert.equal(f.quantity(),20);
});
test('two defective cups leave 18 and include an explicit reason',async()=>{
 const f=fixture();
 await f.service.move({...f.context,type:TYPE.RECEIPT,quantity:50,idempotencyKey:'delivery-001-50'});
 await f.service.move({...f.context,type:TYPE.SALE_CONSUMPTION,quantity:30,
 idempotencyKey:'order-batch-001-30',confirmedFulfillment:true,sourceOrderId:'order-1'});
 const result=await f.service.move({...f.context,type:TYPE.DEFECT,quantity:2,
 idempotencyKey:'defects-001-2',reason:'Broken cups'});
 assert.equal(result.quantity,18);assert.equal(f.movements().length,3);
});
test('replayed event cannot double subtract stock',async()=>{
 const f=fixture();
 const receipt={...f.context,type:TYPE.RECEIPT,quantity:50,idempotencyKey:'delivery-001-50'};
 await f.service.move(receipt);await f.service.move(receipt);
 const sold={...f.context,type:TYPE.SALE_CONSUMPTION,quantity:30,
 idempotencyKey:'order-batch-001-30',confirmedFulfillment:true,sourceOrderId:'order-1'};
 await f.service.move(sold);await f.service.move(sold);
 assert.equal(f.quantity(),20);assert.equal(f.movements().length,2);
});
test('payment without physical issue must not consume cups',async()=>{
 const f=fixture();await f.service.move({...f.context,type:TYPE.RECEIPT,quantity:50,idempotencyKey:'delivery-001-50'});
 await assert.rejects(f.service.move({...f.context,type:TYPE.SALE_CONSUMPTION,quantity:1,
 idempotencyKey:'pending-payment-001',sourceOrderId:'order-1'}),{code:'FULFILLMENT_NOT_CONFIRMED'});
 assert.equal(f.quantity(),50);
});
test('defect requires a reason, insufficient stock is refused',async()=>{
 const f=fixture();
 await assert.rejects(f.service.move({...f.context,type:TYPE.DEFECT,quantity:1,idempotencyKey:'defect-001-xxx'}),{code:'DEFECT_REASON_REQUIRED'});
 await assert.rejects(f.service.move({...f.context,type:TYPE.DEFECT,quantity:1,
 idempotencyKey:'defect-001-xxx',reason:'broken'}),{code:'INSUFFICIENT_STOCK'});
});
test('stock movements require valid shift and authentication',async()=>{
 const f=fixture();
 await assert.rejects(f.service.move({...f.context,type:TYPE.RECEIPT,quantity:5,
 idempotencyKey:'delivery-001-50',shiftOpen:false}),{code:'SELLER_SHIFT_REQUIRED'});
 assert.equal(f.quantity(),0);
});
test('invalid and fractional quantities are rejected',()=>{
 assert.throws(()=>stockDelta(TYPE.RECEIPT,0),{code:'QUANTITY_INVALID'});
 assert.throws(()=>stockDelta(TYPE.DEFECT,1.2),{code:'QUANTITY_INVALID'});
 assert.throws(()=>quantityAfterMovement({physicalQuantity:0,delta:-1}),{code:'INSUFFICIENT_STOCK'});
});
