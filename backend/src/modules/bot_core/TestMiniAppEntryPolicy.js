const fs = require('node:fs');

function createTestMiniAppEntryPolicy({ token, env = process.env, readConfig = readTestConfig } = {}) {
  const entry = (action, { chatType, externalUserId } = {}) => {
    if (env.NODE_ENV === 'production' || chatType !== 'private' || !externalUserId || action.type !== 'open_mini_app') return action;
    let config;
    try { config = readConfig(); } catch { return action; }
    if (!token || token !== config.token || !token.startsWith('572898079:') || !config.allowedUserIds.has(String(externalUserId))) return action;
    let previous;
    try { previous = new URL(action.url); } catch { return action; }
    if (previous.protocol !== 'https:' || !['app.utimoshi.ru', 'miniapp.utimoshi.ru'].includes(previous.hostname)) return action;
    // Route the TEST buyer to the shared server-backed account, preserving context.
    const url = new URL('https://bot-test.utimoshi.ru/miniapp/');
    url.search = previous.search;
    return { ...action, url: url.href };
  };
  entry.mapMenu = (actions, { chatType, externalUserId } = {}) => {
    if (env.NODE_ENV === 'production' || chatType !== 'private' || !externalUserId) return actions;
    let config;
    try { config = readConfig(); } catch { return actions; }
    if (!token || token !== config.token || !token.startsWith('572898079:') || !config.allowedUserIds.has(String(externalUserId))) return actions;
    const expected = ['club', 'gifts', 'referral', 'order', 'locations', 'help'];
    if (!expected.every(name => actions.some(action => action.action === name))) return actions;
    return actions.filter(action => action.type === 'open_mini_app' || ['gifts', 'referral', 'help'].includes(action.action))
      .map(action => action.type === 'open_mini_app' ? { ...action, label: '📱 Кабинет · заказы и получение' } : action);
  };
  return entry;
}

function readTestConfig() {
  const values = {};
  for (const line of fs.readFileSync('/etc/softice/miniapp-test-auth.env', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^(TELEGRAM_TEST_BOT_TOKEN|TELEGRAM_TEST_ALLOWED_USER_IDS)=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return { token: values.TELEGRAM_TEST_BOT_TOKEN,
    allowedUserIds: new Set(String(values.TELEGRAM_TEST_ALLOWED_USER_IDS || '').split(',').map(x => x.trim()).filter(Boolean)) };
}

module.exports = { createTestMiniAppEntryPolicy };
