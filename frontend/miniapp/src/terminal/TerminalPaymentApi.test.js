import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTerminalPayment } from './TerminalPaymentApi.js';
const originalFetch = globalThis.fetch;
const payload = (attributes) => ({ data: { id: 'pay-1', attributes: { order_id: 'order-1', status: 'PENDING', user_state: 'PENDING', ...attributes } } });
test('retries keep the quote idempotency key and never supply client price', async () => {
 try {
  globalThis.fetch = async (url, options) => {
   assert.equal(options.headers['Idempotency-Key'], 'terminal:test:quote-1');
   assert.deepEqual(JSON.parse(options.body), { machine_id: 'test', quote_id: 'quote-1', purchase_token: null, method: 'sbp' });
   return { ok: true, json: async () => payload({}) };
  };
  await createTerminalPayment({ machineId: 'test', quoteId: 'quote-1' });
  await createTerminalPayment({ machineId: 'test', quoteId: 'quote-1' });
 } finally { globalThis.fetch = originalFetch; }
});
test('unverified success/failure and unsafe QR URLs fail closed', async () => {
 try {
  for (const user_state of ['SUCCESS','ERROR']) {
   globalThis.fetch = async () => ({ ok: true, json: async () => payload({ user_state }) });
   await assert.rejects(createTerminalPayment({}), { code: 'TERMINAL_PAYMENT_RESPONSE_INVALID' });
  }
  for (const confirmation_url of ['javascript:alert(1)', 'http://example.org/pay', 'https://user:secret@example.org/pay']) {
   globalThis.fetch = async () => ({ ok: true, json: async () => payload({ confirmation_url }) });
   assert.equal((await createTerminalPayment({})).confirmationUrl, null);
  }
  globalThis.fetch = async () => ({ ok: true, json: async () => payload({ status: 'SUCCEEDED', user_state: 'SUCCESS' }) });
  assert.equal((await createTerminalPayment({})).userState, 'SUCCESS');
 } finally { globalThis.fetch = originalFetch; }
});
