const test = require('node:test');
const assert = require('node:assert/strict');
const { TerminalBuyerTokenService } = require('../src/modules/customer/TerminalBuyerTokenService');

test('terminal buyer token binds customer to machine and expires', () => {
  let now = new Date('2026-10-08T03:00:00.000Z');
  const service = new TerminalBuyerTokenService({
    secret: 'buyer-token-test-secret',
    ttlMs: 60_000,
    clock: () => now,
  });
  const token = service.issue({ machineId: 'TEST-MACHINE-001', customerId: 'customer-1' });
  const parsed = service.verify(token, { machineId: 'TEST-MACHINE-001' });
  assert.equal(parsed.kind, 'CUSTOMER');
  assert.equal(parsed.id, 'customer-1');
  assert.equal(parsed.machineId, 'TEST-MACHINE-001');
  assert.throws(() => service.verify(token, { machineId: 'OTHER' }), /другого аппарата/);
  now = new Date('2026-10-08T03:01:01.000Z');
  assert.throws(() => service.verify(token, { machineId: 'TEST-MACHINE-001' }), /истекла/);
});

test('terminal buyer token supports unverified and anonymous identities without phone data', () => {
  const service = new TerminalBuyerTokenService({ secret: 'buyer-token-test-secret' });
  const unverified = service.issue({ machineId: 'M1', contactId: 'contact-1' });
  assert.equal(service.verify(unverified, { machineId: 'M1' }).kind, 'UNVERIFIED');
  assert.equal(unverified.includes('7913'), false);
  const anonymous = service.issue({ machineId: 'M1' });
  const parsed = service.verify(anonymous, { machineId: 'M1' });
  assert.equal(parsed.kind, 'ANONYMOUS');
  assert.equal(parsed.id, null);
});
