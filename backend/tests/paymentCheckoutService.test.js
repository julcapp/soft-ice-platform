const test = require('node:test');
const assert = require('node:assert/strict');
const { PaymentCheckoutService } = require('../src/modules/payment/PaymentCheckoutService');

function basePayment(overrides = {}) {
  return {
    id: 'pay_1',
    organizationId: 'org_1',
    orderId: 'order_1',
    saleFlowId: 'flow_1',
    customerId: 'customer_1',
    provider: 'YOOKASSA',
    providerPaymentId: null,
    idempotencyKey: 'idem_1',
    status: 'CREATED',
    amount: '95.00',
    currency: 'RUB',
    channel: 'TERMINAL',
    confirmationUrl: null,
    paymentMethodType: null,
    incomeAmount: null,
    ...overrides,
  };
}

function setup({ remoteCreate, remoteStatus, remoteRefund, remoteRefundStatus } = {}) {
  let payment = basePayment();
  let refund = null;
  const inboxes = new Map();
  const calls = [];

  const repository = {
    async update(_org, _id, data) { payment = { ...payment, ...data }; return { count: 1 }; },
    async getById() { return { ...payment }; },
    async updateRefund(_org, _id, data) { refund = { ...refund, ...data }; return { count: 1 }; },
    async getRefund() { return refund ? { ...refund, payment: { ...payment } } : null; },
    async findInbox(provider, providerEventId) { return inboxes.get(provider + ':' + providerEventId) || null; },
    async createInbox(data) { const row = { id: 'inbox_1', ...data }; inboxes.set(data.provider + ':' + data.providerEventId, row); return row; },
  };

  const paymentService = {
    async createPayment() { calls.push('createPayment'); return { payment: { ...payment }, duplicate: false }; },
    async markPending(_org, _id, request) { calls.push('markPending'); payment = { ...payment, status: 'PENDING', providerPaymentId: request.providerPaymentId || payment.providerPaymentId, providerStatus: request.providerStatus || 'pending' }; return { payment: { ...payment }, duplicate: false }; },
    async transition(request) { calls.push('transition:' + request.to); payment = { ...payment, status: request.to }; return { payment: { ...payment }, duplicate: false }; },
    async confirmPayment() { calls.push('confirmPayment'); payment = { ...payment, status: 'SUCCEEDED' }; return { payment: { ...payment }, duplicate: false }; },
    async cancelPayment() { calls.push('cancelPayment'); payment = { ...payment, status: 'CANCELED' }; return { payment: { ...payment }, duplicate: false }; },
    async requestRefund(request) {
      calls.push('requestRefund');
      refund = {
        id: 'refund_1',
        organizationId: request.organizationId,
        paymentId: request.paymentId,
        providerRefundId: null,
        idempotencyKey: request.idempotencyKey,
        status: 'REQUESTED',
        amount: String(request.amount || '95.00'),
        currency: 'RUB',
        reason: request.reason,
      };
      payment = { ...payment, status: 'REFUND_PENDING' };
      return { refund: { ...refund }, duplicate: false };
    },
    async processInbox(inbox) {
      calls.push('processInbox');
      if (inbox.payload.refundStatus === 'SUCCEEDED') {
        refund = { ...refund, status: 'SUCCEEDED', succeededAt: new Date() };
        payment = { ...payment, status: 'REFUNDED' };
      } else {
        refund = { ...refund, status: 'FAILED', failedAt: new Date(), failureCode: inbox.payload.failureCode };
        payment = { ...payment, status: 'SUCCEEDED' };
      }
      inbox.status = 'PROCESSED';
      return { refund: { ...refund }, payment: { ...payment } };
    },
  };

  const provider = {
    async createPayment() {
      calls.push('provider.createPayment');
      return remoteCreate || {
        providerPaymentId: 'yk_1',
        status: 'PENDING',
        rawStatus: 'pending',
        paid: false,
        amount: '95.00',
        currency: 'RUB',
        confirmationUrl: 'https://yookassa.test/pay/1',
        paymentMethodType: 'sbp',
        incomeAmount: null,
        metadata: { payment_id: 'pay_1', order_id: 'order_1' },
      };
    },
    async getPaymentStatus() {
      calls.push('provider.getPaymentStatus');
      return remoteStatus || {
        providerPaymentId: 'yk_1',
        status: 'PENDING',
        rawStatus: 'pending',
        paid: false,
        amount: '95.00',
        currency: 'RUB',
        metadata: { payment_id: 'pay_1', order_id: 'order_1' },
      };
    },
    async refundPayment(request) {
      calls.push('provider.refundPayment');
      return remoteRefund || {
        providerRefundId: 'yr_1',
        providerPaymentId: 'yk_1',
        status: 'PENDING',
        amount: String(request.amount),
        currency: request.currency,
      };
    },
    async getRefund() {
      calls.push('provider.getRefund');
      return remoteRefundStatus || {
        providerRefundId: 'yr_1',
        providerPaymentId: 'yk_1',
        status: 'PENDING',
        amount: '95.00',
        currency: 'RUB',
      };
    },
  };

  const service = new PaymentCheckoutService({
    paymentService,
    repository,
    providers: { YOOKASSA: provider },
    clock: () => new Date('2026-10-06T10:00:00Z'),
  });

  return {
    service,
    calls,
    setPayment(value) { payment = { ...payment, ...value }; },
    getPayment() { return payment; },
    getRefund() { return refund; },
  };
}

