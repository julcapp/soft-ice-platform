'use strict';

const CHANNELS = Object.freeze(['MINI_APP', 'WEB', 'TERMINAL', 'TELEGRAM', 'MAX', 'VK']);
const ENGAGEMENT_EVENTS = Object.freeze(['OPENED', 'CLICKED']);

function percentage(version) {
  return version?.benefitType === 'PERCENT_DISCOUNT' ? Number(version.benefitValue || 0) : null;
}

function formatClock(value, timezone = 'Europe/Moscow') {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(value);
}

function formatMessage({ campaign, channel, window, leadMinutes }) {
  const discount = percentage(campaign.currentVersion);
  const hhmm = formatClock(window.startsAt, window.timezone);
  if (['TELEGRAM', 'MAX'].includes(channel)) return `🍦 Скоро «${campaign.name}»\nЧерез ${leadMinutes} минут, с ${hhmm}, действует скидка ${discount}%.`;
  if (channel === 'VK') return `🔥 Скоро «${campaign.name}»: через ${leadMinutes} минут скидка ${discount}%. Начало в ${hhmm}.`;
  return `Через ${leadMinutes} минут начнётся «${campaign.name}». Скидка ${discount}% применится автоматически.`;
}

function formatLifecycleMessage({ campaign, channel, window, phase }) {
  const discount = percentage(campaign.currentVersion);
  const endsAt = window.endsAt ? formatClock(window.endsAt, window.timezone) : null;
  if (phase === 'START') {
    if (['TELEGRAM', 'MAX'].includes(channel)) return `🔥 «${campaign.name}» начался!\nДо ${endsAt} действует скидка ${discount}%. Цена рассчитывается автоматически.`;
    return `🔥 «${campaign.name}» уже идёт. Скидка ${discount}% действует до ${endsAt}.`;
  }
  if (['TELEGRAM', 'MAX'].includes(channel)) return `🍦 «${campaign.name}» завершён. Спасибо, что были с нами! Следите за следующими выгодными часами.`;
  return `«${campaign.name}» завершён. Следите за следующим окном акции.`;
}

function attributedDeepLink({ campaign, channel, phase }) {
  const base = process.env.PROMOTION_DEEP_LINK || 'https://app.utimoshi.ru/';
  const url = new URL(base);
  url.searchParams.set('promo_campaign', campaign.id);
  url.searchParams.set('promo_version', campaign.currentVersion.id);
  url.searchParams.set('promo_channel', channel);
  url.searchParams.set('promo_event', phase.toLowerCase());
  return url.toString();
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
      const delivery = await dispatcher.send({ campaign, channel, message, startsAt: window.startsAt, endsAt: window.endsAt, event: 'promotion.pre_notification', deepLink: attributedDeepLink({ campaign, channel, phase: 'PRE' }) });
      await this._recordDelivery({ campaign, channel, eventType: 'PRE_NOTIFICATION_SENT', idempotencyKey, at, window, delivery, metadata: { leadMinutes } });
      results.push({ channel, status: 'SENT', idempotencyKey });
    }
    return results;
  }

  async dispatchDueLifecycleEvents({ machineId = null, withinSeconds = 75 } = {}) {
    const at = this.clock();
    const results = [];
    for (const channel of ['TELEGRAM', 'MAX', 'VK']) {
      const active = await this.resolver.resolve({ machineId, channel, at });
      if (active) {
        const window = active.promotionRuntime.activeWindow;
        if (window.startsAt && Math.abs(at.getTime() - window.startsAt.getTime()) <= withinSeconds * 1000) {
          results.push(await this._dispatchLifecycle({ campaign: active, channel, window, phase: 'START', at }));
        }
      }

      const probeAt = new Date(at.getTime() - withinSeconds * 1000);
      const recentlyActive = await this.resolver.resolve({ machineId, channel, at: probeAt });
      const recentWindow = recentlyActive?.promotionRuntime?.activeWindow;
      if (recentWindow?.endsAt && Math.abs(at.getTime() - recentWindow.endsAt.getTime()) <= withinSeconds * 1000) {
        results.push(await this._dispatchLifecycle({ campaign: recentlyActive, channel, window: recentWindow, phase: 'END', at }));
      }
    }
    return results.filter(Boolean);
  }

  async trackEngagement({ campaignId, promotionVersionId, channel, eventType, customerId = null, metadata = {} }) {
    const normalizedChannel = String(channel || '').toUpperCase();
    const normalizedEvent = String(eventType || '').toUpperCase();
    if (!CHANNELS.includes(normalizedChannel) || !ENGAGEMENT_EVENTS.includes(normalizedEvent)) {
      const error = new Error('Unsupported promotion engagement event.');
      error.code = 'PROMOTION_ENGAGEMENT_INVALID';
      error.statusCode = 400;
      throw error;
    }
    if (!campaignId || !promotionVersionId) {
      const error = new Error('Campaign and promotion version are required.');
      error.code = 'PROMOTION_ENGAGEMENT_CONTEXT_REQUIRED';
      error.statusCode = 400;
      throw error;
    }
    const at = this.clock();
    return this.prisma.promotionEvent.create({
      data: {
        campaignId,
        promotionVersionId,
        eventType: `CHANNEL_${normalizedEvent}`,
        actorType: customerId ? 'CUSTOMER' : 'ANONYMOUS',
        actorId: customerId || null,
        newValue: { channel: normalizedChannel, ...metadata },
        occurredAt: at,
      },
    });
  }

  async _dispatchLifecycle({ campaign, channel, window, phase, at }) {
    const idempotencyKey = `PROMO_${phase}:${campaign.currentVersion.id}:${channel}:${window.startsAt?.toISOString() || 'start'}:${window.endsAt?.toISOString() || 'end'}`;
    const existing = await this.prisma.promotionEvent.findUnique({ where: { idempotencyKey } });
    if (existing) return { phase, channel, status: 'ALREADY_SENT', idempotencyKey };
    const dispatcher = this.dispatchers[channel];
    if (!dispatcher?.send) return { phase, channel, status: 'DISPATCHER_NOT_CONFIGURED', idempotencyKey };
    const message = formatLifecycleMessage({ campaign, channel, window, phase });
    const event = phase === 'START' ? 'promotion.started' : 'promotion.ended';
    const delivery = await dispatcher.send({ campaign, channel, message, startsAt: window.startsAt, endsAt: window.endsAt, event, deepLink: attributedDeepLink({ campaign, channel, phase }) });
    await this._recordDelivery({ campaign, channel, eventType: phase === 'START' ? 'START_NOTIFICATION_SENT' : 'END_NOTIFICATION_SENT', idempotencyKey, at, window, delivery, metadata: { phase } });
    return { phase, channel, status: 'SENT', idempotencyKey };
  }

  async _recordDelivery({ campaign, channel, eventType, idempotencyKey, at, window, delivery, metadata = {} }) {
    return this.prisma.promotionEvent.create({
      data: {
        campaignId: campaign.id,
        promotionVersionId: campaign.currentVersion.id,
        eventType,
        actorType: 'SYSTEM',
        actorId: 'promotion-notification-worker',
        idempotencyKey,
        newValue: { channel, startsAt: window.startsAt, endsAt: window.endsAt, delivery, ...metadata },
        metadata: { funnelEvent: 'DELIVERED', channel, deliveryId: delivery?.deliveryId || null },
        occurredAt: at,
      },
    });
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

module.exports = { PromotionAwarenessService, formatMessage, formatLifecycleMessage, attributedDeepLink, CHANNELS, ENGAGEMENT_EVENTS };
