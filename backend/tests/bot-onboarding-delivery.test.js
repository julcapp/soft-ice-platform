const test = require('node:test');
const assert = require('node:assert/strict');
const { BotOnboardingService } = require('../src/modules/bot_core/BotOnboardingService');
const { TelegramBotApiClient } = require('../src/modules/bot_core/TelegramBotApiClient');
const { BotRuntime, TelegramAdapter, TelegramRenderer, BotTransportSender } = require('../src/modules/bot_core');

for (const verified of [false, true]) {
  test(`real onboarding produces a nonempty Telegram payload, verified=${verified}`, async () => {
    let context;
    let payload;
    const onboardingService = new BotOnboardingService({
      miniAppUrl: 'https://example.test/app',
      customerService: { resolveOrCreateTelegramCustomer: async (_identity, value) => {
        context = value;
        return { customer: { id: 'customer', phone: verified ? '+79990000000' : null, phoneVerifiedAt: verified ? new Date() : null }, created: false };
      } },
    });
    const client = new TelegramBotApiClient({ token: 'test', fetchImpl: async (_url, request) => {
      payload = JSON.parse(request.body);
      assert.equal(typeof payload.text, 'string');
      assert.ok(payload.text.trim());
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 1 } }) };
    } });
    const runtime = new BotRuntime({
      adapters: { telegram: new TelegramAdapter() }, renderers: { telegram: new TelegramRenderer() },
      onboardingService, actionRouter: { route: async () => { throw new Error('Unexpected action'); } },
      customerResolver: { resolve: async () => ({ customerId: 'customer' }) },
      sender: new BotTransportSender({ telegramClient: client }),
    });
    await runtime.handle('telegram', { update_id: 162175230, message: { text: '/start', from: { id: 7 }, chat: { id: 7, type: 'private' } } });
    assert.equal(context.correlationId, '162175230');
    assert.equal(payload.chat_id, '7');
    assert.match(payload.text, /Добро пожаловать/);
    const buttons = (payload.reply_markup.inline_keyboard || payload.reply_markup.keyboard).flat();
    assert.ok(buttons.some((button) => button.web_app?.url === 'https://example.test/app'));
    assert.equal(buttons.some((button) => button.callback_data === 'action:club'), verified);
    assert.equal(buttons.some((button) => button.request_contact), !verified);
  });
}

test('audit correlation preserves zero and missing values', () => {
  const service = new BotOnboardingService();
  assert.equal(service.toCustomerContext({ channel: 'telegram', metadata: { updateId: 0 } }).correlationId, '0');
  assert.equal(service.toCustomerContext({ channel: 'telegram' }).correlationId, null);
});
