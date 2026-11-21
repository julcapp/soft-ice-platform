const test = require('node:test');
const assert = require('node:assert/strict');
const { AdminOperationsEscalationService, levelOneTarget, levelTwoTarget } = require('../src/modules/admin_dashboard/AdminOperationsEscalationService');

test('L1 machine escalation goes to responsible member without replacing executor', () => {
  const item = { source: 'MACHINE', assigneeDisplayName: 'Сервис Иван' };
  const assignment = { responsibleMemberId: 'r1', responsiblePlatformUserId: 'user-responsible', responsibleName: 'Пётр Ответственный' };
  const target = levelOneTarget(item, assignment);
  assert.equal(target.subject, 'user-responsible');
  assert.equal(target.displayName, 'Пётр Ответственный');
  assert.match(target.reason, /поверх исполнителя Сервис Иван/);
});

test('L2 escalation always goes to platform owner role', () => {
  const target = levelTwoTarget({ assigneeDisplayName: 'Сервис Иван' });
  assert.equal(target.subject, 'role:PLATFORM_OWNER');
  assert.match(target.reason, /SLA решения нарушен/);
});

test('sync creates L1 and L2 once and writes immutable escalation events', async () => {
  const executed = [];
  const prisma = {
    $queryRawUnsafe: async (sql) => {
      if (String(sql).includes('FROM "AdminOperationsWorkItem"')) return [{ id: 'w1', notificationKey: 'machine:dispense-failed:d1', source: 'MACHINE', sourceReferenceId: 'm1', status: 'OPEN', assigneeSubject: 'service-user', assigneeDisplayName: 'Сервис Иван', escalationLevel: 2 }];
      if (String(sql).includes('FROM "OrganizationMachineAssignment"')) return [{ machineId: 'm1', responsibleMemberId: 'r1', responsiblePlatformUserId: 'owner-machine', responsibleName: 'Пётр Ответственный' }];
      return [];
    },
    $executeRawUnsafe: async (...args) => {
      executed.push(args);
      if (String(args[0]).startsWith('INSERT INTO "AdminOperationsEscalation"')) return 1;
      return 1;
    },
  };
  const service = new AdminOperationsEscalationService({ prisma, clock: () => new Date('2026-08-23T04:00:00Z') });
  const result = await service.sync();
  assert.equal(result.created, 2);
  const escalationInserts = executed.filter((call) => String(call[0]).startsWith('INSERT INTO "AdminOperationsEscalation"'));
  const eventInserts = executed.filter((call) => String(call[0]).includes('AdminOperationsWorkEvent'));
  assert.equal(escalationInserts.length, 2);
  assert.equal(eventInserts.length, 2);
  assert.equal(escalationInserts[0][4], 'owner-machine');
  assert.equal(escalationInserts[1][4], 'role:PLATFORM_OWNER');
});
