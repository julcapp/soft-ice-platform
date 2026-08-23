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

function localScheduleClock(at, timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || 'Europe/Moscow',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      numberingSystem: 'latn',
    }).formatToParts(at);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const dayOfWeek = WEEKDAY[values.weekday];
    if (!dayOfWeek) return null;
    return {
      dayOfWeek,
      seconds: Number(values.hour) * 3600 + Number(values.minute) * 60 + Number(values.second),
    };
  } catch (_error) {
    return null;
  }
}

function activeScheduleWindow(version, at) {
  if (!version) return null;

  if (version.isManualOverride) {
    const explicitEnd = version.endsAt ? new Date(version.endsAt) : null;
    return {
      source: 'MANUAL_OVERRIDE',
      startsAt: version.startsAt ? new Date(version.startsAt) : null,
      endsAt: explicitEnd && explicitEnd > at ? explicitEnd : null,
      remainingSeconds: explicitEnd && explicitEnd > at ? Math.max(0, Math.ceil((explicitEnd.getTime() - at.getTime()) / 1000)) : null,
      timezone: version.timezone || 'Europe/Moscow',
    };
  }

  const schedules = (version.schedules || []).filter((schedule) => schedule.isEnabled !== false);
  if (schedules.length === 0) {
    const explicitEnd = version.endsAt ? new Date(version.endsAt) : null;
    return {
      source: 'VERSION_WINDOW',
      startsAt: version.startsAt ? new Date(version.startsAt) : null,
      endsAt: explicitEnd && explicitEnd > at ? explicitEnd : null,
      remainingSeconds: explicitEnd && explicitEnd > at ? Math.max(0, Math.ceil((explicitEnd.getTime() - at.getTime()) / 1000)) : null,
      timezone: version.timezone || 'Europe/Moscow',
    };
  }

  const local = localScheduleClock(at, version.timezone || 'Europe/Moscow');
  if (!local) return null;
  const schedule = schedules.find((row) => {
    if (Number(row.dayOfWeek) !== local.dayOfWeek) return false;
    const start = scheduleTimeSeconds(row.startTime);
    const end = scheduleTimeSeconds(row.endTime);
    return start !== null && end !== null && start < end && local.seconds >= start && local.seconds < end;
  });
  if (!schedule) return null;

  const startSeconds = scheduleTimeSeconds(schedule.startTime);
  const endSeconds = scheduleTimeSeconds(schedule.endTime);
  const elapsedFromStart = local.seconds - startSeconds;
  const remainingSeconds = endSeconds - local.seconds;
  return {
    source: 'RECURRING_SCHEDULE',
    scheduleId: schedule.id || null,
    dayOfWeek: local.dayOfWeek,
    startsAt: new Date(at.getTime() - elapsedFromStart * 1000),
    endsAt: new Date(at.getTime() + remainingSeconds * 1000),
    remainingSeconds,
    timezone: version.timezone || 'Europe/Moscow',
  };
}

function isScheduleWindowActive(version, at) {
  return Boolean(activeScheduleWindow(version, at));
}

class ActivePromotionResolver {
  constructor({ prisma } = {}) {
    if (!prisma) throw new Error('Prisma client is required.');
    this.prisma = prisma;
  }

  async resolve({ customerId = null, machineId, channel, at = new Date() }) {
    const campaigns = await this.prisma.promotionCampaign.findMany({
      where: {
        status: { in: ['ACTIVE', 'SCHEDULED'] },
        currentVersion: {
          is: {
            AND: [
              { OR: [{ startsAt: null }, { startsAt: { lte: at } }] },
              { OR: [{ endsAt: null }, { endsAt: { gt: at } }] },
              { channels: { some: { channel, enabled: true } } },
            ],
          },
        },
      },
      include: {
        currentVersion: {
          include: { schedules: true, targets: true, audiences: true, rules: true, channels: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const applicable = campaigns.map((campaign) => {
      const version = campaign.currentVersion;
      const window = activeScheduleWindow(version, at);
      if (!version || !window) return null;
      const targetOk = version.targets.some((target) => target.targetType === 'ALL_MACHINES' || (target.targetType === 'MACHINE' && target.targetId === machineId));
      if (!targetOk) return null;
      const audienceOk = version.audiences.some((audience) => audience.audienceType === 'ALL' || (customerId && ['CLUB_MEMBER', 'RETURNING_CUSTOMER', 'SEGMENT', 'PERSONAL'].includes(audience.audienceType)));
      if (!audienceOk) return null;
      return { ...campaign, promotionRuntime: { activeWindow: window, serverTime: at } };
    }).filter(Boolean);

    if (applicable.length === 0) return null;
    applicable.sort((a, b) => (b.currentVersion.priority || 0) - (a.currentVersion.priority || 0));
    return applicable[0];
  }
}

module.exports = {
  ActivePromotionResolver,
  activeScheduleWindow,
  isScheduleWindowActive,
  localScheduleClock,
  scheduleTimeSeconds,
};
