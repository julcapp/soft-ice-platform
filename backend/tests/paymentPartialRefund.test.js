const test = require('node:test');
const assert = require('node:assert/strict');
const { PaymentService } = require('../src/modules/payment/PaymentService');

class MemoryPaymentRepository {
  constructor(state) {
    this.state = state;
    this.prisma = this.makeTx();
  }

  makeTx() {
    const state = this.state;
    return {
      payment: {
        findFirst: async ({ where }) => state.payment.id === where.id && state.payment.organizationId === where.organizationId ? { ...state.payment } : null,
        update: async ({ where, data }) => {
          if (where.id !== state.payment.id) throw new Error('payment not found');
          state.payment = { ...state.payment, ...data };
          return { ...state.payment };
        },
      },
      paymentRefund: {
        findFirst: async ({ where, include }) => {
          const item = state.refunds.find((row) => {
            if (where.id && row.id !== where.id) return false;
            if (where.organizationId && row.organizationId !== where.organizationId) return false;
            if (where.paymentId && row.paymentId !== where.paymentId) return false;
            if (where.status?.in && !where.status.in.includes(row.status)) return false;
            return true;
          });
          if (!item) return null;
          return include?.payment ? { ...item, payment: { ...state.payment } } : { ...item };
        },
        aggregate: async ({ where }) => {
          const sum = state.refunds
            .filter((row) => row.organizationId === where.organizationId && row.paymentId === where.paymentId && (!where.status || row.status === where.status))
            .reduce((acc, row) => acc + Number(row.amount), 0);
          return { _sum: { amount: sum } };
        },
        update: async ({ where, data }) => {
          const index = state.refunds.findIndex((row) => row.id === where.id);
          state.refunds[index] = { ...state.refunds[index], ...data };
          return { ...state.refunds[index] };
        },
        findUnique: async ({ where }) => {
          const row = state.refunds.find((item) => item.id === where.id);
          return row ? { ...row } : null;
        },
      },
      paymentProviderInbox: {
        findFirst: async ({ where }) => state.inbox.find((item) => item.organizationId === where.organizationId && item.providerEventId === where.providerEventId && item.paymentId === where.paymentId) || null,
      },
    };
  }

  async transaction(callback) {
    const tx = this.makeTx();
    return callback(this, tx);
  }

  async findRefundOperation(organizationId, idempotencyKey) {
    return this.state.refunds.find((row) => row.organizationId === organizationId && row.idempotencyKey === idempotencyKey) || null;
  }

  async createRefund(data) {
    const row = { id: 'refund_' + (this.state.refunds.length + 1), requestedAt: new Date(), ...data };
    this.state.refunds.push(row);
    return { ...row };
  }

  async audit() { return {}; }
  async outbox() { return {}; }
}

test('multiple partial refunds keep payment succeeded until full amount is returned', async () => {
  const state = {
    payment: {
      id: 'pay_1',
      organizationId: 'org_1',
      orderId: 'order_1',
      saleFlowId: 'flow_1',
      provider: 'YOOKASSA',
      providerPaymentId: 'yk_1',
      idempotencyKey: 'pay-idem',
      status: 'SUCCEEDED',
      amount: '95.00',
      currency: 'RUB',
    },
    refunds: [],
    inbox: [],
  };

  const repository = new MemoryPaymentRepository(state);
  const service = new PaymentService({ repository, providers: {} });

  const first = await service.requestRefund({
    organizationId: 'org_1',
    paymentId: 'pay_1',
    idempotencyKey: 'refund-40',
    amount: '40.00',
    reason: 'Частичный возврат',
  });
  assert.equal(state.payment.status, 'REFUND_PENDING');

  state.inbox.push({
    organizationId: 'org_1',
    paymentId: 'pay_1',
    providerEventId: 'event_1',
  });
  await service.completeRefund({
    organizationId: 'org_1',
    refundId: first.refund.id,
    idempotencyKey: 'complete-40',
    providerRefundId: 'yr_1',
    providerEventId: 'event_1',
  });
  assert.equal(state.payment.status, 'SUCCEEDED');
  assert.equal(state.refunds[0].status, 'SUCCEEDED');

  const second = await service.requestRefund({
    organizationId: 'org_1',
    paymentId: 'pay_1',
    idempotencyKey: 'refund-55',
    amount: '55.00',
    reason: 'Возврат остатка',
  });
  assert.equal(state.payment.status, 'REFUND_PENDING');

  state.inbox.push({
    organizationId: 'org_1',
    paymentId: 'pay_1',
    providerEventId: 'event_2',
  });
  await service.completeRefund({
    organizationId: 'org_1',
    refundId: second.refund.id,
    idempotencyKey: 'complete-55',
    providerRefundId: 'yr_2',
    providerEventId: 'event_2',
  });

  assert.equal(state.payment.status, 'REFUNDED');
  assert.equal(state.refunds[1].status, 'SUCCEEDED');
});
