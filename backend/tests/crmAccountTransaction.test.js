const test = require('node:test');
const assert = require('node:assert/strict');
const { CRMRepository } = require('../src/modules/crm/CRMRepository');

const original = { id: 'customer-1', status: 'active', name: 'Old name' };
function mockDb({ failAudit = false, matchingCount = 1 } = {}) {
 const history = [];
 const prisma = {
  $transaction: async (fn) => {
   const tx = {
    customer: {
     findUnique: async () => ({ ...original }),
     updateMany: async ({ data }) => { history.push(['update', data]); return { count: matchingCount }; },
   },
   auditEvent: {
    create: async ({ data }) => {
     history.push(['audit', data]);
     if (failAudit) throw new Error('AUDIT_WRITE_FAILED');
     return data;
    },
   },
  };
  await fn(tx);
 },
 };
 return { prisma, history };
}
test('CRM edit writes audit in same transaction', async () => {
 const db = mockDb();
 const repo = new CRMRepository(db.prisma);
 repo.findCustomer = async () => ({ ...original, name: 'New name' });
 const result = await repo.applyAccountAction({
  customerId: original.id, actorId: 'admin-1',
  plan: { action: 'edit', name: 'New name' }, correlationId: 'test-corr',
 });
 assert.equal(result.name, 'New name');
 assert.deepEqual(db.history.map(([type]) => type), ['update', 'audit']);
 assert.equal(db.history[1][1].subjectId, 'admin-1');
});
test('CRM edit fails closed when audit write fails', async () => {
 const db = mockDb({ failAudit: true });
 const repo = new CRMRepository(db.prisma);
 await assert.rejects(repo.applyAccountAction({
  customerId: original.id, actorId: 'admin-1', plan: { action: 'edit', name: 'New name' }
 }), /AUDIT_WRITE_FAILED/);
});
test('CRM refuses conflict before logging success', async () => {
 const db = mockDb({ matchingCount: 0 });
 const repo = new CRMRepository(db.prisma);
 await assert.rejects(repo.applyAccountAction({
  customerId: original.id, actorId: 'admin-1', plan: { action: 'edit', name: 'New name' }
 }), /CUSTOMER_ACTION_CONFLICT/);
 assert.deepEqual(db.history.map(([type]) => type), ['update']);
});
test('CRM denies deletion through account action repository', async () => {
 const db = mockDb();
 const repo = new CRMRepository(db.prisma);
 await assert.rejects(repo.applyAccountAction({
  customerId: original.id, actorId: 'admin-1', plan: { action: 'delete' }
 }), /UNSUPPORTED_ACCOUNT_ACTION/);
 assert.equal(db.history.length, 0);
});
