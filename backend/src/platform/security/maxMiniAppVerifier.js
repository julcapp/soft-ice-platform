const crypto = require('crypto');

const { ApiError } = require('../errors/ApiError');
const { sha256 } = require('./hash');

function parseMaxInitData(initData) {
  const params = new URLSearchParams(initData);
  const hashes = params.getAll('hash');
  if (hashes.length !== 1 || !hashes[0]) {
    throw invalid('MAX authentication data is invalid.');
  }

  const entries = [];
  params.forEach((value, key) => {
    if (key !== 'hash') entries.push([key, value]);
  });

  return {
    dataCheckString: entries
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
    hash: hashes[0],
    params,
  };
}

function verifyMaxInitData(initData, options = {}) {
  const botToken = options.botToken || process.env.MAX_BOT_TOKEN;
  const maxAgeSeconds = Number(options.maxAgeSeconds || process.env.MAX_INIT_DATA_MAX_AGE_SECONDS || 3600);

  if (!botToken) {
    throw new ApiError({
      statusCode: 503,
      code: 'AUTH_CONFIGURATION_MISSING',
      message: 'MAX authentication is not configured.',
      source: 'platform_service',
      retryable: true,
    });
  }

  if (!initData || typeof initData !== 'string') {
    throw new ApiError({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'Request validation failed.',
      details: [{ field: 'max_init_data', issue: 'must be a non-empty string' }],
    });
  }

  const { dataCheckString, hash, params } = parseMaxInitData(initData);
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const received = Buffer.from(hash, 'hex');
  const expected = Buffer.from(calculatedHash, 'hex');
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    throw invalid('MAX authentication data is invalid.');
  }

  const authDate = Number(params.get('auth_date') || 0);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!authDate || nowSeconds - authDate > maxAgeSeconds || authDate - nowSeconds > 300) {
    throw invalid('MAX authentication data is expired.');
  }

  const user = parseMaxUser(params.get('user'));
  return {
    authDate,
    subjectHash: sha256(String(user.id)),
    user,
  };
}

function parseMaxUser(rawUser) {
  if (!rawUser) throw invalid('MAX authentication data is missing user identity.');
  try {
    const source = JSON.parse(rawUser);
    if (!source.id && !source.user_id) throw new Error('MAX user id is missing.');
    return {
      id: String(source.id || source.user_id),
      firstName: source.first_name || source.firstName || null,
      lastName: source.last_name || source.lastName || null,
      username: source.username || null,
      languageCode: source.language_code || source.languageCode || null,
      photoUrl: source.photo_url || source.photoUrl || null,
    };
  } catch {
    throw invalid('MAX authentication data is invalid.');
  }
}

function invalid(message) {
  return new ApiError({
    statusCode: 401,
    code: 'AUTHENTICATION_INVALID',
    message,
    source: 'platform_service',
  });
}

module.exports = { parseMaxInitData, verifyMaxInitData };
