const test = require('node:test');
const assert = require('node:assert/strict');
const { SaleFlowService, InMemorySaleFlowRepository, SimulatorPaymentAdapter, SimulatorMachineAdapter, presentSaleFlow, TRANSITIONS } = require('../src/modules/sale_flow');

let sequence = 0;
function fixture({ payment = 'PAID', machine = 'DISPENSED', available = true, paymentAdapter } = {}) {
  const repository = new InMemorySaleFlowRepository();
  const events = [];
  const calls = { reserved: 0, consumed: 0, released: 0, customer: 0, crm: 0, loyalty: 0, orderCompleted: 0, refundRequired: 0 };
  const domainOrders = new Map();
  const orderDomain = {
    create: async (input) => { const value = { ...input, orderId: `order_${++sequence}`, status: 'PAYMENT_PENDING', paymentStatus: 'pending' }; domainOrders.set(value.orderId, value); return value; },
    confirmPayment: async (id) => { const value = domainOrders.get(id); value.status = 'PAID'; value.paymentStatus = 'paid'; return value; },
    rejectPayment: async (id) => { const value = domainOrders.get(id); value.status = 'PAYMENT_FAILED'; return value; },
    getPaymentDetails: async (id) => { const value = domainOrders.get(id); return { amount: value.totalAmount, currency: value.currency }; },
    getFulfillmentDetails: async (id) => { const value = domainOrders.get(id); return { product: value.product, quantity: value.quantity }; },
    complete: async (id) => { calls.orderCompleted += 1; const value = domainOrders.get(id); value.status = 'COMPLETED'; return value; },
    requireRefund: async (id) => { calls.refundRequired += 1; const value = domainOrders.get(id); value.status = 'REFUND_REQUIRED'; return value; },
  };
  const inventory = {
    checkAndReserve: async () => { calls.reserved += 1; return { available, reservationId: 'reservation_1' }; },
    calculatePrice: async () => ({ totalAmount: 190, currency: 'RUB' }),
    consume: async () => { calls.consumed += 1; }, release: async () => { calls.released += 1; },
  };
  const service = new SaleFlowService({
    repository, orderDomain,
    paymentAdapter: paymentAdapter || new SimulatorPaymentAdapter({ outcome: payment }),
    machineAdapter: new SimulatorMachineAdapter({ outcome: machine }), inventory,
    organizationContext: { resolveByMachine: async () => ({ organizationId: 'org_authoritative', locationId: 'location_authoritative' }) },
    eventPublisher: { publish: async (event) => { events.push(event); return event; } },
    customer360: { recordPurchase: async () => { calls.customer += 1; } },
    crm: { recordSale: async () => { calls.crm += 1; } },
    loyalty: { registerPurchase: async () => { calls.loyalty += 1; } },
  });
  return { service, repository, events, calls, domainOrders };
}
const order = { customerId: 'customer_1', machineId: 'machine_1', organizationId: 'untrusted_org', pointId: 'untrusted_point', channel: 'MINI_APP', product: { baseProductId: 'product_soft_ice_vanilla_cup', toppingId: 'topping_oreo', additionId: 'syrup_strawberry' }, quantity: 1 };
const create = (fixtureValue, context = {}) => fixtureValue.service.create(order, { idempotencyKey: `create_${++sequence}`, ...context });

test('happy path завершает продажу и каждый побочный эффект ровно один раз', async () => {
  const f = fixture(); const created = await create(f, { correlationId: 'corr_1' });
  await f.service.pay(created.orderId, {}, { idempotencyKey: 'payment_1' }); const token = await f.service.authorize(created.orderId); await f.service.dispense(token.tokenId, { machineId: 'machine_1' });
  assert.equal(created.flowState, 'COMPLETED'); assert.equal(f.domainOrders.get(created.orderId).status, 'COMPLETED');
  assert.deepEqual(f.calls, { reserved: 1, consumed: 1, released: 0, customer: 1, crm: 1, loyalty: 1, orderCompleted: 1, refundRequired: 0 });
  assert.deepEqual(f.events.map((event) => event.eventType), ['SALE_FLOW_STARTED', 'PAYMENT_CONFIRMED', 'FULFILLMENT_AUTHORIZED', 'DISPENSE_STARTED', 'DISPENSE_SUCCEEDED', 'INVENTORY_CONSUMED', 'SALE_COMPLETED', 'LOYALTY_UPDATED']);
  assert.equal(new Set(f.events.map((event) => event.eventId)).size, f.events.length);
  assert.ok(f.events.every((event) => event.correlationId === 'corr_1'));
  assert.equal(f.events[1].causationId, f.events[0].eventId);
});

