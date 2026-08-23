'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { nextScheduleWindow } = require('../src/modules/promotion_engine/ActivePromotionResolver');
const { PromotionAwarenessService, formatMessage } = require('../src/modules/promotion_engine/PromotionAwarenessService');

function version() {
  return {
    id: 'v1', benefitType: 'PERCENT_DISCOUNT', benefitValue: 20, timezone: 'Europe/Moscow',
    schedules: [{ id: 's1', dayOfWeek: 2, startTime: new Date('1970-01-01T17:00:00Z'), endTime: new Date('1970-01-01T19:00:00Z'), isEnabled: true }],
    channels: [{ channel: 'MINI_APP', enabled: true, preNotificationMinutes: 30 }, { channel: 'TELEGRAM', enabled: true, preNotificationMinutes: 30 }],
    targets: [{ targetType: 'ALL_MACHINES', targetId: null }], audiences: [{ audienceType: 'ALL' }],
  };
}

test('next scheduled window resolves Moscow 17:00 from server UTC', () => {
  const window = nextScheduleWindow(version(), new Date('2026-08-25T13:30:00Z'));
  assert.equal(window.startsAt.toISOString(), '2026-08-25T14:00:00.000Z');
  assert.equal(window.endsAt.toISOString(), '2026-08-25T16:00:00.000Z');
  assert.equal(window.secondsUntilStart, 1800);
});

test('awareness returns upcoming promotion when no active promotion exists', async () => {
  const campaign = { id: 'c1', name: 'Час выгоды', currentVersion: version(), promotionRuntime: { upcomingWindow: nextScheduleWindow(version(), new Date('2026-08-25T13:30:00Z')) } };
  const service = new PromotionAwarenessService({
    prisma: {}, clock: () => new Date('2026-08-25T13:30:00Z'),
    resolver: { resolve: async () => null, resolveUpcoming: async () => campaign },
  });
  const status = await service.getStatus({ machineId: 'm1', channel: 'MINI_APP' });
  assert.equal(status.active, null);
  assert.equal(status.upcoming.discountPercent, 20);
  assert.equal(status.upcoming.secondsUntilStart, 1800);
});

test('pre-notification message uses exact configured lead time', () => {
  const campaign = { name: 'Час выгоды', currentVersion: version() };
  const window = nextScheduleWindow(version(), new Date('2026-08-25T13:30:00Z'));
  const text = formatMessage({ campaign, channel: 'TELEGRAM', window, leadMinutes: 30 });
  assert.match(text, /Через 30 минут/);
  assert.match(text, /скидка 20%/);
});

test('notification worker is idempotent when event already exists', async () => {
  const campaign = { id: 'c1', name: 'Час выгоды', currentVersion: version(), promotionRuntime: { upcomingWindow: nextScheduleWindow(version(), new Date('2026-08-25T13:30:00Z')) } };
  let sends = 0;
  const service = new PromotionAwarenessService({
    clock: () => new Date('2026-08-25T13:30:00Z'),
    prisma: { promotionEvent: { findUnique: async () => ({ id: 'already' }), create: async () => { throw new Error('must not create'); } } },
    resolver: { resolveUpcoming: async ({ channel }) => channel === 'TELEGRAM' ? campaign : null },
    dispatchers: { TELEGRAM: { send: async () => { sends += 1; } } },
  });
  const result = await service.dispatchDueNotifications();
  assert.equal(sends, 0);
  assert.equal(result[0].status, 'ALREADY_SENT');
});
