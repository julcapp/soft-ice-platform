const test = require('node:test');
const assert = require('node:assert/strict');

const { InMemoryOutboxRepository } = require('../src/modules/transactional_outbox/OutboxRepository');
const { OutboxWorker } = require('../src/modules/transactional_outbox/OutboxWorker');
const { CustomerNotificationService, EVENT_TYPE, KIND } = require('../src/modules/customer_notifications/CustomerNotificationService');
const { CustomerNotificationPublisher } = require('../src/modules/customer_notifications/CustomerNotificationPublisher');

function fakePrisma() {
  const customer = {
    id: 'customer_1',
    phone: '+79990000000',
    phoneVerifiedAt: new Date('2026-10-01T00:00:00Z'),
    clubAccount: { availableBalanceRub: 150 },
    bonusAccount: { balanceBonus: 200 },
  };
  const order = {
    id: 'order_1',
    customerId: customer.id,
    amountPaidRub: 120,
    amount: 120,
    currency: 'RUB',
    bonusEarned: 12,
    status: 'COMPLETED',
  };
  return {
    customer: {
      findUnique: async ({ select }) => {
        if (select?.phone) return { phone: customer.phone, phoneVerifiedAt: customer.phoneVerifiedAt };
        return { clubAccount: customer.clubAccount, bonusAccount: customer.bonusAccount };
      },
    },
    order: { findFirst: async () => order },
  };
}

test('recognition sends immediately to a verified Telegram binding', async () => {
  const outbox = new InMemoryOutboxRepository();
  const clock = () => new Date('2026-10-01T10:00:00Z');
  const service = new CustomerNotificationService({ outboxRepository: outbox, clock });
  const sent = [];
  const publisher = new CustomerNotificationPublisher({
    prisma: fakePrisma(),
    notificationService: service,
    bindingService: { resolve: async (_id, channel) => channel === 'telegram' ? { recipientType: 'chat_id', recipientId: '123' } : null },
    telegramClient: { sendMessage: async (id, text, options) => { sent.push({ id, text, options }); return { message_id: 10 }; } },
    miniAppUrl: 'https://app.utimoshi.ru',
  });
  await service.recognitionWelcome('customer_1', { machineId: 'TEST-MACHINE-001', correlationId: 'corr_1' });
  const worker = new OutboxWorker({ repository: outbox, publisher, workerId: 'test', eventType: EVENT_TYPE, clock });
  await worker.runOnce();
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /Баланс: 150,00 ₽/);
  assert.match(sent[0].text, /Бонусы: 200/);
  const all = await outbox.list({}, { platform: true });
  assert.equal(all.filter((x) => x.payload.kind === KIND.SMS_FALLBACK).length, 0);
});

test('without a verified messenger binding SMS fallback is scheduled exactly three hours later', async () => {
  const outbox = new InMemoryOutboxRepository();
  let now = new Date('2026-10-01T10:00:00Z');
  const clock = () => new Date(now);
  const service = new CustomerNotificationService({ outboxRepository: outbox, clock });
  const publisher = new CustomerNotificationPublisher({
    prisma: fakePrisma(),
    notificationService: service,
    bindingService: { resolve: async () => null },
  });
  await service.recognitionWelcome('customer_1', { machineId: 'TEST-MACHINE-001', correlationId: 'corr_2' });
  const worker = new OutboxWorker({ repository: outbox, publisher, workerId: 'test', eventType: EVENT_TYPE, clock });
  await worker.runOnce();
  const all = await outbox.list({}, { platform: true });
  const fallback = all.find((x) => x.payload.kind === KIND.SMS_FALLBACK);
  assert.ok(fallback);
  assert.equal(fallback.availableAt.toISOString(), '2026-10-01T13:00:00.000Z');
});

test('purchase completion notification contains purchase, earned bonus and current balances', async () => {
  const outbox = new InMemoryOutboxRepository();
  const clock = () => new Date('2026-10-01T10:00:00Z');
  const service = new CustomerNotificationService({ outboxRepository: outbox, clock });
  const sent = [];
  const publisher = new CustomerNotificationPublisher({
    prisma: fakePrisma(),
    notificationService: service,
    bindingService: { resolve: async (_id, channel) => channel === 'max' ? { recipientType: 'user_id', recipientId: '456' } : null },
    maxClient: { sendMessage: async (request) => { sent.push(request); return { message: { id: 'm1' } }; } },
  });
  await service.purchaseCompleted('order_1', 'customer_1', { machineId: 'TEST-MACHINE-001' });
  const worker = new OutboxWorker({ repository: outbox, publisher, workerId: 'test', eventType: EVENT_TYPE, clock });
  await worker.runOnce();
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /Покупка мороженого завершена/);
  assert.match(sent[0].text, /Начислено бонусов: 12/);
  assert.match(sent[0].text, /Текущий баланс: 150,00 ₽/);
  assert.match(sent[0].text, /Бонусов всего: 200/);
});
