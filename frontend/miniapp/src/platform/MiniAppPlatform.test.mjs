import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMiniAppPlatform } from './MiniAppPlatform.js';

test('both channels use the same interface without trusting unsigned user fields', () => {
  for (const provider of ['telegram', 'max']) {
    const sdk = { initData: 'signed-data', initDataUnsafe: { user: { id: 'untrusted' } } };
    const surface = provider === 'telegram' ? { Telegram: { WebApp: sdk } } : { WebApp: sdk };
    assert.deepEqual(resolveMiniAppPlatform(surface).authenticationPayload(), { platform: provider, init_data: 'signed-data' });
  }
});
test('missing or ambiguous channel cannot provide an authentication payload', () => {
  assert.throws(() => resolveMiniAppPlatform({}).authenticationPayload());
  assert.throws(() => resolveMiniAppPlatform({ Telegram: { WebApp: { initData: 'a' } }, WebApp: { initData: 'b' } }));
});
test('payment opener rejects unexpected domains and insecure URLs', () => {
  let opened;
  const adapter = resolveMiniAppPlatform({ WebApp: { initData: 'signed', openLink: url => { opened = url; } } });
  adapter.openPayment('https://yoomoney.ru/checkout/test');
  assert.equal(opened, 'https://yoomoney.ru/checkout/test');
  for (const url of ['http://yoomoney.ru/', 'https://yoomoney.ru.attacker.example/', 'javascript:alert(1)']) assert.throws(() => adapter.openPayment(url));
});
