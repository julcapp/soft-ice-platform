const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDependencies } = require('./helpers/createTestDependencies');

test('legacy DispenseRequest cannot authorize physical dispense', async () => {
  const runtime = createTestDependencies({}).machineRuntime;
  await assert.rejects(() => runtime.requestDispenseForPaidOrder({ id: 'legacy', status: 'PAID' }), { code: 'LEGACY_DISPENSE_RUNTIME_DISABLED' });
});

test('legacy physical lifecycle commands are disabled', async () => {
  const runtime = createTestDependencies({}).machineRuntime;
  for (const operation of [() => runtime.receiveDispenseCommand('legacy'), () => runtime.completeDispense('legacy'), () => runtime.failDispense('legacy', 'failed')]) await assert.rejects(operation, { code: 'LEGACY_DISPENSE_RUNTIME_DISABLED' });
});
