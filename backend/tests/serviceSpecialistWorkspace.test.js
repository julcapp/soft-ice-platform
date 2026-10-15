const test = require('node:test');
const assert = require('node:assert/strict');
const { ServiceSpecialistWorkspaceService } = require('../src/modules/operator_workspace/ServiceSpecialistWorkspaceService');

test('specialist workspace returns own machines and active work items', async () => {
  let call = 0;
  const prisma = { $queryRawUnsafe: async () => {
    call += 1;
    if (call === 1) return [{ machineId: 'm1', machineCode: 'M-001', name: 'Автомат 1', status: 'ONLINE' }];
    return [{ id: 'w1', notificationKey: 'machine:dispense:d1', title: 'Ошибка выдачи', severity: 'CRITICAL', status: 'OPEN', ackDueAt: new Date(Date.now() - 60000), resolveDueAt: new Date(Date.now() + 3600000), escalationLevel: 1 }];
  } };
  const specialistDirectory = { getBySubject: async () => ({ memberId: 'member-1', platformUserId: 'user-1', fullName: 'Иван Петров' }) };
  const result = await new ServiceSpecialistWorkspaceService({ prisma, specialistDirectory }).getMyWorkspace({ subject: 'user-1' });
  assert.equal(result.profile.fullName, 'Иван Петров');
  assert.equal(result.summary.assignedMachines, 1);
  assert.equal(result.summary.activeWorkItems, 1);
  assert.equal(result.workItems[0].ackOverdue, true);
});
