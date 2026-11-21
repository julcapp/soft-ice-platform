import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recognizeDisplayPhone } from './DisplayRecognitionApi.js';
const originalFetch = globalThis.fetch;
test('POST contract is anonymous and strips non-display fields', async () => {
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/v1/auth/display-phone/recognition');
      assert.equal(options.credentials, 'omit'); assert.equal(options.cache, 'no-store');
      assert.deepEqual(JSON.parse(options.body), { machine_id: 'test', phone: '+79130000001' });
      assert.equal(options.headers.Authorization, undefined);
      return { ok: true, json: async () => ({ data: { attributes: { state: 'RETURNING', name: 'secret', balance: 100, customer_id: 'secret' } } }) };
    };
    assert.deepEqual(await recognizeDisplayPhone('test', '+79130000001'), { state: 'RETURNING', verification: null });
  } finally { globalThis.fetch = originalFetch; }
});
test('network, HTTP, malformed and unexpected states fail closed without raw errors', async () => {
  try {
    for (const response of [null, { ok: false }, { ok: true, json: async () => ({ error: 'secret backend message' }) }, { ok: true, json: async () => ({ data: { attributes: { state: 'AUTHENTICATED' } } }) }]) {
      globalThis.fetch = async () => { if (!response) throw new Error('secret network error'); return response; };
      assert.deepEqual(await recognizeDisplayPhone('test', '+79130000001'), { state: 'UNAVAILABLE' });
    }
  } finally { globalThis.fetch = originalFetch; }
});
test('NEW retains only server-bound attempts and fails closed for unknown provider status', async () => {
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ data: { attributes: { state: 'NEW', verification: { status: 'UNSAFE', code: '123456', remaining_attempts: 99 } } } }) });
    assert.deepEqual(await recognizeDisplayPhone('test', '+79130000001'), { state: 'NEW', verification: { status: 'UNAVAILABLE', maxAttempts: null, remainingAttempts: null } });
  } finally { globalThis.fetch = originalFetch; }
});
