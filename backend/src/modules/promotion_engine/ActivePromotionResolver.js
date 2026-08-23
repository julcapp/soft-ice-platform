'use strict';

const WEEKDAY = Object.freeze({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 });

function scheduleTimeSeconds(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getUTCHours() * 3600 + value.getUTCMinutes() * 60 + value.getUTCSeconds();
  }
  if (typeof value === 'string') {
    const match = value.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const second = Number(match[3] || 0);
    if (hour > 23 || minute > 59 || second > 59) return null;
    return hour * 3600 + minute * 60 + second;
  }
  return null;
}

function zonedParts(at, timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || 'Europe/Moscow',
      weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23', numberingSystem: 'latn',
    }).formatToParts(at);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const dayOfWeek = WEEKDAY[values.weekday];
    if (!dayOfWeek) return null;
    return {
      dayOfWeek,
      year: Number(values.year), month: Number(values.month), day: Number(values.day),
      hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second),
    };
  } catch (_error) {
    return null;
  }
}

function localScheduleClock(at, timezone) {
  const local = zonedParts(at, timezone);
  if (!local) return null;
  return { dayOfWeek: local.dayOfWeek, seconds: local.hour * 3600 + local.minute * 60 + local.second };
}

function wallClockToUtc({ year, month, day, hour, minute, second }, timezone) {
  const wallUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let candidate = new Date(wallUtc);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(candidate, timezone);
    if (!actual) return null;
    const actualWallUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const delta = wallUtc - actualWallUtc;
    if (delta === 0) return candidate;
    candidate = new Date(candidate.getTime() + delta);
  }
  return candidate;
}

function activeScheduleWindow(version, at) {
  if (!version) return null;
  const timezone = version.timezone || 'Europe/Moscow';
  if (version.isManualOverride) {
    const explicitEnd = version.endsAt ? new Date(version.endsAt) : null;
    return { source: 'MANUAL_OVERRIDE', startsAt: version.startsAt ? new Date(version.startsAt) : null, endsAt: explicitEnd && explicitEnd > at ? explicitEnd : null, remainingSeconds: explicitEnd && explicitEnd > at ? Math.max(0, Math.ceil((explicitEnd - at) / 1000)) : null, timezone };
  }
  const schedules = (version.schedules || []).filter((schedule) => schedule.isEnabled !== false);
  if (schedules.length === 0) {
    const explicitEnd = version.endsAt ? new Date(version.endsAt) : null;
    return { source: 'VERSION_WINDOW', startsAt: version.startsAt ? new Date(version.startsAt) : null, endsAt: explicitEnd && explicitEnd > at ? explicitEnd : null, remainingSeconds: explicitEnd && explicitEnd > at ? Math.max(0, Math.ceil((explicitEnd - at) / 1000)) : null, timezone };
  }
  const local = localScheduleClock(at, timezone);
  if (!local) return null;
  const schedule = schedules.find((row) => {
    if (Number(row.dayOfWeek) !== local.dayOfWeek) return false;
    const start = scheduleTimeSeconds(row.startTime); const end = scheduleTimeSeconds(row.endTime);
    return start !== null && end !== null && start < end && local.seconds >= start && local.seconds < end;
  });
  if (!schedule) return null;
  const startSeconds = scheduleTimeSeconds(schedule.startTime); const endSeconds = scheduleTimeSeconds(schedule.endTime);
  const elapsedFromStart = local.seconds - startSeconds; const remainingSeconds = endSeconds - local.seconds;
  return { source: 'RECURRING_SCHEDULE', scheduleId: schedule.id || null, dayOfWeek: local.dayOfWeek, startsAt: new Date(at.getTime() - elapsedFromStart * 1000), endsAt: new Date(at.getTime() + remainingSeconds * 1000), remainingSeconds, timezone };
}

