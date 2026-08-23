const test = require('node:test');
const assert = require('node:assert/strict');
const { AdminNotificationCenterService } = require('../src/modules/admin_dashboard/AdminNotificationCenterService');

test('aggregates financial, private-channel and photo alerts with unread count', async () => {
  let call = 0;
  const prisma = {
    $queryRawUnsafe: async () => {
      call += 1;
      if (call === 1) return [{ id: 'f1', alertKey: '2026-08-22:missing-refunds', severity: 'CRITICAL', title: 'Нет реестра возвратов', message: 'Реестр не получен', deepLink: '#business-analytics', lastDetectedAt: new Date('2026-08-23T02:00:00Z') }];
      if (call === 2) return [{ id: 'r1', status: 'FAILED', channelType: 'TELEGRAM', failureMessage: 'payment failed', attemptCount: 1, updatedAt: new Date('2026-08-23T01:00:00Z') }];
      if (call === 3) return [{ id: 'p1', photoChallengeId: 'c1', channel: 'VK', status: 'failed', errorMessage: 'publish failed', updatedAt: new Date('2026-08-23T00:30:00Z') }];
      return [{ notificationKey: 'private-renewal:r1:FAILED', readAt: new Date('2026-08-23T02:10:00Z') }];
    },
  };
  const result = await new AdminNotificationCenterService({ prisma }).list({ adminSubject: 'owner' });
  assert.equal(result.items.length, 3);
  assert.equal(result.unreadCount, 2);
  assert.equal(result.items[0].source, 'FINANCIAL');
  assert.equal(result.items.find((item) => item.source === 'PRIVATE_CHANNEL').unread, false);
  assert.equal(result.items.find((item) => item.source === 'PHOTO_PUBLICATION').deepLink, '#photo-verification');
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
