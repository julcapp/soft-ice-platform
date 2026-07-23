const crypto = require('crypto');

function createTelegramInitData({ botToken, user, authDate = Math.floor(Date.now() / 1000) }) {
  const params = new URLSearchParams();

  params.set('auth_date', String(authDate));
  params.set('query_id', 'test_query_id');
  params.set('user', JSON.stringify(user));

  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  params.set('hash', hash);

  return params.toString();
}

module.exports = {
  createTelegramInitData,
};
