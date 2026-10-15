const test = require('node:test');
const assert = require('node:assert/strict');
const { PostgresInventoryReservationService } = require('../src/modules/inventory/PostgresInventoryReservationService');
const reservation = { reservationId: 'res', organizationId: 'org', orderId: 'order', saleFlowId: 'flow', machineId: 'machine', operationType: 'CUSTOMER_SALE', status: 'RESERVED', expiresAt: new Date(0) };
test('paid expired reserve checks command key supplied by machine consume request', async () => {
  let query;
  const tx = {
    $queryRaw: async () => [reservation],
    payment: { findFirst: async () => ({ id: 'paid' }) },
    machineDispenseAttempt: { findFirst: async input => { query = input.where; return { id: 'confirmed' }; } },
    inventoryRuntimeReservationItem: { findMany: async () => { throw Object.assign(new Error('reached stock stage'), { code: 'TEST_STOCK_STAGE' }); } },
  };
  const service = new PostgresInventoryReservationService({ prisma: tx });
  await assert.rejects(service.consume('res', { idempotencyKey: 'machine-consume:command' }, { organizationId: 'org', transactionClient: tx }), { code: 'TEST_STOCK_STAGE' });
  assert.equal(query.commandId, 'command');
  assert.equal(query.status, 'DISPENSED');
  assert.equal(query.inventoryReservationId, 'res');
});
test('unconfirmed dispensing cannot consume expired paid reserve', async () => {
  const tx = { $queryRaw: async () => [reservation], payment: { findFirst: async () => ({ id: 'paid' }) }, machineDispenseAttempt: { findFirst: async () => null } };
  const service = new PostgresInventoryReservationService({ prisma: tx });
  await assert.rejects(service.consume('res', { idempotencyKey: 'machine-consume:command' }, { organizationId: 'org', transactionClient: tx }), { code: 'INVENTORY_RESERVATION_EXPIRED' });
});
