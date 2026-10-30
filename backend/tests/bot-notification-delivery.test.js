'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TelegramNotificationAdapter,
  MaxNotificationAdapter,
  NotificationOrchestrator,
} = require('../src/modules/gift_transfer/NotificationOrchestrator');

const notification = {
  id: 'notification-1',
  recipientCustomerId: 'customer-1',
  channels: ['TELEGRAM', 'MAX'],
  title: 'Вам подарили мороженое 🎁',
  senderName: 'Александр',
  actionToken: 'must-never-leave-the-server',
  correlationId: 'corr-1',
};

test('Telegram and MAX deliver through encrypted bindings without exposing action token', async () => {
  const calls = [];
  const bindingService = {
    async resolve(customerId, channel) {
      return channel === 'telegram'
        ? { recipientType: 'chat_id', recipientId: '12345' }
        : { recipientType: 'user_id', recipientId: '67890' };
    },
  };
  const telegram = new TelegramNotificationAdapter({
    enabled: true, bindingService, miniAppUrl: 'https://app.utimoshi.ru',
    client: { async sendMessage(...args) { calls.push({ channel: 'telegram', args }); return { message_id: 11 }; } },
  });
  const max = new MaxNotificationAdapter({
    enabled: true, bindingService, miniAppUrl: 'https://app.utimoshi.ru',
    client: { async sendMessage(input) { calls.push({ channel: 'max', input }); return { message: { mid: '22' } }; } },
  });
  const repository = { async saveDelivery(row) { return row; } };
  const rows = await new NotificationOrchestrator({ repository, adapters: [telegram, max] }).send(notification);
  assert.deepEqual(rows.map((row) => row.status), ['SENT', 'SENT']);
  assert.deepEqual(rows.map((row) => row.providerMessageId), ['11', '22']);
  assert.equal(calls[0].args[0], '12345');
  assert.equal(calls[1].input.userId, '67890');
  assert.match(calls[0].args[1], /Александр/);
  assert.equal(JSON.stringify(calls).includes(notification.actionToken), false);
});

test('disabled and unbound channels fail closed without provider calls', async () => {
  let providerCalls = 0;
  const disabled = new TelegramNotificationAdapter({
    enabled: false,
    bindingService: { resolve: async () => ({ recipientType: 'chat_id', recipientId: '1' }) },
    client: { async sendMessage() { providerCalls += 1; } },
  });
  const unbound = new MaxNotificationAdapter({
    enabled: true,
    bindingService: { resolve: async () => null },
    client: { async sendMessage() { providerCalls += 1; } },
  });
  assert.deepEqual(await disabled.send(notification), { status: 'UNAVAILABLE', failureCode: 'TELEGRAM_GIFT_NOTIFICATIONS_DISABLED' });
  assert.deepEqual(await unbound.send(notification), { status: 'UNAVAILABLE', failureCode: 'MAX_RECIPIENT_NOT_BOUND' });
  assert.equal(providerCalls, 0);
});
