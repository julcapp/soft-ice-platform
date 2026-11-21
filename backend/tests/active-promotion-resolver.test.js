'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ActivePromotionResolver, activeScheduleWindow, isScheduleWindowActive } = require('../src/modules/promotion_engine/ActivePromotionResolver');

function version(overrides = {}) {
  return {
    id: 'version-1', status: 'ACTIVE', priority: 100, timezone: 'Europe/Moscow', isManualOverride: false,
    schedules: [{ id: 'schedule-1', dayOfWeek: 2, startTime: new Date('1970-01-01T17:00:00.000Z'), endTime: new Date('1970-01-01T19:00:00.000Z'), isEnabled: true }],
    targets: [{ targetType: 'ALL_MACHINES', targetId: null }], audiences: [{ audienceType: 'ALL' }], rules: [], channels: [{ channel: 'TERMINAL', enabled: true }, { channel: 'MINI_APP', enabled: true }],
    ...overrides,
  };
}
function campaign(effectiveOverrides = {}, workingOverrides = {}) {
  const effectiveVersion = version(effectiveOverrides);
  return { id: 'campaign-happy-hour', name: 'Час выгоды', status: 'ACTIVE', effectiveVersionId: effectiveVersion.id, effectiveVersion, currentVersion: { ...effectiveVersion, ...workingOverrides } };
}
function resolverFor(row) { return new ActivePromotionResolver({ prisma: { promotionCampaign: { findMany: async () => [row] } } }); }

test('T-01: Happy Hour starts exactly at 17:00 server-resolved Moscow time', async () => {
  const row = campaign(); const resolver = resolverFor(row);
  const before = await resolver.resolve({ machineId: 'machine-1', channel: 'TERMINAL', at: new Date('2026-08-25T13:59:59.000Z') });
  const start = await resolver.resolve({ machineId: 'machine-1', channel: 'TERMINAL', at: new Date('2026-08-25T14:00:00.000Z') });
  const end = await resolver.resolve({ machineId: 'machine-1', channel: 'TERMINAL', at: new Date('2026-08-25T16:00:00.000Z') });
  assert.equal(before, null); assert.equal(start?.id, row.id); assert.equal(end, null);
});

test('schedule calculation uses campaign timezone rather than host timezone', () => {
  const v = version();
  assert.equal(isScheduleWindowActive(v, new Date('2026-08-25T14:30:00.000Z')), true);
  assert.equal(isScheduleWindowActive(v, new Date('2026-08-25T17:30:00.000Z')), false);
});

test('active window exposes exact server countdown until recurring schedule end', () => {
  const at = new Date('2026-08-25T15:27:43.000Z');
  const window = activeScheduleWindow(version(), at);
  assert.equal(window.source, 'RECURRING_SCHEDULE'); assert.equal(window.remainingSeconds, 1937); assert.equal(window.endsAt.toISOString(), '2026-08-25T16:00:00.000Z'); assert.equal(window.startsAt.toISOString(), '2026-08-25T14:00:00.000Z');
});

test('resolver returns runtime server time and active window', async () => {
  const row = campaign(); const at = new Date('2026-08-25T15:30:00.000Z');
  const resolved = await resolverFor(row).resolve({ machineId: 'machine-1', channel: 'TERMINAL', at });
  assert.equal(resolved.promotionRuntime.serverTime.toISOString(), at.toISOString()); assert.equal(resolved.promotionRuntime.activeWindow.endsAt.toISOString(), '2026-08-25T16:00:00.000Z'); assert.equal(resolved.promotionRuntime.activeWindow.remainingSeconds, 1800);
});

test('P-12: a new DRAFT working version never changes serving pricing', async () => {
  const row = campaign({ id: 'effective-v1', benefitValue: 20 }, { id: 'working-v2', status: 'DRAFT', benefitValue: 15 });
  row.effectiveVersionId = 'effective-v1';
  const resolved = await resolverFor(row).resolve({ machineId: 'machine-1', channel: 'TERMINAL', at: new Date('2026-08-25T15:00:00.000Z') });
  assert.equal(resolved.currentVersion.id, 'effective-v1');
  assert.equal(Number(resolved.currentVersion.benefitValue), 20);
});

test('upcoming resolver works for initial SCHEDULED working version without effective pointer', async () => {
  const scheduled = version({ id: 'working-v1', status: 'SCHEDULED', startsAt: new Date('2026-08-25T14:00:00.000Z') });
  const row = { id: 'campaign-happy-hour', name: 'Час выгоды', status: 'SCHEDULED', effectiveVersionId: null, effectiveVersion: null, currentVersionId: scheduled.id, currentVersion: scheduled };
  const upcoming = await resolverFor(row).resolveUpcoming({ machineId: 'machine-1', channel: 'MINI_APP', at: new Date('2026-08-25T13:30:00.000Z'), withinMinutes: 60 });
  assert.equal(upcoming?.currentVersion.id, 'working-v1');
  assert.equal(upcoming?.promotionRuntime.upcomingWindow.secondsUntilStart, 1800);
});

test('scheduled working replacement is visible as upcoming while effective version keeps serving', async () => {
  const row = campaign({ id: 'effective-v1', status: 'ACTIVE', schedules: [], startsAt: new Date('2026-08-25T10:00:00.000Z'), endsAt: new Date('2026-08-25T20:00:00.000Z') }, { id: 'working-v2', status: 'SCHEDULED', schedules: [], startsAt: new Date('2026-08-25T14:00:00.000Z'), endsAt: new Date('2026-08-25T16:00:00.000Z') });
  row.effectiveVersionId = 'effective-v1';
  const resolver = resolverFor(row);
  const active = await resolver.resolve({ machineId: 'machine-1', channel: 'TERMINAL', at: new Date('2026-08-25T13:30:00.000Z') });
  const upcoming = await resolver.resolveUpcoming({ machineId: 'machine-1', channel: 'MINI_APP', at: new Date('2026-08-25T13:30:00.000Z'), withinMinutes: 60 });
  assert.equal(active?.currentVersion.id, 'effective-v1');
  assert.equal(upcoming?.currentVersion.id, 'working-v2');
});

test('manual run-now override is not blocked by recurring schedule window', () => { assert.equal(isScheduleWindowActive(version({ isManualOverride: true, endsAt: new Date('2026-08-25T06:00:00.000Z') }), new Date('2026-08-25T05:00:00.000Z')), true); });
test('manual run-now uses explicit end as countdown boundary', () => { const window = activeScheduleWindow(version({ isManualOverride: true, startsAt: new Date('2026-08-25T05:00:00.000Z'), endsAt: new Date('2026-08-25T06:00:00.000Z') }), new Date('2026-08-25T05:15:00.000Z')); assert.equal(window.remainingSeconds, 2700); assert.equal(window.endsAt.toISOString(), '2026-08-25T06:00:00.000Z'); });
test('invalid timezone fails closed instead of applying a promotion', () => { assert.equal(isScheduleWindowActive(version({ timezone: 'Mars/Olympus' }), new Date('2026-08-25T14:30:00.000Z')), false); });
