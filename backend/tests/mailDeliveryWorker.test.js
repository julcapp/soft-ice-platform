const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MailDeliveryWorker,
  extractSmtpCode,
} = require('../src/modules/mail_delivery/MailDeliveryWorker');

function fakeRepository(deliveries) {
  const state = {
    recovered: [],
    claimed: [],
    sent: [],
    failed: [],
  };

  return {
    state,
    async recoverStaleSending(input) {
      state.recovered.push(input);
      return { count: 0 };
    },
    async listCandidates() {
      return deliveries;
    },
    async claim(delivery, now) {
      state.claimed.push({ delivery, now });
      return delivery.claimable !== false;
    },
    async markSent(id, data) {
      state.sent.push({ id, data });
    },
    async markFailed(id, data) {
      state.failed.push({ id, data });
    },
  };
}

test('mail worker sends pending delivery to explicit recipient and marks SENT', async () => {
  const now = new Date('2026-11-03T08:00:00.000Z');
  const repository = fakeRepository([{
    id: 'delivery-1',
    status: 'PENDING',
    attemptCount: 0,
    recipientAddress: 'customer@example.com',
    customer: { email: null },
    subject: 'Подтверждение',
    body: 'Откройте ссылку',
    correlationId: 'corr-1',
  }]);
  const sent = [];

  const worker = new MailDeliveryWorker({
    repository,
    clock: () => now,
    sendMail: async (message) => {
      sent.push(message);
      return { messageId: '<msg-1@utimoshi.ru>', providerResponse: '250 accepted' };
    },
  });

  const stats = await worker.runOnce();

  assert.equal(stats.sent, 1);
  assert.equal(stats.failed, 0);
  assert.equal(sent[0].to, 'customer@example.com');
  assert.equal(repository.state.sent[0].id, 'delivery-1');
  assert.equal(repository.state.sent[0].data.providerId, '<msg-1@utimoshi.ru>');
  assert.equal(repository.state.sent[0].data.providerResponse, '250 accepted');
});

test('mail worker falls back to verified customer email when recipientAddress is absent', async () => {
  const repository = fakeRepository([{
    id: 'delivery-2',
    status: 'PENDING',
    attemptCount: 0,
    recipientAddress: null,
    customer: { email: 'verified@example.com' },
    subject: 'Уведомление',
    body: 'Текст',
  }]);
  let recipient = null;

  const worker = new MailDeliveryWorker({
    repository,
    sendMail: async (message) => {
      recipient = message.to;
      return {};
    },
  });

  await worker.runOnce();
  assert.equal(recipient, 'verified@example.com');
});

test('mail worker records SMTP code and schedules first retry after one minute', async () => {
  const now = new Date('2026-11-03T08:00:00.000Z');
  const repository = fakeRepository([{
    id: 'delivery-3',
    status: 'PENDING',
    attemptCount: 0,
    recipientAddress: 'customer@example.com',
    customer: { email: null },
    subject: 'Подтверждение',
    body: 'Текст',
  }]);

  const worker = new MailDeliveryWorker({
    repository,
    clock: () => now,
    logger: { warn() {} },
    sendMail: async () => {
      throw new Error('SMTP error 550: 550 rejected');
    },
  });

  const stats = await worker.runOnce();

  assert.equal(stats.failed, 1);
  assert.equal(repository.state.failed[0].data.failureReason, 'SMTP_550');
  assert.equal(
    repository.state.failed[0].data.nextAttemptAt.toISOString(),
    '2026-11-03T08:01:00.000Z',
  );
});

test('mail worker stops automatic retries after max attempt', async () => {
  const now = new Date('2026-11-03T08:00:00.000Z');
  const repository = fakeRepository([{
    id: 'delivery-4',
    status: 'FAILED',
    attemptCount: 4,
    recipientAddress: 'customer@example.com',
    customer: { email: null },
    subject: 'Подтверждение',
    body: 'Текст',
  }]);

  const worker = new MailDeliveryWorker({
    repository,
    clock: () => now,
    maxAttempts: 5,
    logger: { warn() {} },
    sendMail: async () => {
      throw new Error('connection reset');
    },
  });

  await worker.runOnce();

  assert.equal(repository.state.failed[0].data.nextAttemptAt, null);
  assert.equal(repository.state.failed[0].data.failureReason, 'SMTP_DELIVERY_FAILED');
});

test('mail worker skips delivery that another worker already claimed', async () => {
  const repository = fakeRepository([{
    id: 'delivery-5',
    status: 'PENDING',
    attemptCount: 0,
    claimable: false,
    recipientAddress: 'customer@example.com',
    customer: { email: null },
    subject: 'Подтверждение',
    body: 'Текст',
  }]);
  let transportCalls = 0;

  const worker = new MailDeliveryWorker({
    repository,
    sendMail: async () => {
      transportCalls += 1;
      return {};
    },
  });

  const stats = await worker.runOnce();

  assert.equal(stats.skipped, 1);
  assert.equal(transportCalls, 0);
});

test('mail worker always asks repository to recover stale SENDING deliveries', async () => {
  const now = new Date('2026-11-03T08:00:00.000Z');
  const repository = fakeRepository([]);

  const worker = new MailDeliveryWorker({
    repository,
    clock: () => now,
    staleSendingMs: 300000,
    sendMail: async () => ({}),
  });

  await worker.runOnce();

  assert.equal(repository.state.recovered.length, 1);
  assert.equal(
    repository.state.recovered[0].before.toISOString(),
    '2026-11-03T07:55:00.000Z',
  );
});

test('extractSmtpCode parses SMTP provider response', () => {
  assert.equal(extractSmtpCode(new Error('SMTP error 421: temporary failure')), 421);
  assert.equal(extractSmtpCode(new Error('socket timeout')), null);
});
