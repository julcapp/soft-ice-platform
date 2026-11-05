const test = require('node:test');
const assert = require('node:assert/strict');

const { EmailDeliveryWorker, parseBackoff, normalizeEmail } = require('../src/modules/mail_delivery/EmailDeliveryWorker');
const { buildMessage } = require('../src/modules/mail_delivery/SmtpTransport');

test('email delivery worker sends claimed PENDING message and marks SENT', async () => {
  let claims = 0;
  const updates = [];
  const prisma = {
    $queryRawUnsafe: async (sql) => {
      if (sql.includes('WITH candidate')) {
        claims += 1;
        if (claims > 1) return [];
        return [{
          id: 'delivery-1',
          customerId: 'customer-1',
          subject: 'Подтвердите email',
          body: 'Откройте ссылку',
          recipientAddress: 'User@Example.com',
          attemptCount: 1,
          correlationId: 'corr-1',
          idempotencyKey: 'idem-1',
        }];
      }
      return [];
    },
    $executeRawUnsafe: async (...args) => { updates.push(args); return 1; },
  };
  const sent = [];
  const worker = new EmailDeliveryWorker({
    prisma,
    transport: {
      send: async (message) => {
        sent.push(message);
        return { messageId: 'provider-1', response: '250 queued as <provider-1>' };
      },
    },
    batchSize: 5,
    clock: () => new Date('2026-11-05T10:00:00.000Z'),
  });

  const result = await worker.runOnce();
  assert.equal(result.sent, 1);
  assert.equal(result.failed, 0);
  assert.equal(sent[0].to, 'user@example.com');
  assert.match(updates[0][0], /"status"='SENT'/);
  assert.equal(updates[0][2], 'provider-1');
});

test('email delivery worker schedules retry with backoff after SMTP failure', async () => {
  let claims = 0;
  const updates = [];
  const now = new Date('2026-11-05T10:00:00.000Z');
  const prisma = {
    $queryRawUnsafe: async (sql) => {
      if (sql.includes('WITH candidate')) {
        claims += 1;
        return claims === 1 ? [{
          id: 'delivery-2',
          customerId: 'customer-2',
          subject: 'Test',
          body: 'Body',
          recipientAddress: 'user@example.com',
          attemptCount: 2,
        }] : [];
      }
      return [];
    },
    $executeRawUnsafe: async (...args) => { updates.push(args); return 1; },
  };
  const error = new Error('temporary smtp failure');
  error.code = 'SMTP_451';

  const worker = new EmailDeliveryWorker({
    prisma,
    transport: { send: async () => { throw error; } },
    batchSize: 2,
    maxAttempts: 6,
    backoffSeconds: [60, 300, 1800],
    clock: () => now,
  });

  const result = await worker.runOnce();
  assert.equal(result.failed, 1);
  assert.match(updates[0][0], /"status"='FAILED'/);
  assert.equal(updates[0][2], 'SMTP_451');
  assert.equal(updates[0][4].toISOString(), '2026-11-05T10:05:00.000Z');
});

test('mail helpers validate addresses and build Reply-To header', () => {
  assert.equal(normalizeEmail(' USER@Example.COM '), 'user@example.com');
  assert.equal(normalizeEmail('broken-address'), null);
  assert.deepEqual(parseBackoff('60,300,1800'), [60, 300, 1800]);

  const message = buildMessage({
    from: 'no-reply@utimoshi.ru',
    to: 'customer@example.com',
    subject: 'Проверка',
    body: 'line one\n.line two',
    replyTo: 'support@utimoshi.ru',
  });
  assert.match(message, /Reply-To: <support@utimoshi\.ru>/);
  assert.match(message, /line one\r\n\.\.line two/);
});
