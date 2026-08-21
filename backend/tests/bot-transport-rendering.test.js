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
