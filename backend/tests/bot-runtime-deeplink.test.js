const test = require('node:test');
const assert = require('node:assert/strict');
const { BotRuntime, TelegramAdapter, TelegramRenderer, BotTransportSender } = require('../src/modules/bot_core');

test('telegram start payload is parsed and passed as onboarding context', async () => {
  let session;
  const runtime = new BotRuntime({
    adapters: { telegram: new TelegramAdapter() },
    renderers: { telegram: new TelegramRenderer() },
    actionRouter: { route: async () => ({ text: 'menu', actions: [] }) },
    onboardingService: { start: async (value) => { session = value; return { text: 'ok', actions: [] }; } },
    customerResolver: { resolve: async () => ({ customerId: null }) },
    sender: new BotTransportSender(),
  });
  await runtime.handle('telegram', { update_id: 1, message: { text: '/start ref_ABC123', from: { id: 7 }, chat: { id: 7 } } });
  assert.equal(session.context.source, 'referral');
  assert.equal(session.context.referralCode, 'ABC123');
});

test('machine QR start payload reaches onboarding context', async () => {
  let session;
  const runtime = new BotRuntime({
    adapters: { telegram: new TelegramAdapter() },
    renderers: { telegram: new TelegramRenderer() },
    actionRouter: { route: async () => ({ text: 'menu', actions: [] }) },
    onboardingService: { start: async (value) => { session = value; return { text: 'ok', actions: [] }; } },
    customerResolver: { resolve: async () => ({ customerId: null }) },
    sender: new BotTransportSender(),
  });
  await runtime.handle('telegram', { update_id: 2, message: { text: '/start m_VM041', from: { id: 8 }, chat: { id: 8 } } });
  assert.equal(session.context.source, 'machine_qr');
  assert.equal(session.context.machineId, 'VM041');
});
