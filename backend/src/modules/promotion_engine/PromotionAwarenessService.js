'use strict';

const CHANNELS = Object.freeze(['MINI_APP', 'WEB', 'TERMINAL', 'TELEGRAM', 'MAX', 'VK']);

function percentage(version) {
  return version?.benefitType === 'PERCENT_DISCOUNT' ? Number(version.benefitValue || 0) : null;
}

function formatMessage({ campaign, channel, window, leadMinutes }) {
  const discount = percentage(campaign.currentVersion);
  const hhmm = new Intl.DateTimeFormat('ru-RU', { timeZone: window.timezone || 'Europe/Moscow', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(window.startsAt);
  if (['TELEGRAM', 'MAX'].includes(channel)) return `🍦 Скоро «${campaign.name}»\nЧерез ${leadMinutes} минут, с ${hhmm}, действует скидка ${discount}%.`;
  if (channel === 'VK') return `🔥 Скоро «${campaign.name}»: через ${leadMinutes} минут скидка ${discount}%. Начало в ${hhmm}.`;
  return `Через ${leadMinutes} минут начнётся «${campaign.name}». Скидка ${discount}% применится автоматически.`;
}

class PromotionAwarenessService {
  constructor({ prisma, resolver, dispatchers = {}, clock = () => new Date() } = {}) {
    if (!prisma) throw new Error('Prisma client is required.');
    if (!resolver) throw new Error('Promotion resolver is required.');
    this.prisma = prisma;
    this.resolver = resolver;
    this.dispatchers = dispatchers;
    this.clock = clock;
  }

  async getStatus({ customerId = null, machineId, channel = 'MINI_APP', withinMinutes = 60 }) {
    if (!machineId) return { serverTime: this.clock(), active: null, upcoming: null };
    const at = this.clock();
    const active = await this.resolver.resolve({ customerId, machineId, channel, at });
    if (active) return { serverTime: at, active: this._activeView(active), upcoming: null };
    const upcoming = await this.resolver.resolveUpcoming({ customerId, machineId, channel, at, withinMinutes });
    return { serverTime: at, active: null, upcoming: upcoming ? this._upcomingView(upcoming) : null };
  }

  async dispatchDueNotifications({ machineId = null, withinSeconds = 75 } = {}) {
    const at = this.clock();
    const results = [];
    for (const channel of ['TELEGRAM', 'MAX', 'VK']) {
      const campaign = await this.resolver.resolveUpcoming({ machineId, channel, at, withinMinutes: 61 });
      if (!campaign) continue;
      const config = campaign.currentVersion.channels.find((row) => row.channel === channel && row.enabled);
      const leadMinutes = Number(config?.preNotificationMinutes || 0);
      if (![15, 30, 60].includes(leadMinutes)) continue;
      const window = campaign.promotionRuntime.upcomingWindow;
      const targetAt = new Date(window.startsAt.getTime() - leadMinutes * 60000);
      if (Math.abs(targetAt.getTime() - at.getTime()) > withinSeconds * 1000) continue;
      const idempotencyKey = `PROMO_PRE:${campaign.currentVersion.id}:${channel}:${window.startsAt.toISOString()}:${leadMinutes}`;
      const existing = await this.prisma.promotionEvent.findUnique({ where: { idempotencyKey } });
      if (existing) { results.push({ channel, status: 'ALREADY_SENT', idempotencyKey }); continue; }
      const dispatcher = this.dispatchers[channel];
      if (!dispatcher?.send) { results.push({ channel, status: 'DISPATCHER_NOT_CONFIGURED', idempotencyKey }); continue; }
      const message = formatMessage({ campaign, channel, window, leadMinutes });
      const delivery = await dispatcher.send({ campaign, channel, message, startsAt: window.startsAt, endsAt: window.endsAt });
      await this.prisma.promotionEvent.create({ data: { campaignId: campaign.id, promotionVersionId: campaign.currentVersion.id, eventType: 'PRE_NOTIFICATION_SENT', actorType: 'SYSTEM', actorId: 'promotion-notification-worker', idempotencyKey, newValue: { channel, leadMinutes, startsAt: window.startsAt, delivery }, occurredAt: at } });
      results.push({ channel, status: 'SENT', idempotencyKey });
    }
    return results;
  }

  _activeView(campaign) {
    const window = campaign.promotionRuntime.activeWindow;
    return { campaignId: campaign.id, promotionVersionId: campaign.currentVersion.id, name: campaign.name, discountPercent: percentage(campaign.currentVersion), startsAt: window.startsAt, endsAt: window.endsAt, remainingSeconds: window.remainingSeconds, timezone: window.timezone };
  }

  _upcomingView(campaign) {
    const window = campaign.promotionRuntime.upcomingWindow;
    const config = campaign.currentVersion.channels.find((row) => row.enabled);
    return { campaignId: campaign.id, promotionVersionId: campaign.currentVersion.id, name: campaign.name, discountPercent: percentage(campaign.currentVersion), startsAt: window.startsAt, endsAt: window.endsAt, secondsUntilStart: window.secondsUntilStart, preNotificationMinutes: Number(config?.preNotificationMinutes || 30), timezone: window.timezone };
  }
}

module.exports = { PromotionAwarenessService, formatMessage, CHANNELS };
