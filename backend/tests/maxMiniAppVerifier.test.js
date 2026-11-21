const test = require('node:test');
const assert = require('node:assert/strict');

const { verifyMaxInitData } = require('../src/platform/security/maxMiniAppVerifier');
const { createMaxInitData } = require('./helpers/createMaxInitData');
const { sha256 } = require('../src/platform/security/hash');

test('MAX initData validates official WebAppData HMAC and returns linked subject hash', () => {
  const botToken = 'max-test-token';
  const initData = createMaxInitData({
    botToken,
    user: { id: 388292358, first_name: 'Александр', username: 'alex', language_code: 'ru' },
  });

  const result = verifyMaxInitData(initData, { botToken, maxAgeSeconds: 3600 });
  assert.equal(result.user.id, '388292358');
  assert.equal(result.user.firstName, 'Александр');
  assert.equal(result.subjectHash, sha256('388292358'));
});

test('MAX initData rejects tampering', () => {
  const botToken = 'max-test-token';
  const initData = createMaxInitData({ botToken, user: { id: 388292358, first_name: 'A' } });
  const tampered = initData.replace('first_name%22%3A%22A', 'first_name%22%3A%22B');
  assert.throws(
    () => verifyMaxInitData(tampered, { botToken, maxAgeSeconds: 3600 }),
    (error) => error.code === 'AUTHENTICATION_INVALID',
  );
});

test('MAX initData rejects expired auth_date', () => {
  const botToken = 'max-test-token';
  const initData = createMaxInitData({
    botToken,
    authDate: Math.floor(Date.now() / 1000) - 7200,
  });
  assert.throws(
    () => verifyMaxInitData(initData, { botToken, maxAgeSeconds: 3600 }),
    (error) => error.code === 'AUTHENTICATION_INVALID',
  );
});
