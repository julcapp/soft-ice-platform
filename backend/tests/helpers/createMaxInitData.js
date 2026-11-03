const crypto = require('crypto');

function createMaxInitData({
  botToken,
  user = { id: 701001, first_name: 'MAX', language_code: 'ru' },
  authDate = Math.floor(Date.now() / 1000),
  queryId = 'test-query',
  extra = {},
} = {}) {
  const params = new URLSearchParams();
  params.set('auth_date', String(authDate));
  params.set('query_id', queryId);
  params.set('user', JSON.stringify(user));
  Object.entries(extra).forEach(([key, value]) => params.set(key, String(value)));

  const entries = [];
  params.forEach((value, key) => entries.push([key, value]));
  const dataCheckString = entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

module.exports = { createMaxInitData };
