const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { MiniAppPreorderService } = require('../src/modules/order/MiniAppPreorderService');
const { PaymentService } = require('../src/modules/payment/PaymentService');
const { authenticateTestBuyer } = require('../src/api/v1/miniAppTestPreorderRoutes');

function signed(token, userId, authDate = Math.floor(Date.now() / 1000)) {
  const values = { auth_date: String(authDate), user: JSON.stringify({ id: userId }) };
  const check = Object.keys(values).sort().map(k => `${k}=${values[k]}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  return new URLSearchParams({ ...values, hash: crypto.createHmac('sha256', secret).update(check).digest('hex') }).toString();
}

test('TEST signature, allowlist and verified identity are all required', async () => {
  const config = { botToken: 'synthetic-test-key', allowedUserIds: new Set(['123']) };
  const prisma = { customerIdentity: { findMany: async query => {
    assert.ok(query.where.externalSubjectHash.in.includes(crypto.createHash('sha256').update('123').digest('hex')));
    return [{ verifiedAt: new Date(), customer: { id: 'buyer', status: 'active' } }];
  } } };
  assert.equal((await authenticateTestBuyer(prisma, signed(config.botToken, 123), config)).id, 'buyer');
  await assert.rejects(authenticateTestBuyer(prisma, signed('wrong-key', 123), config));
  await assert.rejects(authenticateTestBuyer(prisma, signed(config.botToken, 124), config), { code: 'PREORDER_TEST_BUYER_DENIED' });
  await assert.rejects(authenticateTestBuyer(prisma, signed(config.botToken, 123) + '&auth_date=1', config), { code: 'PREORDER_AUTH_INVALID' });
  await assert.rejects(authenticateTestBuyer(prisma, signed(config.botToken, 123, Math.floor(Date.now()/1000) + 600), config), { code: 'PREORDER_AUTH_INVALID' });
  prisma.customerIdentity.findMany = async () => [{ verifiedAt: new Date(), customer: { id: 'buyer' } }, { verifiedAt: new Date(), customer: { id: 'different' } }];
  await assert.rejects(authenticateTestBuyer(prisma, signed(config.botToken, 123), config), { code: 'PREORDER_IDENTITY_CONFLICT' });
  prisma.customerIdentity.findMany = async () => [];
  await assert.rejects(authenticateTestBuyer(prisma, signed(config.botToken, 123), config), { code: 'PREORDER_VERIFIED_PROFILE_REQUIRED' });
});

test('another customer cannot start payment or trigger a provider refresh', async () => {
  let providerCalled = false;
  const service = new MiniAppPreorderService({ prisma: { order: { findFirst: async () => null } },
    paymentCheckoutService: { initiate: () => { providerCalled = true; }, refreshPayment: () => { providerCalled = true; } } });
  await assert.rejects(service.pay({ id: 'other' }, 'order'), { code: 'PREORDER_NOT_FOUND' });
  await assert.rejects(service.status({ id: 'other' }, 'order'), { code: 'PREORDER_NOT_FOUND' });
  assert.equal(providerCalled, false);
});

test('payment requires a verified test shop and rejects live or mismatched settings', async () => {
  let started = 0;
  let settings;
  const adapter = { shopId: '1369882', isConfigured: () => true, request: async path => { assert.equal(path, '/me'); return settings; } };
  const service = new MiniAppPreorderService({ prisma: {
    order: { findFirst: async () => ({ id: 'order', status: 'PAYMENT_PENDING', machineId: 'TEST-MACHINE-001' }) },
    saleFlow: { findFirst: async () => ({ flowId: 'flow', organizationId: 'org', metadata: { sourceChannel: 'MINIAPP', fulfillmentMode: 'PICKUP' } }) },
  }, paymentCheckoutService: { providers: { YOOKASSA: adapter }, initiate: async () => {
    started++; return { payment: { id: 'payment' }, confirmationUrl: 'https://yoomoney.ru/checkout', status: 'PENDING' };
  } } });
  const valid = { account_id: '1369882', test: true, status: 'enabled', payment_methods: ['bank_card'] };
  for (const patch of [{ test: false }, { account_id: 'other' }, { status: 'disabled' }, { payment_methods: [] }]) {
    settings = { ...valid, ...patch };
    await assert.rejects(service.pay({ id: 'buyer' }, 'order'), { code: 'PREORDER_TEST_SHOP_REQUIRED' });
  }
  assert.equal(started, 0);
  settings = valid;
  assert.equal((await service.pay({ id: 'buyer' }, 'order')).paymentId, 'payment');
  assert.equal(started, 1);
});

test('expired quote is rejected before order and flow writes', async () => {
  let written = false;
  const quote = { id: 'quote', customerId: 'buyer', channel: 'MINI_APP', machineId: 'TEST-MACHINE-001',
    lockedUntil: new Date(0), snapshot: { id: 'snapshot' }, finalAmount: 5 };
  const tx = { $queryRawUnsafe: async () => [], pricingQuote: { findUnique: async () => quote },
    saleFlow: { findFirst: async () => null },
    order: { create: async () => { written = true; } } };
  const service = new MiniAppPreorderService({ prisma: { pricingQuote: tx.pricingQuote, $transaction: fn => fn(tx) },
    organizationContext: { resolveByMachine: async () => ({ organizationId: 'org', locationId: 'location' }) } });
  await assert.rejects(service.create({ id: 'buyer' }, { quoteId: 'quote', idempotencyKey: 'a-key-at-least-16-chars' }), { code: 'PREORDER_QUOTE_EXPIRED' });
  assert.equal(written, false);
});

test('account reads only owned server orders and does not invent paid amounts or balances', async () => {
  const service = new MiniAppPreorderService({ prisma: {
    order: { findMany: async query => { assert.deepEqual(query.where, { customerId: 'buyer' }); return [
      { id: 'unverified', status: 'PAID', amount: 5, currency: 'RUB' },
      { id: 'paid', status: 'PAID', amount: 7, currency: 'RUB', payment: { status: 'SUCCEEDED', amount: 7 } },
      { id: 'refunded', status: 'PAID', amount: 5, currency: 'RUB', payment: { status: 'REFUNDED', amount: 5 } },
    ]; } },
    clubAccount: { findUnique: async () => null }, bonusAccount: { findUnique: async () => null },
  } });
  const account = await service.account({ id: 'buyer' }, {filter:'all'});
  assert.equal(account.clubBalance, null); assert.equal(account.bonusBalance, null);
  assert.deepEqual(account.orders.map(order => order.paidAmount), [null, 7, null]);
});

test('history paginates on the server and keeps refund filtering scoped to its owner', async () => {
  let query;
  const service = new MiniAppPreorderService({ prisma: {
    order: { findMany: async input => { query = input; return Array.from({ length: 11 }, (_, id) => ({ id, amount: 5 })); } },
    clubAccount: { findUnique: async () => null }, bonusAccount: { findUnique: async () => null },
  } });
  const result = await service.account({ id: 'buyer' }, { filter: 'refunded', page: 2 });
  assert.deepEqual(query.where, { customerId: 'buyer', payment: { is: { status: 'REFUNDED' } } });
  assert.equal(query.skip, 20); assert.equal(query.take, 11);
  assert.equal(result.orders.length, 10); assert.equal(result.hasMore, true);
  await assert.rejects(service.account({ id: 'buyer' }, { page: -1 }), { code: 'PREORDER_HISTORY_FILTER_INVALID' });
});

test('confirmed advance payment leaves no dispense command and starts 72 hours at payment', async () => {
  const calls = [];
  const paidAt = new Date('2026-10-13T10:00:00Z');
  const flow = { flowId: 'flow', organizationId: 'org', currentState: 'AWAITING_PAYMENT',
    metadata: { sourceChannel: 'MINIAPP', fulfillmentMode: 'PICKUP' } };
  const tx = { order: { updateMany: async () => ({ count: 1 }), update: async args => calls.push(['order', args]) },
    saleFlow: { findFirst: async () => flow, update: async args => { calls.push(['flow', args]); return flow; } } };
  const service = new PaymentService({ machineDispense: { createAuthorizedFromPaidFlow: async () => calls.push(['dispense']) } });
  await service.applySuccess(tx, { orderId: 'order', saleFlowId: 'flow', organizationId: 'org', amount: 5 }, paidAt);
  assert.equal(calls.some(x => x[0] === 'dispense'), false);
  assert.equal(calls.find(x => x[0] === 'order')[1].data.expiresAt.toISOString(), '2026-10-16T10:00:00.000Z');
  assert.equal(calls.at(-1)[1].data.recoveryStatus, 'NONE');
});

test('terminal purchase still authorizes dispense after payment', async () => {
  let dispensed = false;
  const flow = { flowId: 'flow', currentState: 'AWAITING_PAYMENT', metadata: {} };
  const tx = { order: { updateMany: async () => ({ count: 1 }) },
    saleFlow: { findFirst: async () => flow, update: async () => flow } };
  const service = new PaymentService({ machineDispense: { createAuthorizedFromPaidFlow: async () => { dispensed = true; } } });
  await service.applySuccess(tx, { orderId: 'order', saleFlowId: 'flow', amount: 5 }, new Date());
  assert.equal(dispensed, true);
});


test('default account selects only paid unreceived orders with bank confirmation and future pickup deadline',async()=>{
 const now=new Date('2026-10-16T10:00:00Z');let query;
 const service=new MiniAppPreorderService({clock:()=>now,prisma:{order:{findMany:async q=>{query=q;return [];}},clubAccount:{findUnique:async()=>null},bonusAccount:{findUnique:async()=>null}}});
 const result=await service.account({id:'buyer'});
 assert.equal(result.filter,'active');assert.deepEqual(query.where,{customerId:'buyer',status:'PAID',payment:{is:{status:'SUCCEEDED'}},expiresAt:{gt:now}});
});