test('PAID не завершает продажу и не применяет финальные эффекты', async () => {
  const f = fixture(); const created = await create(f); await f.service.pay(created.orderId, {}, { idempotencyKey: 'paid_only' });
  assert.equal(created.flowState, 'PAYMENT_CONFIRMED'); assert.equal(f.domainOrders.get(created.orderId).status, 'PAID');
  assert.deepEqual({ consumed: f.calls.consumed, customer: f.calls.customer, crm: f.calls.crm, loyalty: f.calls.loyalty }, { consumed: 0, customer: 0, crm: 0, loyalty: 0 });
});

test('повторное создание с одним ключом не создаёт второй заказ и резерв', async () => {
  const f = fixture(); const context = { idempotencyKey: 'same_create' }; const first = await f.service.create(order, context); const second = await f.service.create(order, context);
  assert.equal(first, second); assert.equal(f.repository.listFlows().length, 1); assert.equal(f.calls.reserved, 1);
});

test('создание без idempotency key отклоняется', async () => { const f = fixture(); await assert.rejects(() => f.service.create(order), { code: 'VALIDATION_FAILED' }); });

test('организация и точка определяются по authoritative machine relation', async () => { const f = fixture(); const created = await create(f); assert.equal(created.organizationId, 'org_authoritative'); assert.equal(created.locationId, 'location_authoritative'); });
test('tenant mismatch отклоняется', async () => { const f = fixture(); await assert.rejects(() => create(f, { organizationId: 'org_other' }), { code: 'TENANT_SCOPE_MISMATCH' }); });

test('повторный callback оплаты идемпотентен', async () => {
  const f = fixture(); const created = await create(f); const first = await f.service.pay(created.orderId, {}, { idempotencyKey: 'callback_1' }); const second = await f.service.pay(created.orderId, {}, { idempotencyKey: 'callback_1' });
  assert.equal(first.duplicate, false); assert.equal(second.duplicate, true); assert.equal(f.events.filter((event) => event.eventType === 'PAYMENT_CONFIRMED').length, 1);
});

test('один provider transaction нельзя связать с двумя заказами', async () => {
  const paymentAdapter = { pay: async ({ orderId }) => ({ paymentId: 'provider_tx_1', provider: 'TEST', status: 'PAID', confirmedAt: new Date(), orderId }) };
  const f = fixture({ paymentAdapter }); const first = await create(f); const second = await create(f);
  await f.service.pay(first.orderId, {}, { idempotencyKey: 'provider_callback_1' });
  await assert.rejects(() => f.service.pay(second.orderId, {}, { idempotencyKey: 'provider_callback_2' }), { code: 'PAYMENT_TRANSACTION_CONFLICT' });
});

for (const status of ['DECLINED', 'TIMEOUT', 'CANCELLED']) test(`оплата ${status} не разрешает выдачу и освобождает резерв`, async () => {
  const f = fixture({ payment: status }); const created = await create(f); await f.service.pay(created.orderId, {}, { idempotencyKey: `payment_${status}` });
  assert.equal(created.flowState, 'STOPPED'); assert.equal(f.domainOrders.get(created.orderId).status, 'PAYMENT_FAILED'); assert.equal(f.calls.released, 1); await assert.rejects(() => f.service.authorize(created.orderId), { code: 'FULFILLMENT_NOT_PAID' });
});

for (const status of ['FAILED', 'TIMEOUT', 'OFFLINE', 'UNAVAILABLE', 'BUSY']) test(`результат аппарата ${status} создаёт REFUND_REQUIRED без завершения продажи`, async () => {
  const f = fixture({ machine: status }); const created = await create(f); await f.service.pay(created.orderId, {}, { idempotencyKey: `payment_machine_${status}` }); const token = await f.service.authorize(created.orderId); await f.service.dispense(token.tokenId);
  assert.equal(created.flowState, 'REFUND_REQUIRED'); assert.equal(f.domainOrders.get(created.orderId).status, 'REFUND_REQUIRED'); assert.equal(f.domainOrders.get(created.orderId).paymentStatus, 'paid'); assert.equal(f.calls.consumed, 0); assert.equal(f.calls.loyalty, 0); assert.equal(f.calls.refundRequired, 1); assert.equal(f.events.filter((event) => event.eventType === 'REFUND_REQUIRED').length, 1);
});

