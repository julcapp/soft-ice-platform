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

function isScheduleWindowActive(version, at) {
  if (!version) return false;
  if (version.isManualOverride) return true;
  const schedules = (version.schedules || []).filter((schedule) => schedule.isEnabled !== false);
  if (schedules.length === 0) return true;
  const local = localScheduleClock(at, version.timezone || 'Europe/Moscow');
  if (!local) return false;
  return schedules.some((schedule) => {
    if (Number(schedule.dayOfWeek) !== local.dayOfWeek) return false;
    const start = scheduleTimeSeconds(schedule.startTime);
    const end = scheduleTimeSeconds(schedule.endTime);
    return start !== null && end !== null && start < end && local.seconds >= start && local.seconds < end;
  });
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

    const applicable = campaigns.filter((campaign) => {
      const version = campaign.currentVersion;
      if (!version || !isScheduleWindowActive(version, at)) return false;
      const targetOk = version.targets.some((target) => target.targetType === 'ALL_MACHINES' || (target.targetType === 'MACHINE' && target.targetId === machineId));
      if (!targetOk) return false;
      const audienceOk = version.audiences.some((audience) => audience.audienceType === 'ALL' || (customerId && ['CLUB_MEMBER', 'RETURNING_CUSTOMER', 'SEGMENT', 'PERSONAL'].includes(audience.audienceType)));
      return audienceOk;
    });

    if (applicable.length === 0) return null;
    applicable.sort((a, b) => (b.currentVersion.priority || 0) - (a.currentVersion.priority || 0));
    return applicable[0];
  }
}

module.exports = { ActivePromotionResolver, isScheduleWindowActive, localScheduleClock, scheduleTimeSeconds };
