const crypto = require('crypto');

const { ApiError } = require('../errors/ApiError');
const { sha256 } = require('./hash');

function parseTelegramInitData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');

  if (!hash) {
    throw new ApiError({
      statusCode: 401,
      code: 'AUTHENTICATION_INVALID',
      message: 'Telegram authentication data is invalid.',
      source: 'platform_service',
    });
  }

  const entries = [];
  params.forEach((value, key) => {
    if (key !== 'hash') {
      entries.push([key, value]);
    }
  });

  const dataCheckString = entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  return {
    dataCheckString,
    hash,
    params,
  };
}

function verifyTelegramInitData(initData, options = {}) {
  const botToken = options.botToken || process.env.TELEGRAM_BOT_TOKEN;
  const maxAgeSeconds = Number(
    options.maxAgeSeconds || process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS || 86400,
  );

  if (!botToken) {
    throw new ApiError({
      statusCode: 503,
      code: 'AUTH_CONFIGURATION_MISSING',
      message: 'Telegram authentication is not configured.',
      source: 'platform_service',
      retryable: true,
    });
  }

  if (!initData || typeof initData !== 'string') {
    throw new ApiError({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'Request validation failed.',
      details: [{ field: 'telegram_init_data', issue: 'must be a non-empty string' }],
    });
  }

  const { dataCheckString, hash, params } = parseTelegramInitData(initData);
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  const receivedHash = Buffer.from(hash, 'hex');
  const expectedHash = Buffer.from(calculatedHash, 'hex');

  if (
    receivedHash.length !== expectedHash.length ||
    !crypto.timingSafeEqual(receivedHash, expectedHash)
  ) {
    throw new ApiError({
      statusCode: 401,
      code: 'AUTHENTICATION_INVALID',
      message: 'Telegram authentication data is invalid.',
      source: 'platform_service',
    });
  }

  const authDate = Number(params.get('auth_date') || 0);
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (!authDate || nowSeconds - authDate > maxAgeSeconds) {
    throw new ApiError({
      statusCode: 401,
      code: 'AUTHENTICATION_INVALID',
      message: 'Telegram authentication data is expired.',
      source: 'platform_service',
    });
  }

  const user = parseTelegramUser(params.get('user'));

  return {
    authDate,
    subjectHash: sha256(`telegram:${user.id}`),
    user,
  };
}

function parseTelegramUser(rawUser) {
  if (!rawUser) {
    throw new ApiError({
      statusCode: 401,
      code: 'AUTHENTICATION_INVALID',
      message: 'Telegram authentication data is missing user identity.',
      source: 'platform_service',
    });
  }

  try {
    const user = JSON.parse(rawUser);

    if (!user.id) {
      throw new Error('Telegram user id is missing.');
    }

    return {
      id: String(user.id),
      firstName: user.first_name || null,
      lastName: user.last_name || null,
      username: user.username || null,
      languageCode: user.language_code || null,
    };
  } catch (error) {
    throw new ApiError({
      statusCode: 401,
      code: 'AUTHENTICATION_INVALID',
      message: 'Telegram authentication data is invalid.',
      source: 'platform_service',
    });
  }
}

module.exports = {
  parseTelegramInitData,
  verifyTelegramInitData,
};
