const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAttribution, invitationUrl, digestToken } = require('../src/modules/gift_transfer/GiftPublicLinks');

test('канал и кампания ограничены белым списком', () => {
  assert.deepEqual(normalizeAttribution({ src: 'VK', utm_campaign: 'cup_2026' }), { source: 'vk', campaign: 'cup_2026' });
  assert.deepEqual(normalizeAttribution({ src: 'evil-url', campaign: '<script>' }), { source: 'unknown', campaign: null });
  assert.deepEqual(normalizeAttribution({ source: 'MAX' }), { source: 'max', campaign: null });
});

test('ссылка на приглашение содержит только opaque token и требует HTTPS', () => {
  const token = '0123456789abcdef0123456789abcdef';
  assert.equal(invitationUrl('https://utimoshi.ru/g', token), 'https://utimoshi.ru/g/' + token);
  assert.throws(() => invitationUrl('http://utimoshi.ru/g', token), /HTTPS/);
  assert.throws(() => invitationUrl('https://user:pass@utimoshi.ru/g', token), /HTTPS/);
  assert.throws(() => invitationUrl('https://utimoshi.ru/g', '+79990000000'), /token/);
});

test('хеш токена детерминирован и не содержит исходный токен', () => {
  const token = '0123456789abcdef0123456789abcdef';
  const hashed = digestToken(token);
  assert.match(hashed, /^[a-f0-9]{64}$/);
  assert.notEqual(hashed, token);
});
