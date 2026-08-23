'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ActivePromotionResolver,
  isScheduleWindowActive,
} = require('../src/modules/promotion_engine/ActivePromotionResolver');

function campaign(overrides = {}) {
  return {
    id: 'campaign-happy-hour',
    status: 'SCHEDULED',
    currentVersion: {
      id: 'version-1',
      priority: 100,
      timezone: 'Europe/Moscow',
      isManualOverride: false,
      schedules: [
        {
          dayOfWeek: 2,
          startTime: new Date('1970-01-01T17:00:00.000Z'),
          endTime: new Date('1970-01-01T19:00:00.000Z'),
          isEnabled: true,
        },
      ],
      targets: [{ targetType: 'ALL_MACHINES', targetId: null }],
      audiences: [{ audienceType: 'ALL' }],
      rules: [],
      channels: [{ channel: 'TERMINAL', enabled: true }],
      ...overrides,
    },
  };
}

function resolverFor(row) {
  return new ActivePromotionResolver({
    prisma: {
      promotionCampaign: {
        findMany: async () => [row],
      },
    },
  });
}

test('T-01: scheduled Happy Hour starts exactly at 17:00 server-resolved Moscow time', async () => {
  const row = campaign();
  const resolver = resolverFor(row);

  const before = await resolver.resolve({
    machineId: 'machine-1',
    channel: 'TERMINAL',
    at: new Date('2026-08-25T13:59:59.000Z'), // 16:59:59 Europe/Moscow
  });
  const start = await resolver.resolve({
    machineId: 'machine-1',
    channel: 'TERMINAL',
    at: new Date('2026-08-25T14:00:00.000Z'), // 17:00:00 Europe/Moscow
  });
  const end = await resolver.resolve({
    machineId: 'machine-1',
    channel: 'TERMINAL',
    at: new Date('2026-08-25T16:00:00.000Z'), // 19:00:00 Europe/Moscow
  });

  assert.equal(before, null);
  assert.equal(start?.id, row.id);
  assert.equal(end, null);
});

test('schedule calculation uses campaign timezone rather than host timezone', () => {
  const version = campaign().currentVersion;
  assert.equal(isScheduleWindowActive(version, new Date('2026-08-25T14:30:00.000Z')), true);
  assert.equal(isScheduleWindowActive(version, new Date('2026-08-25T17:30:00.000Z')), false);
});

test('manual run-now override is not blocked by recurring schedule window', () => {
  const version = campaign({ isManualOverride: true }).currentVersion;
  assert.equal(isScheduleWindowActive(version, new Date('2026-08-25T05:00:00.000Z')), true);
});

test('invalid timezone fails closed instead of applying a promotion', () => {
  const version = campaign({ timezone: 'Mars/Olympus' }).currentVersion;
  assert.equal(isScheduleWindowActive(version, new Date('2026-08-25T14:30:00.000Z')), false);
});
