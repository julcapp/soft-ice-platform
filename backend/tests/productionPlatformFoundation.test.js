const assert = require('assert/strict');
const { test } = require('node:test');
const express = require('express');
const { createConfig } = require('../src/config');
const { createHealthRouter } = require('../src/common/http/healthRouter');
const { StructuredLogger } = require('../src/platform/observability/Logger');
const { METRICS, MetricsRegistry } = require('../src/platform/observability/MetricsRegistry');

test('production configuration validates required secrets and typed flags', () => {
  assert.throws(() => createConfig({ NODE_ENV: 'production' }), /DATABASE_URL, TELEGRAM_BOT_TOKEN/);
  const config = createConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://database/app', TELEGRAM_BOT_TOKEN: 'secret', FEATURE_PAYMENTS_ENABLED: 'true', PORT: '8080' });
  assert.equal(config.http.port, 8080);
  assert.equal(config.features.paymentsEnabled, true);
});

test('gift notification worker fails closed without an enabled delivery channel', () => {
  assert.throws(() => createConfig({ NODE_ENV: 'test', GIFT_NOTIFICATION_OUTBOX_WORKER_ENABLED: 'true' }), /GIFT_NOTIFICATIONS_TELEGRAM_ENABLED or GIFT_NOTIFICATIONS_MAX_ENABLED/);
  const config = createConfig({
    NODE_ENV: 'test',
    GIFT_NOTIFICATION_OUTBOX_WORKER_ENABLED: 'true',
    GIFT_NOTIFICATIONS_MAX_ENABLED: 'true',
    MAX_TEST_BOT_TOKEN: 'test-only-token',
    BOT_RECIPIENT_ENCRYPTION_KEY: 'test-only-encryption-key',
  });
  assert.equal(config.botNotifications.outbox.workerEnabled, true);
  assert.equal(config.botNotifications.outbox.maxAttempts, 8);
  assert.equal(config.botNotifications.providerTimeoutMs, 15000);
  assert.throws(() => createConfig({
    NODE_ENV: 'test',
    GIFT_NOTIFICATION_OUTBOX_WORKER_ENABLED: 'true',
    GIFT_NOTIFICATIONS_MAX_ENABLED: 'true',
    MAX_TEST_BOT_TOKEN: 'test-only-token',
    BOT_RECIPIENT_ENCRYPTION_KEY: 'test-only-encryption-key',
    BOT_PROVIDER_TIMEOUT_MS: '60000',
    GIFT_NOTIFICATION_OUTBOX_LEASE_MS: '60000',
  }), /Combined bot provider timeout budget must be less/);
  assert.throws(() => createConfig({
    NODE_ENV: 'test',
    GIFT_NOTIFICATION_OUTBOX_WORKER_ENABLED: 'true',
    GIFT_NOTIFICATIONS_TELEGRAM_ENABLED: 'true',
    GIFT_NOTIFICATIONS_MAX_ENABLED: 'true',
    TELEGRAM_TEST_BOT_TOKEN: 'telegram-test-only-token',
    MAX_TEST_BOT_TOKEN: 'max-test-only-token',
    BOT_RECIPIENT_ENCRYPTION_KEY: 'test-only-encryption-key',
    BOT_PROVIDER_TIMEOUT_MS: '30000',
    GIFT_NOTIFICATION_OUTBOX_LEASE_MS: '60000',
  }), /Combined bot provider timeout budget must be less/);
});

test('health separates liveness from database and Prisma readiness', async (t) => {
  const app = express();
  app.use('/health', createHealthRouter({ databaseCheck: async () => ({ ok: false, status: 'unavailable', provider: 'postgresql' }) }));
  const server = await new Promise((resolve) => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${baseUrl}/health/live`)).status, 200);
  const ready = await fetch(`${baseUrl}/health/ready`);
  assert.equal(ready.status, 503);
  const payload = await ready.json();
  assert.equal(payload.checks.database.ok, false);
  assert.equal(payload.checks.prisma.ok, false);
});

test('structured logger emits JSON and metrics cover platform domains', () => {
  let output = '';
  const logger = new StructuredLogger({ destination: { write: (value) => { output += value; } }, clock: () => new Date('2026-07-21T00:00:00.000Z') });
  logger.payment('observed', { payment_id: 'payment_1' });
  assert.equal(JSON.parse(output).event, 'payment.observed');
  const metrics = new MetricsRegistry();
  for (const name of [METRICS.ORDERS, METRICS.PAYMENTS, METRICS.MACHINE_STATUS, METRICS.INVENTORY, METRICS.TELEGRAM_SESSIONS]) metrics.gauge(name, 0);
  assert.equal(metrics.snapshot().length, 5);
});
