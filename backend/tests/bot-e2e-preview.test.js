const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BotRuntime,
  TelegramAdapter,
  TelegramRenderer,
  BotTransportSender,
  BotActionRouter,
} = require('../src/modules/bot_core');

function createRuntime() {
  const sent = [];
  const customerExperienceService = {
    async buildClubView({ customerId }) {
      return {
        title: 'Мой клуб',
        text: `Клиент: ${customerId}\nБаланс: 500 ₽`,
        actions: [{ type: 'action', label: 'Пригласить друга', action: 'referral' }],
      };
    },
    async buildReferralView() {
      return {
        title: 'Пригласить друга',
        text: 'Приглашено: 2\nКвалифицировано: 1',
        actions: [
          { type: 'open_url', label: 'Персональная ссылка', url: 'https://go.utimoshi.ru/r/ABC123' },
          { type: 'action', label: '← Назад', action: 'club' },
        ],
      };
    },
    async buildMainMenuView() {
      return {
        title: 'У Тимоши',
        text: 'Главное меню',
        actions: [
          { type: 'action', label: 'Мой клуб', action: 'club' },
          { type: 'action', label: 'Пригласить друга', action: 'referral' },
        ],
      };
    },
    async buildMiniAppView() {
      return { title: 'У Тимоши', text: 'Открыть приложение', actions: [] };
    },
  };

  const sender = new BotTransportSender({
    clients: {
      telegram: {
        async sendMessage(destination, rendered) {
          sent.push({ destination, rendered });
          return { ok: true };
        },
      },
    },
  });

  const runtime = new BotRuntime({
    adapters: { telegram: new TelegramAdapter() },
    renderers: { telegram: new TelegramRenderer() },
    actionRouter: new BotActionRouter({ customerExperienceService }),
    customerResolver: { async resolve() { return { customerId: 'customer-1' }; } },
    sender,
  });

  return { runtime, sent };
}

test('preview e2e: menu -> club -> referral uses one transport-neutral runtime', async () => {
  const { runtime, sent } = createRuntime();

  await runtime.handle('telegram', {
    update_id: 1,
    message: { chat: { id: 10 }, from: { id: 100 }, text: 'menu' },
  });
  assert.match(sent.at(-1).rendered.text, /Главное меню/);

  await runtime.handle('telegram', {
    update_id: 2,
    callback_query: {
      id: 'cb1',
      from: { id: 100 },
      data: 'action:club',
      message: { chat: { id: 10 } },
    },
  });
  assert.match(sent.at(-1).rendered.text, /Баланс: 500/);

  await runtime.handle('telegram', {
    update_id: 3,
    callback_query: {
      id: 'cb2',
      from: { id: 100 },
      data: 'action:referral',
      message: { chat: { id: 10 } },
    },
  });
  assert.match(sent.at(-1).rendered.text, /Приглашено: 2/);
  assert.equal(sent.at(-1).rendered.reply_markup.inline_keyboard[0][0].url, 'https://go.utimoshi.ru/r/ABC123');
  assert.equal(sent.length, 3);
});
