const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { PostgresInventoryReservationService } = require('../src/modules/inventory');
const { PrismaSaleFlowRepository, SaleFlowService } = require('../src/modules/sale_flow');
const { createRuntimeDependencies } = require('../src/runtimeDependencies');

const enabled = Boolean(process.env.DATABASE_URL);
const pg = enabled ? test : test.skip;
const prisma = enabled ? new PrismaClient() : null;

async function fixture({ repository = new PrismaSaleFlowRepository(prisma), failOrder = false, itemCount = 1 } = {}) {
  const suffix = crypto.randomUUID();
  const organizationId = `org_atomic_${suffix}`; const machineId = `machine_atomic_${suffix}`; const locationId = `location_atomic_${suffix}`;
  const customer = await prisma.customer.create({ data: { id: `customer_atomic_${suffix}`, name: 'Atomic customer' } });
  const items = [];
  for (let index = 0; index < itemCount; index += 1) items.push(await prisma.inventoryRuntimeItem.create({ data: { id: `item_atomic_${index}_${suffix}`, sku: `sku_atomic_${index}_${suffix}`, name: `Atomic item ${index}`, category: 'INGREDIENT', baseUnit: 'portion' } }));
  await prisma.inventoryRuntimeLocation.create({ data: { id: locationId, code: locationId, name: 'Atomic location', locationType: 'MACHINE', machineId } });
  for (const item of items) await prisma.inventoryRuntimeStock.create({ data: { organizationId, machineId, locationId, inventoryItemId: item.id, physicalQuantity: 10 } });
  const inventory = new PostgresInventoryReservationService({ prisma, priceCalculator: async () => ({ totalAmount: 190, currency: 'RUB' }) });
  const orderDomain = { create: async (input, context) => { if (failOrder) throw Object.assign(new Error('injected order failure'), { code: 'INJECTED_ORDER_WRITE' }); const order = await context.transactionClient.order.create({ data: { customerId: input.customerId, status: 'PAYMENT_PENDING', amount: input.totalAmount, currency: input.currency } }); return { ...order, orderId: order.id }; } };
  const service = new SaleFlowService({ repository, inventory, priceCalculator: { calculate: (request) => inventory.calculatePrice(request) }, organizationContext: { resolveByMachine: async () => ({ organizationId, locationId }) }, orderDomain });
  const request = { customerId: customer.id, machineId, product: { baseProductId: 'product', toppingId: 'topping', additionId: 'addition' }, inventoryItems: items.map((item, index) => ({ inventoryItemId: item.id, ingredientType: 'INGREDIENT', quantity: index + 1, unit: 'portion' })) };
  return { suffix, organizationId, machineId, locationId, customer, items, inventory, service, request };
}

async function counts(f) { return { orders: await prisma.order.count({ where: { customerId: f.customer.id } }), reservations: await prisma.inventoryRuntimeReservation.count({ where: { organizationId: f.organizationId } }), reserved: (await prisma.inventoryRuntimeStock.aggregate({ where: { organizationId: f.organizationId }, _sum: { activeReservedQuantity: true } }))._sum.activeReservedQuantity || 0, flows: await prisma.saleFlow.count({ where: { organizationId: f.organizationId } }), outbox: await prisma.transactionalOutboxEvent.count({ where: { organizationId: f.organizationId } }) }; }
test.after(async () => { if (prisma) await prisma.$disconnect(); });

pg('successful multi-item transaction commits Order + Inventory + Sale Flow + Outbox together', async () => {
  const f = await fixture({ itemCount: 2 }); const flow = await f.service.create(f.request, { idempotencyKey: `create_${f.suffix}`, correlationId: `corr_${f.suffix}` });
  assert.equal(f.service.inventory.persistenceMode, 'POSTGRESQL'); assert.ok(flow.inventoryReservationReference); assert.deepEqual(await counts(f), { orders: 1, reservations: 1, reserved: 3, flows: 1, outbox: 3 });
});

pg('production composition exposes one PostgreSQL stock owner and disables legacy stock runtime', async () => {
  const dependencies = createRuntimeDependencies({ config: { environment: 'production', auth: { accessTokenTtlSeconds: 900, telegramBotToken: null, telegramInitDataMaxAgeSeconds: 300 } } }); await dependencies.saleFlowRecoveryReady;
  assert.equal(dependencies.inventoryReservationService.persistenceMode, 'POSTGRESQL');
  assert.equal(dependencies.saleFlowService.inventory, dependencies.inventoryReservationService);
  assert.equal(dependencies.saleFlowService.organizationContext, dependencies.organizationContext);
  assert.equal(dependencies.saleFlowService.orderDomain, dependencies.orderDomain);
  assert.equal(dependencies.saleFlowService.priceCalculator, dependencies.priceCalculator);
  assert.ok([dependencies.organizationContext, dependencies.orderDomain, dependencies.priceCalculator, dependencies.paymentAdapter, dependencies.machineAdapter].every((dependency) => dependency.implementationKind === 'PRODUCTION'));
  assert.equal(dependencies.paymentAdapter.integrationStatus, 'BLOCKED_EXTERNAL');
  assert.equal(dependencies.machineAdapter.integrationStatus, 'BLOCKED_EXTERNAL');
  assert.equal(dependencies.inventoryRuntime.persistenceMode, 'DISABLED_IN_PRODUCTION');
  await assert.rejects(() => dependencies.inventoryRuntime.listBalances({}), { code: 'INVENTORY_POSTGRESQL_REQUIRED' });
});

