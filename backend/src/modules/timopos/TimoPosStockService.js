'use strict';

/**
 * POS adapter for the existing InventoryRuntimeStock/InventoryRuntimeMovement
 * ledger. No separate inventory balance. Repository performs one atomic DB
 * transaction including stock update, movement with unique idempotencyKey,
 * event journal/outbox append; server is authority for final balance.
 *
 * SALE_CONSUMPTION must be applied only on confirmed physical fulfilment
 * (or equivalent finalized manual issue), NOT merely when checkout begins.
 */
const TYPE=Object.freeze({
 RECEIPT:'RECEIPT',
 SALE_CONSUMPTION:'SALE_CONSUMPTION',
 DEFECT:'DEFECT',
 INVENTORY_COUNT:'INVENTORY_COUNT'
});
function reject(code){return Object.assign(new Error('Движение товара не разрешено.'),{code})}
function toInteger(value){
 if(!Number.isSafeInteger(value)||value<=0)throw reject('QUANTITY_INVALID');
 return value;
}
function stockDelta(type,quantity){
 if(type===TYPE.RECEIPT)return toInteger(quantity);
 if(type===TYPE.SALE_CONSUMPTION||type===TYPE.DEFECT)return -toInteger(quantity);
 throw reject('MOVEMENT_NOT_SUPPORTED');
}
function quantityAfterMovement({physicalQuantity,delta}){
 if(!Number.isSafeInteger(physicalQuantity)||physicalQuantity<0)throw reject('STOCK_INVALID');
 if(!Number.isSafeInteger(delta)||delta===0)throw reject('DELTA_INVALID');
 const next=physicalQuantity+delta;
 if(!Number.isSafeInteger(next)||next<0)throw reject('INSUFFICIENT_STOCK');
 return next;
}
class TimoPosStockService{
 constructor({repository,clock=()=>new Date()}={}){
  if(!repository?.applyMovementAtomic)throw Error('existing inventory repository adapter required');
  this.repository=repository;this.clock=clock;
 }
 async move({type,itemId,quantity,pointId,terminalId,sellerId,shiftId,
   idempotencyKey,sourceOrderId=null,reason=null,confirmedFulfillment=false,
   sessionActive=false,shiftOpen=false}){
  if(!sessionActive||!shiftOpen||!sellerId||!pointId||!terminalId||!shiftId)
    throw reject('SELLER_SHIFT_REQUIRED');
  const delta=stockDelta(type,quantity);
  if(!itemId||typeof idempotencyKey!=='string'||idempotencyKey.length<12)
    throw reject('MOVEMENT_REFERENCE_INVALID');
  if(type===TYPE.SALE_CONSUMPTION && (!confirmedFulfillment||!sourceOrderId))
    throw reject('FULFILLMENT_NOT_CONFIRMED');
  if(type===TYPE.DEFECT && (!reason||!reason.trim()))
    throw reject('DEFECT_REASON_REQUIRED');
  return this.repository.applyMovementAtomic({
    type,itemId,pointId,terminalId,sellerId,shiftId,quantity,delta,
    idempotencyKey,sourceOrderId,reason,occurredAt:this.clock(),
  });
 }
}
module.exports={TYPE,stockDelta,quantityAfterMovement,TimoPosStockService};
