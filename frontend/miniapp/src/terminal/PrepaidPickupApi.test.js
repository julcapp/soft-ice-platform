import test from 'node:test';
import assert from 'node:assert/strict';
import { redeemPrepaidOrder, getPrepaidPickupStatus } from './PrepaidPickupApi.js';
test('pickup passes the scanner payload or code without client payment or amount claims', async () => {
  const original = globalThis.fetch, calls = [];
  globalThis.fetch = async (url, options) => { calls.push([url, options]); return { ok: true, json: async () => ({ data: { attributes: { dispense_attempt_id: 'attempt', dispense_status: 'AUTHORIZED' } } }) }; };
  try {
    await redeemPrepaidOrder('TEST-MACHINE-001', { code: '001234' });
    assert.deepEqual(JSON.parse(calls[0][1].body), { machineId: 'TEST-MACHINE-001', code: '001234' });
    await redeemPrepaidOrder('TEST-MACHINE-001', { qrPayload: '{"code":"001234"}', code: 'ignored' });
    assert.deepEqual(JSON.parse(calls[1][1].body), { machineId: 'TEST-MACHINE-001', qrPayload: '{"code":"001234"}' });
    await getPrepaidPickupStatus('TEST-MACHINE-001', 'attempt');
    assert.equal(calls[2][0], '/api/v1/orders/pickup/attempt/status?machineId=TEST-MACHINE-001');
  } finally { globalThis.fetch = original; }
});
test('server refusal remains a refusal to dispense', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, json: async () => ({ error: { code: 'PICKUP_CODE_NOT_FOUND', message: 'Код истёк.' } }) });
  try { await assert.rejects(redeemPrepaidOrder('machine', { code: '001234' }), { code: 'PICKUP_CODE_NOT_FOUND' }); }
  finally { globalThis.fetch = original; }
});
