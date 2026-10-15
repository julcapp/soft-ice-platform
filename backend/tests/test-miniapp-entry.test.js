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
  assert.equal(rendered.reply_markup.inline_keyboard[0][0].web_app.url, 'https://miniapp.utimoshi.ru/preorder-test.html?machine_id=TEST-MACHINE-001');
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
