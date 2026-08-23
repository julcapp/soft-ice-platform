const test = require('node:test');
const assert = require('node:assert/strict');
const { AdminNotificationCenterService } = require('../src/modules/admin_dashboard/AdminNotificationCenterService');

test('aggregates financial, private-channel, photo and machine alerts with unread count', async () => {
  const prisma = {
    $queryRawUnsafe: async (sql) => {
      if (sql.includes('FROM "FinancialOpsAlert"')) return [{ id: 'f1', alertKey: '2026-08-22:missing-refunds', severity: 'CRITICAL', title: 'Нет реестра возвратов', message: 'Реестр не получен', deepLink: '#business-analytics', lastDetectedAt: new Date('2026-08-23T02:00:00Z') }];
      if (sql.includes('FROM "PrivateChannelRenewalAttempt"')) return [{ id: 'r1', status: 'FAILED', channelType: 'TELEGRAM', failureMessage: 'payment failed', attemptCount: 1, updatedAt: new Date('2026-08-23T01:00:00Z') }];
      if (sql.includes('FROM "PhotoPublication"')) return [{ id: 'p1', photoChallengeId: 'c1', channel: 'VK', status: 'failed', errorMessage: 'publish failed', updatedAt: new Date('2026-08-23T00:30:00Z') }];
      if (sql.includes('FROM "Machine" WHERE')) return [{ id: 'm1', machineCode: 'M-001', name: 'Тимоша 1', location: 'ТЦ', status: 'OFFLINE', updatedAt: new Date('2026-08-23T02:20:00Z') }];
      if (sql.includes('FROM "DispenseRequest" d') && sql.includes("IN ('REQUESTED','STARTED')")) return [{ id: 'd1', orderId: 'o1', machineId: 'm1', state: 'STARTED', commandId: 'cmd1', startedAt: new Date('2026-08-23T01:00:00Z'), machineCode: 'M-001', machineName: 'Тимоша 1' }];
      if (sql.includes('FROM "DispenseRequest" d') && sql.includes("d.\"state\"='FAILED'")) return [];
      if (sql.includes('FROM "MachineMobilePlan"')) return [];
      if (sql.includes('FROM "InventoryRuntimeStock"')) return [{ id: 's1', machineId: 'm1', physicalQuantity: 5, activeReservedQuantity: 1, lowStockThreshold: 5, itemName: 'Стаканчики', sku: 'CUP', machineCode: 'M-001', machineName: 'Тимоша 1', updatedAt: new Date('2026-08-23T02:15:00Z') }];
      if (sql.includes('FROM "AdminNotificationReceipt"')) return [{ notificationKey: 'private-renewal:r1:FAILED', readAt: new Date('2026-08-23T02:10:00Z') }];
      return [];
    },
  };
  const result = await new AdminNotificationCenterService({ prisma, clock: () => new Date('2026-08-23T02:30:00Z') }).list({ adminSubject: 'owner' });
  assert.equal(result.items.length, 6);
  assert.equal(result.unreadCount, 5);
  assert.equal(result.items[0].severity, 'CRITICAL');
  assert.equal(result.items.find((item) => item.source === 'PRIVATE_CHANNEL').unread, false);
  assert.equal(result.items.find((item) => item.source === 'PHOTO_PUBLICATION').deepLink, '#photo-verification');
  assert.equal(result.items.filter((item) => item.source === 'MACHINE').length, 3);
  assert.ok(result.items.some((item) => item.key === 'machine:state:m1:OFFLINE'));
  assert.ok(result.items.some((item) => item.key === 'machine:dispense-stuck:d1'));
  assert.ok(result.items.some((item) => item.key === 'machine:low-stock:s1'));
});

test('machine connectivity signals distinguish blocked plan, low balance and low traffic', async () => {
  const prisma = {
    $queryRawUnsafe: async (sql) => {
      if (sql.includes('FROM "MachineMobilePlan"')) return [{ machineId: 'm2', tariffStatus: 'BLOCKED', currentBalance: 0, minimumBalanceThreshold: 100, trafficLimitMb: 1000, trafficRemainingMb: 50, lastCheckedAt: new Date('2026-08-01T00:00:00Z'), updatedAt: new Date('2026-08-23T02:00:00Z'), machineCode: 'M-002', machineName: 'Тимоша 2' }];
      if (sql.includes('FROM "AdminNotificationReceipt"')) return [];
      return [];
    },
  };
  const result = await new AdminNotificationCenterService({ prisma, clock: () => new Date('2026-08-23T03:00:00Z') }).list({ adminSubject: 'owner' });
  const machineItems = result.items.filter((item) => item.source === 'MACHINE');
  assert.ok(machineItems.some((item) => item.key === 'machine:connectivity:plan:m2:BLOCKED' && item.severity === 'CRITICAL'));
  assert.ok(machineItems.some((item) => item.key === 'machine:connectivity:balance:m2' && item.severity === 'CRITICAL'));
  assert.ok(machineItems.some((item) => item.key === 'machine:connectivity:traffic:m2'));
  assert.ok(machineItems.some((item) => item.key === 'machine:connectivity:stale:m2'));
});

test('markRead upserts personal read receipt', async () => {
  const calls = [];
  const prisma = { $executeRawUnsafe: async (...args) => { calls.push(args); return 1; } };
  const result = await new AdminNotificationCenterService({ prisma }).markRead({ adminSubject: 'owner', notificationKey: 'financial:key' });
  assert.equal(result.notificationKey, 'financial:key');
  assert.equal(calls.length, 1);
  assert.match(String(calls[0][0]), /ON CONFLICT/);
  assert.equal(calls[0][2], 'owner');
  assert.equal(calls[0][3], 'financial:key');
});