test('initiate creates provider payment and remains pending until provider confirms', async () => {
  const ctx = setup();
  const result = await ctx.service.initiate({
    organizationId: 'org_1',
    orderId: 'order_1',
    provider: 'YOOKASSA',
    idempotencyKey: 'idem_1',
    returnUrl: 'https://display.utimoshi.ru/payment/return',
    channel: 'TERMINAL',
    method: 'sbp',
  });

  assert.equal(result.status, 'PENDING');
  assert.equal(result.userState, 'PENDING');
  assert.equal(result.confirmationUrl, 'https://yookassa.test/pay/1');
  assert.deepEqual(ctx.calls.slice(0, 3), ['createPayment', 'provider.createPayment', 'markPending']);
});

test('refresh rejects succeeded status unless YooKassa also confirms paid=true', async () => {
  const ctx = setup({
    remoteStatus: {
      providerPaymentId: 'yk_1',
      status: 'SUCCEEDED',
      rawStatus: 'succeeded',
      paid: false,
      amount: '95.00',
      currency: 'RUB',
      metadata: { payment_id: 'pay_1', order_id: 'order_1' },
    },
  });
  ctx.setPayment({ providerPaymentId: 'yk_1', status: 'PENDING' });

  await assert.rejects(
    ctx.service.refreshPayment({ organizationId: 'org_1', paymentId: 'pay_1' }),
    { code: 'PAYMENT_PROVIDER_PAID_FLAG_MISMATCH' },
  );
  assert.equal(ctx.calls.includes('confirmPayment'), false);
});

test('refresh confirms authoritative payment only after verified succeeded and paid=true', async () => {
  const ctx = setup({
    remoteStatus: {
      providerPaymentId: 'yk_1',
      status: 'SUCCEEDED',
      rawStatus: 'succeeded',
      paid: true,
      amount: '95.00',
      currency: 'RUB',
      incomeAmount: '92.00',
      paymentMethodType: 'sbp',
      metadata: { payment_id: 'pay_1', order_id: 'order_1' },
    },
  });
  ctx.setPayment({ providerPaymentId: 'yk_1', status: 'PENDING' });

  const result = await ctx.service.refreshPayment({ organizationId: 'org_1', paymentId: 'pay_1' });
  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(result.userState, 'SUCCESS');
  assert.equal(ctx.calls.includes('confirmPayment'), true);
  assert.equal(ctx.getPayment().incomeAmount, '92.00');
});

test('refund is submitted and then independently rechecked through provider GET', async () => {
  const ctx = setup({
    remoteRefundStatus: {
      providerRefundId: 'yr_1',
      providerPaymentId: 'yk_1',
      status: 'SUCCEEDED',
      amount: '40.00',
      currency: 'RUB',
      failureCode: null,
    },
  });
  ctx.setPayment({ providerPaymentId: 'yk_1', status: 'SUCCEEDED' });

  const result = await ctx.service.submitRefund({
    organizationId: 'org_1',
    paymentId: 'pay_1',
    idempotencyKey: 'refund-idem-1',
    amount: '40.00',
    reason: 'Возврат части заказа',
    receipt: {
      customer: { phone: '79138207050' },
      items: [{
        description: 'Мороженое У Тимоши',
        quantity: '1.00',
        amount: { value: '40.00', currency: 'RUB' },
        vat_code: 1,
        payment_mode: 'full_payment',
        payment_subject: 'commodity',
      }],
    },
  });

  assert.equal(ctx.calls.includes('provider.refundPayment'), true);
  assert.equal(ctx.calls.includes('provider.getRefund'), true);
  assert.equal(ctx.calls.includes('processInbox'), true);
  assert.equal(result.refund.status, 'SUCCEEDED');
});


test('partial refund without fiscal receipt is rejected before local refund state changes', async () => {
  const ctx = setup();
  ctx.setPayment({ providerPaymentId: 'yk_1', status: 'SUCCEEDED' });

  await assert.rejects(
    ctx.service.submitRefund({
      organizationId: 'org_1',
      paymentId: 'pay_1',
      idempotencyKey: 'refund-no-receipt',
      amount: '40.00',
      reason: 'Частичный возврат',
    }),
    { code: 'REFUND_RECEIPT_REQUIRED' },
  );

  assert.equal(ctx.calls.includes('requestRefund'), false);
  assert.equal(ctx.calls.includes('provider.refundPayment'), false);
  assert.equal(ctx.getPayment().status, 'SUCCEEDED');
  assert.equal(ctx.getRefund(), null);
});
