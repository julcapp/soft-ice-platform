const test = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const {
  SaleFlowService,
  PrismaSaleFlowRepository,
  SimulatorPaymentAdapter,
  SimulatorMachineAdapter,
} = require('../src/modules/sale_flow');

const hasDatabase = Boolean(process.env.DATABASE_URL);
const postgresTest = hasDatabase ? test : test.skip;
const prisma = hasDatabase ? new PrismaClient() : null;
let sequence = 0;

function dependencies(repository, machineOutcome = 'DISPENSED') {
  const calls = { complete: 0, consume: 0, refund: 0, loyalty: 0 };
  const service = new SaleFlowService({
    repository,
    paymentAdapter: new SimulatorPaymentAdapter(),
    machineAdapter: new SimulatorMachineAdapter({ outcome: machineOutcome }),
    organizationContext: { resolveByMachine: async () => ({ organizationId: 'org_pg', locationId: 'location_pg' }) },
    inventory: {
      checkAndReserve: async () => ({ available: true, reservationId: 'reservation_pg' }),
      calculatePrice: async () => ({ totalAmount: 190, currency: 'RUB' }),
      consume: async () => { calls.consume += 1; },
      release: async () => {},
    },
    orderDomain: {
      create: async (input) => ({ ...input, orderId: `order_pg_${++sequence}` }),
      getPaymentDetails: async () => ({ amount: 190, currency: 'RUB' }),
      confirmPayment: async () => {},
      rejectPayment: async () => {},
      getFulfillmentDetails: async () => ({}),
      complete: async () => { calls.complete += 1; },
      requireRefund: async () => { calls.refund += 1; },
    },
    loyalty: { registerPurchase: async () => { calls.loyalty += 1; } },
  });
  return { repository, service, calls };
}

function fixture(machineOutcome = 'DISPENSED') {
  return dependencies(new PrismaSaleFlowRepository(prisma), machineOutcome);
}

async function restart(machineOutcome = 'DISPENSED') {
  await prisma.$disconnect();
  const restartedClient = new PrismaClient();
  return {
    client: restartedClient,
    ...dependencies(new PrismaSaleFlowRepository(restartedClient), machineOutcome),
  };
}

async function create(f, suffix = `${++sequence}`) {
  return f.service.create({
    customerId: 'customer_pg',
    machineId: 'machine_pg',
    product: {
      baseProductId: 'product_pg',
      toppingId: 'topping_pg',
      additionId: 'syrup_pg',
    },
  }, {
    idempotencyKey: `create_pg_${suffix}`,
    correlationId: `corr_pg_${suffix}`,
  });
}

test.before(async () => {
  if (!hasDatabase) return;
  await prisma.saleFlowIdempotencyKey.deleteMany();
  await prisma.saleFlow.deleteMany();
});

test.after(async () => {
  if (prisma) await prisma.$disconnect();
});

postgresTest('PostgreSQL repository health and transaction support', async () => {
  const f = fixture();
  assert.deepEqual(await f.service.health(), {
    status: 'HEALTHY', repository: 'POSTGRESQL', readable: true, writable: true, transactional: true,
  });
});

postgresTest('optimistic concurrency permits exactly one concurrent transition', async () => {
  const f = fixture();
  const flow = await create(f);
  const results = await Promise.allSettled([
    f.repository.compareAndSetState(flow.flowId, flow.version, 'PAID'),
    f.repository.compareAndSetState(flow.flowId, flow.version, 'PAID'),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected' && result.reason.code === 'SALE_FLOW_VERSION_CONFLICT').length, 1);
});

postgresTest('PAID persists after recreation of Prisma client, repository, and service', async () => {
  const f = fixture();
  const flow = await create(f);
  await f.service.pay(flow.orderId, {}, { idempotencyKey: `payment_${flow.orderId}` });
  const restarted = await restart();
  assert.equal((await restarted.repository.getByOrderId(flow.orderId)).currentState, 'PAID');
  await restarted.client.$disconnect();
});

postgresTest('duplicate payment callback after restart is persistently idempotent', async () => {
  const f = fixture();
  const flow = await create(f);
  const key = `payment_${flow.orderId}`;
  await f.service.pay(flow.orderId, {}, { idempotencyKey: key });
  const before = await f.repository.getByOrderId(flow.orderId);
  const restarted = await restart();
  const replay = await restarted.service.pay(flow.orderId, {}, { idempotencyKey: key });
  assert.equal(replay.duplicate, true);
  assert.equal((await restarted.repository.getByOrderId(flow.orderId)).version, before.version);
  await restarted.client.$disconnect();
});

postgresTest('FULFILLMENT_AUTHORIZED is SAFE_TO_RESUME after restart', async () => {
  const f = fixture();
  const flow = await create(f);
  await f.service.pay(flow.orderId, {}, { idempotencyKey: `payment_${flow.orderId}` });
  await f.service.authorize(flow.orderId);
  const restarted = await restart();
  await restarted.service.recover();
  assert.equal((await restarted.repository.getByOrderId(flow.orderId)).recoveryStatus, 'SAFE_TO_RESUME');
  await restarted.client.$disconnect();
});

postgresTest('DISPENSING is NEEDS_RECONCILIATION after restart', async () => {
  const f = fixture();
  const flow = await create(f);
  await f.service.pay(flow.orderId, {}, { idempotencyKey: `payment_${flow.orderId}` });
  const token = await f.service.authorize(flow.orderId);
  f.service.machineAdapter = new SimulatorMachineAdapter({ outcome: 'ACCEPTED' });
  await f.service.dispense(token.tokenId);
  const restarted = await restart();
  await restarted.service.recover();
  assert.equal((await restarted.repository.getByOrderId(flow.orderId)).recoveryStatus, 'NEEDS_RECONCILIATION');
  await restarted.client.$disconnect();
});

postgresTest('COMPLETED remains terminal and duplicate DISPENSED creates no repeated completion', async () => {
  const f = fixture();
  const flow = await create(f);
  await f.service.pay(flow.orderId, {}, { idempotencyKey: `payment_${flow.orderId}` });
  const token = await f.service.authorize(flow.orderId);
  await f.service.dispense(token.tokenId);
  const restarted = await restart();
  await restarted.service.handleMachineResult(flow.orderId, {
    status: 'DISPENSED', commandId: `sim_dispense_${flow.orderId}`,
  }, { idempotencyKey: `sim_dispense_${flow.orderId}` });
  assert.equal((await restarted.repository.getByOrderId(flow.orderId)).currentState, 'COMPLETED');
  assert.equal(restarted.calls.complete, 0);
  assert.equal(restarted.calls.consume, 0);
  assert.equal(restarted.calls.loyalty, 0);
  await restarted.client.$disconnect();
});

postgresTest('REFUND_REQUIRED and duplicate FAILED marker persist after restart', async () => {
  const f = fixture('FAILED');
  const flow = await create(f);
  await f.service.pay(flow.orderId, {}, { idempotencyKey: `payment_${flow.orderId}` });
  const token = await f.service.authorize(flow.orderId);
  await f.service.dispense(token.tokenId);
  const restarted = await restart('FAILED');
  assert.equal((await restarted.repository.getByOrderId(flow.orderId)).currentState, 'REFUND_REQUIRED');
  await restarted.service.handleMachineResult(flow.orderId, {
    status: 'FAILED', commandId: `sim_dispense_${flow.orderId}`,
  }, { idempotencyKey: `sim_dispense_${flow.orderId}` });
  assert.equal(restarted.calls.refund, 0);
  await restarted.client.$disconnect();
});
