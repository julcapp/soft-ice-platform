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
