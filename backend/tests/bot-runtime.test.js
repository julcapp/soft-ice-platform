const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BotRuntime,
  BotTransportSender,
  TelegramAdapter,
  MaxAdapter,
  TelegramRenderer,
  MaxRenderer,
} = require('../src/modules/bot_core');
const { createBotWebhookHandlers } = require('../src/api/botWebhookHandlers');

function buildRuntime(channel, update, routed = []) {
  const adapters = { telegram: new TelegramAdapter(), max: new MaxAdapter() };
  const renderers = { telegram: new TelegramRenderer(), max: new MaxRenderer() };
  return new BotRuntime({
    adapters,
    renderers,
    customerResolver: { resolve: async () => ({ customerId: 'customer-1' }) },
    actionRouter: {
      route: async (input) => {
        routed.push(input);
        return { title: 'Клуб Тимоши', text: 'Тест', actions: [{ type: 'action', label: 'Назад', action: 'menu' }] };
      },
    },
    sender: new BotTransportSender(),
  });
}

test('Telegram callback is normalized, routed and rendered', async () => {
  const routed = [];
  const update = { update_id: 1, callback_query: { id: 'cb1', data: 'action:club', from: { id: 10 }, message: { chat: { id: 20 } } } };
  const runtime = buildRuntime('telegram', update, routed);
  const result = await runtime.handle('telegram', update);
  assert.equal(routed[0].action, 'club');
  assert.equal(routed[0].customerId, 'customer-1');
  assert.equal(result.destination.chatId, '20');
  assert.equal(result.rendered.reply_markup.inline_keyboard[0][0].callback_data, 'action:menu');
  assert.equal(result.result.sent, false);
});

test('MAX callback is normalized, routed and rendered', async () => {
  const routed = [];
  const update = { callback: { payload: 'action:referral' }, sender: { user_id: 11 }, chat_id: 21 };
  const runtime = buildRuntime('max', update, routed);
  const result = await runtime.handle('max', update);
  assert.equal(routed[0].action, 'referral');
  assert.equal(result.destination.chatId, 21);
  assert.equal(result.rendered.attachments[0].type, 'inline_keyboard');
  assert.equal(result.result.sent, false);
});

test('Webhook handler acknowledges successful update', async () => {
  const botRuntime = { handle: async (channel) => ({ channel }) };
  const handlers = createBotWebhookHandlers({ botRuntime, logger: { error() {} } });
  const response = await handlers.handleTelegram({ body: { update_id: 1 } }, null);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
});

test('Webhook handler returns 500 when runtime fails', async () => {
  const botRuntime = { handle: async () => { throw new Error('boom'); } };
  const handlers = createBotWebhookHandlers({ botRuntime, logger: { error() {} } });
  const response = await handlers.handleMax({ body: {} }, null);
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.ok, false);
});