function nextScheduleWindow(version, at) {
  if (!version) return null;
  const timezone = version.timezone || 'Europe/Moscow';
  const explicitStart = version.startsAt ? new Date(version.startsAt) : null;
  const explicitEnd = version.endsAt ? new Date(version.endsAt) : null;
  if (version.isManualOverride || !(version.schedules || []).length) {
    if (!explicitStart || explicitStart <= at || (explicitEnd && explicitEnd <= explicitStart)) return null;
    return { source: version.isManualOverride ? 'MANUAL_OVERRIDE' : 'VERSION_WINDOW', startsAt: explicitStart, endsAt: explicitEnd, secondsUntilStart: Math.ceil((explicitStart - at) / 1000), timezone };
  }
  const local = zonedParts(at, timezone);
  if (!local) return null;
  const candidates = (version.schedules || []).filter((row) => row.isEnabled !== false).map((schedule) => {
    const startSeconds = scheduleTimeSeconds(schedule.startTime); const endSeconds = scheduleTimeSeconds(schedule.endTime);
    if (startSeconds === null || endSeconds === null || startSeconds >= endSeconds) return null;
    let daysAhead = (Number(schedule.dayOfWeek) - local.dayOfWeek + 7) % 7;
    const localNowSeconds = local.hour * 3600 + local.minute * 60 + local.second;
    if (daysAhead === 0 && startSeconds <= localNowSeconds) daysAhead = 7;
    const base = new Date(Date.UTC(local.year, local.month - 1, local.day + daysAhead));
    const start = wallClockToUtc({ year: base.getUTCFullYear(), month: base.getUTCMonth() + 1, day: base.getUTCDate(), hour: Math.floor(startSeconds / 3600), minute: Math.floor((startSeconds % 3600) / 60), second: startSeconds % 60 }, timezone);
    const end = wallClockToUtc({ year: base.getUTCFullYear(), month: base.getUTCMonth() + 1, day: base.getUTCDate(), hour: Math.floor(endSeconds / 3600), minute: Math.floor((endSeconds % 3600) / 60), second: endSeconds % 60 }, timezone);
    if (!start || start <= at || (explicitStart && start < explicitStart) || (explicitEnd && start >= explicitEnd)) return null;
    return { source: 'RECURRING_SCHEDULE', scheduleId: schedule.id || null, dayOfWeek: Number(schedule.dayOfWeek), startsAt: start, endsAt: end, secondsUntilStart: Math.ceil((start - at) / 1000), timezone };
  }).filter(Boolean).sort((a, b) => a.startsAt - b.startsAt);
  return candidates[0] || null;
}

function isScheduleWindowActive(version, at) { return Boolean(activeScheduleWindow(version, at)); }
function targetAudienceOk(version, { customerId, machineId }) {
  const targetOk = version.targets.some((target) => target.targetType === 'ALL_MACHINES' || (target.targetType === 'MACHINE' && target.targetId === machineId));
  const audienceOk = version.audiences.some((audience) => audience.audienceType === 'ALL' || (customerId && ['CLUB_MEMBER', 'RETURNING_CUSTOMER', 'SEGMENT', 'PERSONAL'].includes(audience.audienceType)));
  return targetOk && audienceOk;
}

class ActivePromotionResolver {
  constructor({ prisma } = {}) { if (!prisma) throw new Error('Prisma client is required.'); this.prisma = prisma; }

  async _campaigns(channel, at, includeFuture = false) {
    return this.prisma.promotionCampaign.findMany({
      where: { status: { in: ['ACTIVE', 'SCHEDULED'] }, currentVersion: { is: { AND: [ ...(includeFuture ? [] : [{ OR: [{ startsAt: null }, { startsAt: { lte: at } }] }]), { OR: [{ endsAt: null }, { endsAt: { gt: at } }] }, { channels: { some: { channel, enabled: true } } } ] } } },
      include: { currentVersion: { include: { schedules: true, targets: true, audiences: true, rules: true, channels: true } } }, orderBy: { createdAt: 'asc' },
    });
  }

  async resolve({ customerId = null, machineId, channel, at = new Date() }) {
    const campaigns = await this._campaigns(channel, at, false);
    const applicable = campaigns.map((campaign) => { const version = campaign.currentVersion; const window = activeScheduleWindow(version, at); if (!version || !window || !targetAudienceOk(version, { customerId, machineId })) return null; return { ...campaign, promotionRuntime: { activeWindow: window, serverTime: at } }; }).filter(Boolean);
    if (!applicable.length) return null;
    applicable.sort((a, b) => (b.currentVersion.priority || 0) - (a.currentVersion.priority || 0));
    return applicable[0];
  }

  async resolveUpcoming({ customerId = null, machineId, channel, at = new Date(), withinMinutes = 60 }) {
    const campaigns = await this._campaigns(channel, at, true);
    const limitSeconds = Math.max(1, Number(withinMinutes) || 60) * 60;
    const upcoming = campaigns.map((campaign) => { const version = campaign.currentVersion; const window = nextScheduleWindow(version, at); if (!version || !window || window.secondsUntilStart > limitSeconds || !targetAudienceOk(version, { customerId, machineId })) return null; const channelConfig = version.channels.find((row) => row.channel === channel && row.enabled); return { ...campaign, promotionRuntime: { upcomingWindow: window, serverTime: at, preNotificationMinutes: channelConfig?.preNotificationMinutes || 30 } }; }).filter(Boolean);
    if (!upcoming.length) return null;
    upcoming.sort((a, b) => a.promotionRuntime.upcomingWindow.startsAt - b.promotionRuntime.upcomingWindow.startsAt || (b.currentVersion.priority || 0) - (a.currentVersion.priority || 0));
    return upcoming[0];
  }
}

module.exports = { ActivePromotionResolver, activeScheduleWindow, nextScheduleWindow, isScheduleWindowActive, localScheduleClock, scheduleTimeSeconds, wallClockToUtc };
