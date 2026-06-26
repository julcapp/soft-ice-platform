import 'dotenv/config';
import { Markup, Telegraf } from 'telegraf';

const BOT_TOKEN = process.env.BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://app.utimoshi.ru';
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://utimoshi.ru';
const BOT_DISPLAY_NAME = process.env.BOT_DISPLAY_NAME || 'ice_robo_Bot';

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN is required. Copy .env.example to .env and set BOT_TOKEN.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

const mainMenu = Markup.inlineKeyboard([
  [Markup.button.callback('🍦 Купить мороженое', 'product_icecream')],
  [Markup.button.callback('🎁 Клуб Тимоши', 'product_club')],
  [Markup.button.callback('🎫 Подарочный сертификат', 'product_certificate')],
  [Markup.button.webApp('📱 Открыть Mini App', MINI_APP_URL)],
  [Markup.button.callback('📍 Где купить', 'locations')],
  [Markup.button.callback('❓ Помощь', 'help')]
]);

const backMenu = Markup.inlineKeyboard([
  [Markup.button.callback('⬅️ В меню', 'main_menu')]
]);

const productMenu = (buttonText) => Markup.inlineKeyboard([
  [Markup.button.callback(buttonText, 'payment_stub')],
  [Markup.button.callback('⬅️ В меню', 'main_menu')]
]);

function welcomeText() {
  return [
    '🍦 Добро пожаловать в «У Тимоши»!',
    '',
    'Мы готовим свежее мягкое мороженое и дарим бонусы постоянным гостям.',
    '',
    'Выберите действие.'
  ].join('\n');
}

async function removeLegacyReplyKeyboard(ctx) {
  await ctx.reply('Обновляем меню «У Тимоши» 🍦', Markup.removeKeyboard());
}

async function sendMainMenu(ctx) {
  await ctx.reply(welcomeText(), mainMenu);
}

bot.start(async (ctx) => {
  await removeLegacyReplyKeyboard(ctx);
  await sendMainMenu(ctx);
});

bot.command('menu', async (ctx) => {
  await removeLegacyReplyKeyboard(ctx);
  await sendMainMenu(ctx);
});

bot.action('main_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await sendMainMenu(ctx);
});

bot.action('product_icecream', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply([
    '🍦 Мороженое «Вкус дня»',
    '',
    'Стаканчик мягкого мороженого.',
    '',
    'В стоимость входит:',
    '✓ 1 сироп;',
    '✓ 1 топпинг.',
    '',
    'Цена: 130 ₽'
  ].join('\n'), productMenu('Купить'));
});

bot.action('product_club', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply([
    '🎁 Клуб Тимоши',
    '',
    'Пополнение клубного счёта.',
    '',
    'После пополнения вы получаете:',
    '✓ скидку 20%;',
    '✓ бонусную программу;',
    '✓ специальные предложения;',
    '✓ участие в акциях.',
    '',
    'Стоимость: 300 ₽'
  ].join('\n'), productMenu('Пополнить'));
});

bot.action('product_certificate', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply([
    '🎫 Подарочный сертификат',
    '',
    'Электронный сертификат для покупки мягкого мороженого «У Тимоши».',
    '',
    'Номинал: 500 ₽'
  ].join('\n'), productMenu('Купить сертификат'));
});

bot.action('locations', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply([
    '📍 Где купить',
    '',
    'Скоро здесь появится карта точек «У Тимоши».',
    '',
    `Сайт проекта: ${WEBSITE_URL}`
  ].join('\n'), backMenu);
});

bot.action('help', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply([
    '❓ Помощь',
    '',
    'Здесь можно выбрать мороженое, открыть Mini App и узнать о Клубе Тимоши.',
    '',
    `Бот: ${BOT_DISPLAY_NAME}`,
    'Username: @desserty_bot'
  ].join('\n'), backMenu);
});

bot.action('payment_stub', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply([
    'Спасибо!',
    '',
    'Оплата будет доступна после завершения проверки ЮKassa.',
    '',
    'Сейчас можно открыть Mini App и посмотреть сервис.'
  ].join('\n'), Markup.inlineKeyboard([
    [Markup.button.webApp('📱 Открыть Mini App', MINI_APP_URL)],
    [Markup.button.callback('⬅️ В меню', 'main_menu')]
  ]));
});

bot.catch((error, ctx) => {
  console.error(`Bot error for update ${ctx.update?.update_id}:`, error);
});

await bot.launch();
console.log(`${BOT_DISPLAY_NAME} started. Mini App: ${MINI_APP_URL}`);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
