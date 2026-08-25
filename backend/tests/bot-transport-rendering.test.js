const test = require('node:test');
const assert = require('node:assert/strict');
const { TelegramRenderer, MaxRenderer, BotActionRouter } = require('../src/modules/bot_core');

test('Telegram renderer converts shared actions to inline keyboard', () => {
  const renderer = new TelegramRenderer();
  const result = renderer.renderView({
    title: 'Мой клуб',
    text: 'Баланс: 500 ₽',
    actions: [
      { type: 'action', label: 'Пригласить друга', action: 'referral' },
      { type: 'open_url', label: 'Открыть Mini App', url: 'https://app.utimoshi.ru' },
    ],
  });
  assert.match(result.text, /Мой клуб/);
  assert.equal(result.reply_markup.inline_keyboard[0][0].callback_data, 'action:referral');
  assert.equal(result.reply_markup.inline_keyboard[1][0].url, 'https://app.utimoshi.ru');
});

test('MAX renderer converts same shared actions to inline keyboard attachments', () => {
  const renderer = new MaxRenderer();
  const result = renderer.renderView({
    title: 'Мой клуб',
    text: 'Баланс: 500 ₽',
    actions: [
      { type: 'action', label: 'Пригласить друга', action: 'referral' },
      { type: 'open_url', label: 'Открыть Mini App', url: 'https://app.utimoshi.ru' },
    ],
  });
  const buttons = result.attachments[0].payload.buttons;
  assert.equal(buttons[0][0].payload, 'action:referral');
  assert.equal(buttons[1][0].url, 'https://app.utimoshi.ru');
});

test('Telegram 10.3 disabled button is gated and MAX rendering remains unchanged', () => {
  const action = {
    type: 'action',
    label: 'Подарок уже принят',
    action: 'accept_gift',
    channelOptions: { telegram: { disabled: true } },
  };

  const enabled = new TelegramRenderer({ features: { disabledButtons: true } }).renderView({ actions: [action] });
  assert.deepEqual(enabled.reply_markup.inline_keyboard[0][0], {
    text: 'Подарок уже принят',
    disabled: {},
  });

  const fallback = new TelegramRenderer().renderView({ actions: [action] });
  assert.deepEqual(fallback.reply_markup.inline_keyboard, []);

  const max = new MaxRenderer().renderView({ actions: [action] });
  assert.equal(max.attachments[0].payload.buttons[0][0].payload, 'action:accept_gift');
});

test('Telegram renderer preserves explicit rich and noncritical ephemeral channel hints', () => {
  const richMessage = { markdown: '**Кнопка добра**' };
  const delivery = { mode: 'ephemeral', critical: false };
  const result = new TelegramRenderer().renderView({
    title: 'Спасибо',
    text: 'Благодарность отправлена.',
    channelOptions: { telegram: { richMessage, delivery } },
  });
  assert.equal(result.rich_message, richMessage);
  assert.equal(result.delivery, delivery);
});

test('action router keeps business flow in shared customer experience service', async () => {
  const calls = [];
  const router = new BotActionRouter({
    customerExperienceService: {
      buildClubView: async (input) => { calls.push(['club', input]); return { title: 'club' }; },
      buildReferralView: async (input) => { calls.push(['referral', input]); return { title: 'referral' }; },
      buildMainMenuView: async (input) => { calls.push(['menu', input]); return { title: 'menu' }; },
      buildMiniAppView: async (input) => { calls.push(['mini', input]); return { title: 'mini' }; },
    },
  });
  const result = await router.route({ action: 'referral', customerId: 'c1', channel: 'telegram' });
  assert.equal(result.title, 'referral');
  assert.equal(calls[0][0], 'referral');
  assert.equal(calls[0][1].customerId, 'c1');
});
