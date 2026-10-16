const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestMiniAppEntryPolicy } = require('../src/modules/bot_core/TestMiniAppEntryPolicy');
const { TelegramRenderer } = require('../src/modules/bot_core/TelegramRenderer');
const { MaxRenderer } = require('../src/modules/bot_core/MaxRenderer');

const token = '572898079:test-only';
const config = { token, allowedUserIds: new Set(['123']) };
const action = { type: 'open_mini_app', label: 'Кабинет', url: 'https://app.utimoshi.ru/tma.html?machine_id=TEST-MACHINE-001' };
const context = { chatType: 'private', externalUserId: '123' };
const policy = (overrides = {}) => createTestMiniAppEntryPolicy({ token, env: { NODE_ENV: 'development' }, readConfig: () => config, ...overrides });

test('only an allowlisted buyer of the configured TEST bot gets the shared entry', () => {
  const view = { actions: [action, { type: 'open_url', label: 'Документ', url: action.url }] };
  const rendered = new TelegramRenderer({ miniAppEntryPolicy: policy() }).renderView(view, context);
  assert.equal(rendered.reply_markup.inline_keyboard[0][0].web_app.url, 'https://bot-test.utimoshi.ru/miniapp/?machine_id=TEST-MACHINE-001');
  assert.equal(rendered.reply_markup.inline_keyboard[1][0].url, action.url);
  assert.equal(view.actions[0], action);
  assert.equal(new MaxRenderer().renderView(view).attachments[0].payload.buttons[0][0].url, action.url);
});

test('production, unknown buyers, wrong token, groups and missing config retain the existing entry', () => {
  for (const [route, input] of [
    [policy({ env: { NODE_ENV: 'production' } }), context],
    [policy({ token: '572898079:other' }), context],
    [policy({ token: '999:other', readConfig: () => ({ ...config, token: '999:other' }) }), context],
    [policy(), { ...context, externalUserId: '456' }],
    [policy(), { ...context, chatType: 'group' }],
    [policy(), { chatType: 'private' }],
    [policy({ readConfig: () => { throw new Error('unavailable'); } }), context],
  ]) assert.equal(route(action, input), action);
  const external = { ...action, url: 'https://example.org/app' };
  assert.equal(policy()(external, context), external);
});

test('TEST menu combines cabinet actions, preserves gifts/referral/help and leaves other bots unchanged', () => {
  const { buildMainMenu } = require('../src/modules/bot_core/OnboardingPolicy');
  const actions = buildMainMenu({ miniAppUrl: 'https://miniapp.utimoshi.ru' });
  const original = JSON.stringify(actions);
  const compact = policy().mapMenu(actions, context);
  assert.equal(compact.length, 4);
  assert.deepEqual(compact.filter(x => x.action).map(x => x.action), ['gifts', 'referral', 'help']);
  assert.match(compact[0].label, /заказы и получение/);
  assert.equal(JSON.stringify(actions), original);
  assert.equal(policy().mapMenu(actions, {...context, externalUserId:'456'}), actions);
  assert.equal(policy({env:{NODE_ENV:'production'}}).mapMenu(actions, context), actions);
  const back = [{type:'action', action:'menu', label:'Назад'}];
  assert.equal(policy().mapMenu(back, context), back);
});

test('all legacy menu callbacks have a response and main_menu aliases menu', async () => {
  const { BotActionRouter } = require('../src/modules/bot_core/BotActionRouter');
  const calls = [];
  const service = Object.fromEntries(['Club','Referral','MainMenu','MiniApp'].map(name => ['build'+name+'View', async input => {calls.push([name,input]);return {title:name,text:name,actions:[]};}]));
  const router = new BotActionRouter({customerExperienceService:service});
  for (const action of ['club','referral','gifts','order','locations','help','back','menu','main_menu']) {
    const view=await router.route({action,customerId:'customer',channel:'telegram'});
    assert.ok(view.text); assert.ok(!view.text.includes('Не удалось распознать'));
  }
  assert.equal(calls.filter(x=>x[0]==='MainMenu').length,3);
  assert.equal(calls.filter(x=>x[0]==='MiniApp').length,2);
});
