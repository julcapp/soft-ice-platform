const test = require('node:test');
const assert = require('node:assert/strict');
const { InventoryRuntime, InventoryService, InventoryEventSubscriber, InMemoryInventoryRepository } = require('../src/modules/inventory');
const { EventBus, EventHandlerRegistry, InMemoryEventStore, InMemoryOutbox, InMemoryDeadLetterStore } = require('../src/platform/events');

function fixture() {
  const repository = new InMemoryInventoryRepository();
  const events = []; const audits = [];
  const runtime = new InventoryRuntime({ service: new InventoryService({
    repository,
    eventPublisher: { publish: async (event) => events.push(event) },
    auditRepository: { record: async (event) => audits.push(event) },
    clock: () => new Date('2026-07-23T10:00:00.000Z'),
  }) });
  return { runtime, repository, events, audits };
}
function context(key) { return { actorType: 'ADMINISTRATOR', actorId: 'admin_1', sourceChannel: 'TEST', correlationId: 'corr_inventory', idempotencyKey: key }; }
async function catalog(runtime) {
  await runtime.createItem({ id: 'ingredient_mix', sku: 'mix_vanilla', name: 'Vanilla mix', category: 'ingredient', baseUnit: 'kg' }, context('item'));
  await runtime.createLocation({ id: 'warehouse_main', code: 'warehouse_main', name: 'Main warehouse', locationType: 'warehouse', warehouseId: 'warehouse_1' }, context('warehouse'));
  await runtime.createLocation({ id: 'machine_machine_1', code: 'machine_machine_1', name: 'Machine 1', locationType: 'machine', machineId: 'machine_1' }, context('machine'));
}

test('ledger supports every v1 movement class and calculates stock per location', async () => {
  const { runtime, events, audits } = fixture(); await catalog(runtime);
  await runtime.recordMovement({ itemId: 'ingredient_mix', locationId: 'warehouse_main', movementType: 'receipt', quantity: 100, reason: 'supplier_delivery' }, context('receipt'));
  await runtime.recordMovement({ itemId: 'ingredient_mix', locationId: 'warehouse_main', movementType: 'consumption', quantity: 5, reason: 'transfer_out' }, context('out'));
  await runtime.recordMovement({ itemId: 'ingredient_mix', locationId: 'warehouse_main', movementType: 'test_consumption', quantity: 2, reason: 'quality_test' }, context('test'));
  await runtime.recordMovement({ itemId: 'ingredient_mix', locationId: 'warehouse_main', movementType: 'maintenance', quantity: 3, reason: 'line_flush' }, context('maintenance'));
  await runtime.recordMovement({ itemId: 'ingredient_mix', locationId: 'warehouse_main', movementType: 'adjustment', quantity: -1, reason: 'damaged_package' }, context('adjustment'));
  const count = await runtime.recordMovement({ itemId: 'ingredient_mix', locationId: 'warehouse_main', movementType: 'inventory_count', quantity: 90, reason: 'monthly_count' }, context('count'));
  assert.equal(count.balance.onHand, 90);
  assert.equal((await runtime.listMovements({ locationId: 'warehouse_main' })).length, 6);
  assert.equal(events.filter((event) => event.eventType === 'Inventory.MovementRecorded').length, 6);
  assert.ok(audits.length >= 9);
});

test('reservations affect available stock and can be consumed or released idempotently', async () => {
  const { runtime } = fixture(); await catalog(runtime);
  await runtime.recordMovement({ itemId: 'ingredient_mix', locationId: 'machine_machine_1', movementType: 'receipt', quantity: 10, reason: 'refill' }, context('refill'));
  const first = await runtime.reserve({ itemId: 'ingredient_mix', locationId: 'machine_machine_1', quantity: 4, purpose: 'order_1' }, context('reserve_1'));
  const replay = await runtime.reserve({ itemId: 'ingredient_mix', locationId: 'machine_machine_1', quantity: 4, purpose: 'order_1' }, context('reserve_1'));
  assert.equal(replay.idempotentReplay, true);
  assert.equal((await runtime.listReservations()).length, 1);
  assert.deepEqual({ onHand: first.balance.onHand, reserved: first.balance.reserved, available: first.balance.available }, { onHand: 10, reserved: 4, available: 6 });
  const consumed = await runtime.consumeReservation(first.reservation.id, { reason: 'order_dispensed' }, context('consume_1'));
  assert.equal(consumed.reservation.status, 'CONSUMED');
  assert.equal(consumed.balance.onHand, 6);
  assert.equal(consumed.balance.reserved, 0);
  await assert.rejects(() => runtime.reserve({ itemId: 'ingredient_mix', locationId: 'machine_machine_1', quantity: 7, purpose: 'order_2' }, context('reserve_2')), ({ code }) => code === 'INVENTORY_INSUFFICIENT_AVAILABLE_STOCK');
});

test('idempotency rejects key reuse with different command and stock cannot become negative', async () => {
  const { runtime } = fixture(); await catalog(runtime);
  await runtime.recordMovement({ itemId: 'ingredient_mix', locationId: 'warehouse_main', movementType: 'receipt', quantity: 2, reason: 'delivery' }, context('same'));
  await assert.rejects(() => runtime.recordMovement({ itemId: 'ingredient_mix', locationId: 'warehouse_main', movementType: 'receipt', quantity: 3, reason: 'delivery' }, context('same')), ({ code }) => code === 'IDEMPOTENCY_KEY_REUSED');
  await assert.rejects(() => runtime.recordMovement({ itemId: 'ingredient_mix', locationId: 'warehouse_main', movementType: 'consumption', quantity: 3, reason: 'sale' }, context('too_much')), ({ code }) => code === 'INVENTORY_INSUFFICIENT_STOCK');
});

test('Event Bus subscriber posts a source event exactly once', async () => {
  const { runtime } = fixture();
  await runtime.createItem({ id: 'consumable_cup', sku: 'cup', name: 'Cup', category: 'consumable', baseUnit: 'piece' }, context('cup'));
  await runtime.createLocation({ id: 'machine_machine_1', code: 'machine_machine_1', name: 'Machine 1', locationType: 'machine', machineId: 'machine_1' }, context('machine'));
  await runtime.recordMovement({ itemId: 'consumable_cup', locationId: 'machine_machine_1', movementType: 'receipt', quantity: 5, reason: 'refill' }, context('refill'));
  const registry = new EventHandlerRegistry(); const subscriber = new InventoryEventSubscriber({ runtime });
  registry.register('CUP_DISPENSE_COMPLETED', subscriber.subscriber());
  const bus = new EventBus({ registry, eventStore: new InMemoryEventStore(), outbox: new InMemoryOutbox(), deadLetterStore: new InMemoryDeadLetterStore() });
  const event = { eventId: 'evt_cup_1', eventType: 'CUP_DISPENSE_COMPLETED', aggregateType: 'MACHINE', aggregateId: 'machine_1', actorType: 'SYSTEM', actorId: 'runtime', sourceChannel: 'MACHINE_RUNTIME', correlationId: 'corr_1', occurredAt: new Date(), recordedAt: new Date(), payload: { quantity: 1 } };
  await bus.publish(event); await bus.publish(event);
  const balance = await runtime.listBalances({ itemId: 'consumable_cup', locationId: 'machine_machine_1' });
  assert.equal(balance[0].onHand, 4);
});
