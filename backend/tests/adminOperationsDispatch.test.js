const test = require('node:test');
const assert = require('node:assert/strict');
const { AdminOperationsDispatchService, sourceCategory } = require('../src/modules/admin_dashboard/AdminOperationsDispatchService');

test('operations dispatch syncs active notifications into persisted work items', async () => {
  const executed = [];
  const notificationCenter = { list: async () => ({ items: [
    { key: 'financial:x', source: 'FINANCIAL', severity: 'CRITICAL', title: 'Финансы', message: 'Ошибка', deepLink: '#business-analytics' },
  ] }) };
  const prisma = {
    $executeRawUnsafe: async (...args) => { executed.push(args); return 1; },
    $queryRawUnsafe: async () => [{ id: 'w1', notificationKey: 'financial:x', source: 'FINANCIAL', category: 'FINANCE', severity: 'CRITICAL', title: 'Финансы', message: 'Ошибка', deepLink: '#business-analytics', sourceActive: true, status: 'OPEN', assigneeSubject: null }],
  };
  const result = await new AdminOperationsDispatchService({ prisma, notificationCenter }).list({ category: 'FINANCE' });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].category, 'FINANCE');
  assert.equal(result.items[0].sourceActive, true);
  assert.ok(executed.some((call) => String(call[0]).includes('ON CONFLICT')));
});

test('operations dispatch updates workflow and writes immutable event', async () => {
  let queryCount = 0;
  const executed = [];
  const prisma = {
    $queryRawUnsafe: async () => {
      queryCount += 1;
      if (queryCount === 1) return [{ id: 'work-1', status: 'OPEN', assigneeSubject: null }];
      return [{ id: 'work-1', notificationKey: 'financial:x', status: 'IN_PROGRESS', assigneeSubject: 'operator-1', acknowledgedAt: new Date() }];
    },
    $executeRawUnsafe: async (...args) => { executed.push(args); return 1; },
  };
  const service = new AdminOperationsDispatchService({ prisma, notificationCenter: { list: async () => ({ items: [] }) } });
  const result = await service.update({ notificationKey: 'financial:x', actorSubject: 'admin', status: 'IN_PROGRESS', assigneeSubject: 'operator-1', comment: 'Проверяю реестр' });
  assert.equal(result.status, 'IN_PROGRESS');
  assert.equal(result.assigneeSubject, 'operator-1');
  assert.equal(executed.length, 2);
  assert.match(executed[1][0], /AdminOperationsWorkEvent/);
});

test('source categories are stable for dispatcher filters', () => {
  assert.equal(sourceCategory('FINANCIAL'), 'FINANCE');
  assert.equal(sourceCategory('PRIVATE_CHANNEL'), 'SUBSCRIPTIONS');
  assert.equal(sourceCategory('PHOTO_PUBLICATION'), 'CONTENT');
  assert.equal(sourceCategory('MACHINE'), 'MACHINES');
});