for (const status of ['ACCEPTED', 'DISPENSING']) test(`промежуточный результат аппарата ${status} не создаёт ложный успех`, async () => {
  const f = fixture({ machine: status }); const created = await create(f); await f.service.pay(created.orderId, {}, { idempotencyKey: `payment_intermediate_${status}` }); const token = await f.service.authorize(created.orderId); await f.service.dispense(token.tokenId);
  assert.equal(created.flowState, 'DISPENSING'); assert.equal(f.calls.refundRequired, 0); assert.equal(f.calls.consumed, 0); assert.equal(f.calls.loyalty, 0);
});

test('недостаток ингредиентов останавливает заказ до оплаты', async () => { const f = fixture({ available: false }); await assert.rejects(() => create(f), { code: 'INGREDIENTS_INSUFFICIENT' }); assert.equal(f.repository.listFlows().length, 0); });
test('недоступный аппарат останавливает заказ до резерва', async () => { const f = fixture(); f.service.machineAvailability = { isAvailable: async () => false }; await assert.rejects(() => create(f), { code: 'MACHINE_UNAVAILABLE' }); assert.equal(f.calls.reserved, 0); });

test('запрещённые переходы отсутствуют в state machine', () => {
  assert.ok(!TRANSITIONS.STARTED.includes('COMPLETED')); assert.ok(!TRANSITIONS.COMPLETED); assert.ok(!TRANSITIONS.STOPPED); assert.ok(!TRANSITIONS.REFUND_REQUIRED);
});

test('повторное событие DISPENSED не дублирует продажу, склад и лояльность', async () => {
  const f = fixture({ machine: 'ACCEPTED' }); const created = await create(f); await f.service.pay(created.orderId, {}, { idempotencyKey: 'payment_async' }); const token = await f.service.authorize(created.orderId); await f.service.dispense(token.tokenId);
  await f.service.handleMachineResult(created.orderId, { status: 'DISPENSED', commandId: 'command_1' }, { idempotencyKey: 'machine_event_1' }); await f.service.handleMachineResult(created.orderId, { status: 'DISPENSED', commandId: 'command_1' }, { idempotencyKey: 'machine_event_1' });
  assert.deepEqual({ consumed: f.calls.consumed, customer: f.calls.customer, crm: f.calls.crm, loyalty: f.calls.loyalty, orderCompleted: f.calls.orderCompleted }, { consumed: 1, customer: 1, crm: 1, loyalty: 1, orderCompleted: 1 });
});

test('использованный fulfillment token нельзя применить повторно', async () => { const f = fixture(); const created = await create(f); await f.service.pay(created.orderId, {}, { idempotencyKey: 'token_payment' }); const token = await f.service.authorize(created.orderId); await f.service.dispense(token.tokenId); await assert.rejects(() => f.service.dispense(token.tokenId), { code: 'FULFILLMENT_TOKEN_INVALID' }); });

test('истёкший fulfillment token отклоняется', async () => { const f = fixture(); const created = await create(f); await f.service.pay(created.orderId, {}, { idempotencyKey: 'expired_token_payment' }); const token = await f.service.authorize(created.orderId); token.expiresAt = new Date(0); await assert.rejects(() => f.service.dispense(token.tokenId), { code: 'FULFILLMENT_TOKEN_INVALID' }); });

test('admin-представление русскоязычное, полное и помечает тестовый режим', async () => {
  const f = fixture(); const created = await create(f, { correlationId: 'corr_admin' }); const view = presentSaleFlow(created, f.events);
  assert.equal(view.mode, 'Тестовый режим'); assert.equal(view.fields['Заказ'], created.orderId); assert.equal(view.fields['Организация'], 'org_authoritative'); assert.equal(view.fields['Состояние процесса'], 'WAITING_FOR_PAYMENT'); assert.equal(view.eventTimeline.length, 1);
});

test('повторный DISPENSE_FAILED не создаёт второй запрос возврата', async () => {
  const f = fixture({ machine: 'ACCEPTED' }); const created = await create(f); await f.service.pay(created.orderId, {}, { idempotencyKey: 'refund_payment' }); const token = await f.service.authorize(created.orderId); await f.service.dispense(token.tokenId);
  const result = { status: 'FAILED', commandId: 'failed_command' };
  await f.service.handleMachineResult(created.orderId, result, { idempotencyKey: 'failed_event' }); await f.service.handleMachineResult(created.orderId, result, { idempotencyKey: 'failed_event' });
  assert.equal(f.calls.refundRequired, 1); assert.equal(f.calls.released, 1); assert.equal(f.events.filter((event) => event.eventType === 'REFUND_REQUIRED').length, 1);
});