test('production Sale Flow composition fails closed before any business transaction', () => {
  const { createProductionSaleFlowService } = require('../src/modules/sale_flow'); let transactions = 0;
  const production = { implementationKind: 'PRODUCTION' }; const base = { SaleFlowService, repository: { ...production, transactionWithOutbox: () => { transactions += 1; } }, organizationContext: production, orderDomain: production, priceCalculator: production, paymentAdapter: production, machineAdapter: production, inventory: { ...production } };
  for (const name of ['repository', 'organizationContext', 'orderDomain', 'priceCalculator', 'paymentAdapter', 'machineAdapter', 'inventory']) assert.throws(() => createProductionSaleFlowService({ ...base, [name]: undefined }), { code: 'SALE_FLOW_PRODUCTION_COMPOSITION_INCOMPLETE' });
  assert.equal(transactions, 0);
});

test('production price calculator uses Product Engine and ignores client supplied totals', async () => {
  const { ProductEnginePriceCalculator } = require('../src/modules/sale_flow');
  const [{ default: catalog }, { ConfigurationService }, { RecipeService }] = await Promise.all([import('../../frontend/miniapp/src/domain/catalog/catalogData.js'), import('../../frontend/miniapp/src/domain/configuration/ConfigurationService.js'), import('../../frontend/miniapp/src/domain/recipe/RecipeService.js')]);
  const product = catalog.products[0]; const configuration = new ConfigurationService().buildConfiguration({ productId: product.id, syrupId: product.allowedSyrups[0], toppingId: product.allowedToppings[0], extras: [] }); const recipe = new RecipeService().buildRecipe(configuration);
  const result = await new ProductEnginePriceCalculator().calculate({ product: { ...product, totalAmount: 1 }, configuration, recipe, quantity: 2, totalAmount: 1 });
  assert.deepEqual(result, { totalAmount: 260, currency: 'RUB', unitPrice: 130 });
});

pg('Sale Flow failure rolls back Order + Inventory', async () => {
  class FailingRepository extends PrismaSaleFlowRepository { transactionWithOutbox(callback) { return this.prisma.$transaction((raw) => { const tx = new PrismaSaleFlowRepository(raw); tx.create = async () => { throw Object.assign(new Error('injected sale write failure'), { code: 'INJECTED_SALE_WRITE' }); }; return callback(tx); }); } }
  const f = await fixture({ repository: new FailingRepository(prisma) });
  await assert.rejects(() => f.service.create(f.request, { idempotencyKey: `create_${f.suffix}`, correlationId: `corr_${f.suffix}` }), { code: 'INJECTED_SALE_WRITE' });
  assert.deepEqual(await counts(f), { orders: 0, reservations: 0, reserved: 0, flows: 0, outbox: 0 });
});

pg('Outbox failure rolls back Order + Inventory + Sale Flow', async () => {
  const f = await fixture(); const key = `create_${f.suffix}`;
  await prisma.transactionalOutboxEvent.create({ data: { eventId: `event_seed_${f.suffix}`, eventType: 'TEST', aggregateType: 'TEST', aggregateId: 'seed', organizationId: 'other', payload: {}, idempotencyKey: `sale-flow:sale-create:${key}:SALE_CREATED` } });
  await assert.rejects(() => f.service.create(f.request, { idempotencyKey: key, correlationId: `corr_${f.suffix}` }));
  assert.deepEqual(await counts(f), { orders: 0, reservations: 0, reserved: 0, flows: 0, outbox: 0 });
});

pg('Inventory failure rolls back Order', async () => {
  const f = await fixture(); await prisma.inventoryRuntimeStock.deleteMany({ where: { organizationId: f.organizationId } });
  await assert.rejects(() => f.service.create(f.request, { idempotencyKey: `create_${f.suffix}`, correlationId: `corr_${f.suffix}` }), { code: 'INVENTORY_STOCK_NOT_FOUND' });
  assert.deepEqual(await counts(f), { orders: 0, reservations: 0, reserved: 0, flows: 0, outbox: 0 });
});

pg('Order failure writes no Inventory, Sale Flow or Outbox state', async () => { const f = await fixture({ failOrder: true }); await assert.rejects(() => f.service.create(f.request, { idempotencyKey: `create_${f.suffix}` }), { code: 'INJECTED_ORDER_WRITE' }); assert.deepEqual(await counts(f), { orders: 0, reservations: 0, reserved: 0, flows: 0, outbox: 0 }); });

test('PostgreSQL Sale Flow fails closed without a durable Inventory adapter', async () => {
  const repository = { persistenceMode: 'POSTGRESQL', getIdempotencyKey: async () => null };
  const service = new SaleFlowService({ repository, inventory: { checkAndReserve: async () => ({ available: true }) }, organizationContext: { resolveByMachine: async () => ({ organizationId: 'org', locationId: 'location' }) } });
  await assert.rejects(() => service.create({ customerId: 'customer', machineId: 'machine', product: { baseProductId: 'p', toppingId: 't', additionId: 'a' } }, { idempotencyKey: 'key' }), { code: 'INVENTORY_DURABLE_ADAPTER_UNAVAILABLE' });
});
