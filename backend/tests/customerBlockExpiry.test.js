const test = require('node:test');
const assert = require('node:assert/strict');
const { releaseExpiredBlocks } = require('../src/modules/crm/customerBlockExpiry');
const { CRMRepository } = require('../src/modules/crm/CRMRepository');

test('requires transactional repository', async () => {
  await assert.rejects(releaseExpiredBlocks({ repository: {} }), TypeError);
});
test('rejects unsafe batch size', async () => {
  await assert.rejects(releaseExpiredBlocks({ repository: { releaseExpiredBlocks: async () => [] }, batchSize: 501 }), RangeError);
});
test('returns committed release count', async () => {
  const called = [];
  const count = await releaseExpiredBlocks({
    repository: { releaseExpiredBlocks: async (now, limit) => { called.push([now.toISOString(), limit]); return [{ id: 'a' }, { id: 'b' }]; } },
    clock: () => new Date('2026-11-02T00:00:00Z'),
  });
  assert.equal(count, 2);
  assert.deepEqual(called, [['2026-11-02T00:00:00.000Z', 100]]);
});
test('expiration updates and audits in same transaction', async () => {
  const calls = [];
  const prisma = { $transaction: async fn => {
    const tx = {
      $queryRaw: async () => { calls.push('update'); return [{ id: 'a' }, { id: 'b' }]; },
      auditEvent: { create: async ({data}) => { calls.push(data.targetId); } },
    };
    return fn(tx);
  } };
  const repo = new CRMRepository(prisma);
  const rows = await repo.releaseExpiredBlocks(new Date('2026-11-02T00:00:00Z'));
  assert.deepEqual(rows.map(r => r.id), ['a','b']);
  assert.deepEqual(calls, ['update','a','b']);
});
test('audit error rejects repository transaction', async () => {
  const prisma = { $transaction: async fn => fn({
    $queryRaw: async () => [{id: 'a'}],
    auditEvent: {create: async () => {throw new Error('AUDIT_FAILED');}},
  }) };
  await assert.rejects(new CRMRepository(prisma).releaseExpiredBlocks(new Date()), /AUDIT_FAILED/);
});
