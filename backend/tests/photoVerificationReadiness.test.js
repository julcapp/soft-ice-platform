const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PhotoVerificationReadinessService } = require('../src/modules/photo_verification');

const admin = { role: 'ADMIN' };
function service(settings, env = {}, databaseReady = true) {
  return new PhotoVerificationReadinessService({
    repository: { getSettings: async () => settings },
    prisma: { $queryRaw: async () => { if (!databaseReady) throw new Error('db down'); return [{ '?column?': 1 }]; } },
    env,
    clock: () => new Date('2026-08-22T16:00:00Z'),
  });
}

test('readiness is READY only when enabled production path is fully configured', async () => {
  const result = await service({ enabled: true, mode: 'ai_assisted', publishingEnabled: true, requiredChannels: ['VK','TELEGRAM','MAX'], rewardBonusUnits: 25 }, {
    PHOTO_CAPTURE_CHALLENGE_SECRET: 'secret', OPENAI_API_KEY: 'key', PHOTO_VISION_MODEL: 'model',
    VK_ACCESS_TOKEN: 'vk', TELEGRAM_BOT_TOKEN: 'tg', MAX_BOT_TOKEN: 'max', MAX_CHANNEL_CHAT_ID: 'chat',
  }).getStatus(admin);
  assert.equal(result.status, 'READY');
  assert.equal(result.checks.filter((x) => x.required && !x.ready).length, 0);
});

test('readiness is BLOCKED when enabled flow misses required provider configuration', async () => {
  const result = await service({ enabled: true, mode: 'ai_assisted', publishingEnabled: true, requiredChannels: ['VK','TELEGRAM','MAX'], rewardBonusUnits: 25 }, {
    PHOTO_CAPTURE_CHALLENGE_SECRET: 'secret', VK_ACCESS_TOKEN: 'vk', TELEGRAM_BOT_TOKEN: 'tg', MAX_BOT_TOKEN: 'max',
  }).getStatus(admin);
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.reasons.some((x) => x.includes('OPENAI_API_KEY')));
  assert.ok(result.reasons.some((x) => x.includes('MAX_CHANNEL_CHAT_ID')));
});

test('readiness is DEGRADED for intentionally disabled module and unconfigured reward', async () => {
  const result = await service({ enabled: false, mode: 'manual_only', publishingEnabled: false, requiredChannels: ['VK','TELEGRAM','MAX'], rewardBonusUnits: null }, {}).getStatus(admin);
  assert.equal(result.status, 'DEGRADED');
  assert.ok(result.reasons.some((x) => x.includes('выключен')));
});

test('database failure always blocks readiness', async () => {
  const result = await service({ enabled: false, mode: 'manual_only', publishingEnabled: false }, {}, false).getStatus(admin);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.checks.find((x) => x.code === 'database').status, 'BLOCKED');
});

test('readiness requires administrator role', async () => {
  await assert.rejects(() => service({ enabled: false }, {}).getStatus({ role: 'OPERATOR' }), (error) => error.code === 'PHOTO_READINESS_FORBIDDEN');
});
