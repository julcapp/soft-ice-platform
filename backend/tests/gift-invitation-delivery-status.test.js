'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { GiftTransferService } = require('../src/modules/gift_transfer/GiftTransferService');
const {
  NotificationOrchestrator,
  TelegramNotificationAdapter,
  MaxNotificationAdapter,
} = require('../src/modules/gift_transfer/NotificationOrchestrator');

test('invitation remains CREATED when every real delivery channel is unavailable', async () => {
  const events = [];
  const state = { invitation: null, deliveries: [] };
  const repository = {
    findByOrderId: async () => null,
    async createGiftBundle(bundle) { state.invitation = { ...bundle.invitation }; },
    async saveDelivery(row) { state.deliveries.push(row); return row; },
    async saveInvitation(value) { state.invitation = { ...value }; return value; },
  };
  const order = {
    id: 'order-1', customerId: 'sender', status: 'PAID', paymentStatus: 'paid',
    expiresAt: new Date('2026-09-03T10:00:00Z'),
  };
  const orchestrator = new NotificationOrchestrator({
    repository,
    adapters: [new TelegramNotificationAdapter(), new MaxNotificationAdapter()],
    clock: () => new Date('2026-09-02T10:00:00Z'),
  });
  const service = new GiftTransferService({
    repository,
    orderRepository: {
      findByIdForCustomer: async () => order,
      reserveForGift: async () => ({ ...order, status: 'GIFT_TRANSFERRED' }),
    },
    customerRepository: {
      findById: async () => ({ id: 'sender', name: 'Александр', phone: '+79990000001' }),
      findByVerifiedPhone: async () => ({ id: 'recipient', phone: '+79990000002', phoneVerified: true }),
    },
    clubAccountRuntime: {},
    notificationOrchestrator: orchestrator,
    eventPublisher: { async publish(event) { events.push(event); return event; } },
    clock: () => new Date('2026-09-02T10:00:00Z'),
    tokenFactory: () => 'server-only-token',
  });

  const result = await service.createGift('sender', 'order-1', { recipientPhone: '+79990000002' }, { correlationId: 'corr-1' });
  assert.equal(result.invitation.status, 'CREATED');
  assert.deepEqual(result.deliveries.map((row) => row.status), ['UNAVAILABLE', 'UNAVAILABLE']);
  assert.equal(events.some((event) => event.type === 'GIFT_INVITATION_SENT'), false);
});

test('production outbox mode atomically queues a registered recipient without calling providers', async () => {
  let bundle;
  let providerCalls = 0;
  const now = new Date('2026-09-02T10:00:00Z');
  const order = { id: 'order-2', customerId: 'sender', machineId: 'machine-1', status: 'PAID', paymentStatus: 'paid', expiresAt: new Date('2026-09-03T10:00:00Z') };
  const service = new GiftTransferService({
    repository: {
      findByOrderId: async () => null,
      async createGiftBundle(value) { bundle = value; },
    },
    orderRepository: {
      findByIdForCustomer: async () => order,
      reserveForGift: async () => ({ ...order, status: 'GIFT_TRANSFERRED' }),
    },
    customerRepository: {
      findById: async () => ({ id: 'sender', name: 'Александр', phone: '+79990000001' }),
      findByVerifiedPhone: async () => ({ id: 'recipient', phone: '+79990000002', phoneVerified: true }),
    },
    clubAccountRuntime: {},
    notificationOrchestrator: { async send() { providerCalls += 1; return []; } },
    eventPublisher: { async publish(event) { return event; } },
    clock: () => now,
    tokenFactory: () => 'server-only-token',
    notificationDeliveryMode: 'OUTBOX',
    outboxMaxAttempts: 8,
  });

  const result = await service.createGift('sender', 'order-2', { recipientPhone: '+79990000002' }, { correlationId: 'corr-2' });

  assert.equal(providerCalls, 0);
  assert.equal(result.deliveryQueued, true);
  assert.equal(result.invitation.status, 'CREATED');
  assert.equal(bundle.outboxEvent.eventType, 'GIFT_INVITATION_DELIVERY_REQUESTED');
  assert.equal(bundle.outboxEvent.organizationId, null);
  assert.equal(bundle.outboxEvent.machineId, 'machine-1');
  assert.equal(bundle.outboxEvent.maxAttempts, 8);
  assert.equal(JSON.stringify(bundle.outboxEvent.payload).includes('server-only-token'), false);
  assert.equal(JSON.stringify(bundle.outboxEvent.payload).includes('+79990000002'), false);
});
