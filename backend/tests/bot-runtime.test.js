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
        return { title: 'РљР»СѓР± РўРёРјРѕС€Рё', text: 'РўРµСЃС‚', actions: [{ type: 'action', label: 'РќР°Р·Р°Рґ', action: 'menu' }] };
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
  assert.equal(result.destination.userId, '10');
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

test('runtime observes a trusted private Telegram recipient after customer resolution', async () => {
  const observed = [];
  const runtime = new BotRuntime({
    adapters: { telegram: new TelegramAdapter() },
    renderers: { telegram: new TelegramRenderer() },
    customerResolver: { resolve: async () => ({ customerId: 'customer-1' }) },
    recipientBindingService: { observeInbound: async (value) => observed.push(value) },
    actionRouter: { route: async () => ({ title: 'РњРµРЅСЋ', text: 'РўРµСЃС‚', actions: [] }) },
    sender: new BotTransportSender(),
  });
  await runtime.handle('telegram', {
    update_id: 2,
    message: { text: 'РњРµРЅСЋ', from: { id: 12345 }, chat: { id: 12345, type: 'private' } },
  });
  assert.deepEqual(observed, [{
    customerId: 'customer-1',
    channel: 'telegram',
    externalUserId: '12345',
    metadata: { chatId: '12345', chatType: 'private', updateId: 2 },
  }]);
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


test('MAX ordinary start opens Club menu and does not invoke onboarding', async () => {
  const routed = [];
  let onboardingCalls = 0;
  const runtime = new BotRuntime({
    adapters: { max: new MaxAdapter() },
    renderers: { max: new MaxRenderer() },
    customerResolver: { resolve: async () => ({ customerId: 'customer-1' }) },
    onboardingService: { start: async () => { onboardingCalls += 1; throw new Error('ordinary MAX start must not use onboarding'); } },
    actionRouter: {
      route: async (input) => {
        routed.push(input);
        return { title: 'РљР»СѓР± РўРёРјРѕС€Рё', text: 'Р“Р»Р°РІРЅРѕРµ РјРµРЅСЋ', actions: [] };
      },
    },
    sender: new BotTransportSender(),
  });

  const result = await runtime.handle('max', {
    update_type: 'bot_started',
    user: { user_id: 101 },
    chat_id: 202,
  });

  assert.equal(onboardingCalls, 0);
  assert.equal(routed.length, 1);
  assert.equal(routed[0].action, 'menu');
  assert.equal(result.view.title, 'РљР»СѓР± РўРёРјРѕС€Рё');
});

test('MAX verification deep link starts terminal challenge and renders personal-data consent gate', async () => {
  const started = [];
  const routed = [];
  const runtime = new BotRuntime({
    adapters: { max: new MaxAdapter() },
    renderers: { max: new MaxRenderer() },
    customerResolver: { resolve: async () => ({ customerId: null, customer: null }) },
    terminalChannelChallengeService: {
      start: async (input) => { started.push(input); return { id: 'challenge-1' }; },
    },
    actionRouter: {
      route: async (input) => {
        routed.push(input);
        return { title: 'РњРµРЅСЋ', text: 'РќРµ РґРѕР»Р¶РЅРѕ РІС‹Р·С‹РІР°С‚СЊСЃСЏ', actions: [] };
      },
    },
    sender: new BotTransportSender(),
  });

  const token = 'abcdefghijklmnopqrstuvwx';
  const result = await runtime.handle('max', {
    update_type: 'bot_started',
    user: { user_id: 303 },
    chat_id: 404,
    payload: 'verify_' + token,
  });

  assert.deepEqual(started, [{ channel: 'max', token, externalUserId: '303' }]);
  assert.equal(routed.length, 0);
  assert.equal(result.view.actions[0].type, 'open_url');
  assert.equal(result.view.actions[1].action, 'verify_pdn:' + token);
  assert.equal(result.rendered.attachments[0].payload.buttons[0][0].type, 'link');
  assert.equal(result.rendered.attachments[0].payload.buttons[1][0].payload, 'action:verify_pdn:' + token);
});


test('MAX personal-data consent callback unlocks request_contact for the same challenge', async () => {
  const granted = [];
  const runtime = new BotRuntime({
    adapters: { max: new MaxAdapter() },
    renderers: { max: new MaxRenderer() },
    customerResolver: { resolve: async () => ({ customerId: null, customer: null }) },
    terminalChannelChallengeService: {
      grantPersonalDataConsent: async (input) => { granted.push(input); return { id: 'challenge-1' }; },
    },
    actionRouter: { route: async () => ({ title: 'Меню', text: 'Меню', actions: [] }) },
    sender: new BotTransportSender(),
  });

  const token = 'abcdefghijklmnopqrstuvwx';
  const result = await runtime.handle('max', {
    callback: { payload: 'action:verify_pdn:' + token },
    sender: { user_id: 303 },
    chat_id: 404,
  });

  assert.deepEqual(granted, [{ channel: 'max', token, externalUserId: '303' }]);
  assert.equal(result.view.actions[0].type, 'request_contact');
  assert.equal(result.rendered.attachments[0].payload.buttons[0][0].type, 'request_contact');
});
