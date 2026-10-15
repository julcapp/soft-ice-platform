const {test}=require('node:test');const assert=require('node:assert/strict');
const {paidReservationProtection}=require('../src/modules/inventory/PaidReservationPolicy');
const reservation={operationType:'CUSTOMER_SALE',organizationId:'org',orderId:'order',saleFlowId:'flow',machineId:'machine',reservationId:'reserve'};
test('paid reservation is protected from expiry but consumption requires committed physical fact in transaction',async()=>{
 let paid=true,dispensed=false,seen;
 const tx={payment:{findFirst:async({where})=>{assert.equal(where.status,'SUCCEEDED');return paid?{id:'p'}:null;}},machineDispenseAttempt:{findFirst:async({where})=>{seen=where;return dispensed?{id:'a'}:null;}}};
 assert.equal(await paidReservationProtection(tx,reservation,'EXPIRED'),true);
 assert.equal(await paidReservationProtection(tx,reservation,'CONSUMED'),false);
 const context={transactionClient:tx,idempotencyKey:'machine-consume:command'};
 assert.equal(await paidReservationProtection(tx,reservation,'CONSUMED',context),false);
 dispensed=true;assert.equal(await paidReservationProtection(tx,reservation,'CONSUMED',context),true);
 assert.equal(seen.commandId,'command');assert.equal(seen.inventoryReservationId,'reserve');assert.equal(seen.status,'DISPENSED');
 paid=false;assert.equal(await paidReservationProtection(tx,reservation,'EXPIRED'),false);assert.equal(await paidReservationProtection(tx,reservation,'CONSUMED',context),false);
});
test('test operations and missing scopes cannot bypass expiry',async()=>{
 assert.equal(await paidReservationProtection({},reservation,'CONSUMED'),false);
 assert.equal(await paidReservationProtection({}, {...reservation,operationType:'OPERATOR_TEST'},'EXPIRED'),false);
});
