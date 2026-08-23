const test = require('node:test');
const assert = require('node:assert/strict');
const { AdminOperationsDispatchService, sourceCategory } = require('../src/modules/admin_dashboard/AdminOperationsDispatchService');

test('operations dispatch enriches notifications with workflow state and filters', async () => {
  const notificationCenter = { list: async () => ({ items: [
    { key: 'financial:x', source: 'FINANCIAL', severity: 'CRITICAL', title: 'Финансы', message: 'Ошибка', occurredAt: new Date() },
    { key: 'private:y', source: 'PRIVATE_CHANNEL', severity: 'WARNING', title: 'Подписка', message: 'Ошибка', occurredAt: new Date() },
  ] }) };
  const prisma = { $queryRawUnsafe: async () => [{ id: 'w1', notificationKey: 'financial:x', status: 'IN_PROGRESS', assigneeSubject: 'operator-1' }] };
  const service = new AdminOperationsDispatchService({ prisma, notificationCenter });
  const result = await service.list({ category: 'FINANCE' });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].category, 'FINANCE');
  assert.equal(result.items[0].work.status, 'IN_PROGRESS');
  assert.equal(result.items[0].work.assigneeSubject, 'operator-1');
});

test('operations dispatch creates work item and audit event when taking incident in progress', async () => {
  let selectCount = 0;
  const executed = [];
  const notificationCenter = { list: async () => ({ items: [] }) };
  const prisma = {
    $queryRawUnsafe: async (sql) => {
      if (sql.includes('WHERE "notificationKey"=$1 LIMIT 1')) {
        selectCount += 1;
        if (selectCount === 1) return [];
        return [{ id: 'work-1', notificationKey: 'financial:x', status: 'IN_PROGRESS', assigneeSubject: 'operator-1', acknowledgedAt: new Date() }];
      }
      return [];
    },
    $executeRawUnsafe: async (...args) => { executed.push(args); return 1; },
  };
  const service = new AdminOperationsDispatchService({ prisma, notificationCenter });
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
