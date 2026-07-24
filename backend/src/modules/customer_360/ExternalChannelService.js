const { randomUUID } = require('crypto');
const { ApiError } = require('../../platform/errors/ApiError');
const { CHANNEL_TYPES, TARGET_TYPES, CustomerExternalProfile, CustomerChannelSubscription, CustomerEngagementSummary } = require('./ExternalChannelModels');
const ADMIN_ROLES = ['PLATFORM_OWNER', 'ADMIN'];

class ExternalChannelService {
  constructor({ repository, customerRepository, eventPublisher, clock = () => new Date() }) {
    Object.assign(this, { repository, customerRepository, eventPublisher, clock });
  }
  authorize(context) {
    if (!context?.roles?.some((role) => ADMIN_ROLES.includes(role))) throw new ApiError({ statusCode: 403, code: 'CUSTOMER_EXTERNAL_CHANNEL_FORBIDDEN', message: 'Недостаточно прав для работы с внешними каналами.' });
  }
  async ensureCustomer(customerId) {
    if (this.customerRepository?.findCustomer && !await this.customerRepository.findCustomer(customerId)) throw new ApiError({ statusCode: 404, code: 'CUSTOMER_360_NOT_FOUND', message: 'Профиль клиента не найден.' });
  }
  async channels(customerId, channelType, context) {
    this.authorize(context); await this.ensureCustomer(customerId);
    const profiles = this.repository.listProfiles(customerId, channelType);
    const subscriptions = this.repository.listSubscriptions(customerId, channelType);
    return CHANNEL_TYPES.filter((type) => !channelType || type === channelType).map((type) => ({
      channelType: type, profiles: profiles.filter((x) => x.channelType === type),
      subscriptions: subscriptions.filter((x) => x.channelType === type),
      integrationStatus: type === 'VK' ? 'BLOCKED_EXTERNAL' : 'UNAVAILABLE',
    }));
  }
  async subscriptions(customerId, context) { this.authorize(context); await this.ensureCustomer(customerId); return this.repository.listSubscriptions(customerId); }
  async saveManualProfile(customerId, input, context, id) {
    this.authorize(context); await this.ensureCustomer(customerId);
    const channelType = enumValue(input.channelType, CHANNEL_TYPES, 'channelType');
    const previous = id && this.repository.findProfile(id);
    if (id && (!previous || previous.customerId !== customerId || previous.source !== 'MANUAL')) throw new ApiError({ statusCode: 404, code: 'MANUAL_EXTERNAL_PROFILE_NOT_FOUND', message: 'Ручной профиль не найден.' });
    const now = this.clock().toISOString();
    const value = new CustomerExternalProfile({
      ...(previous || {}), ...input, id: previous?.id || randomUUID(), customerId, channelType,
      source: 'MANUAL', isVerified: false, verifiedAt: null, verificationMethod: 'MANUAL',
      status: input.status || 'UNKNOWN', actorId: context.actorId, auditReason: required(input.auditReason, 'auditReason'),
      createdAt: previous?.createdAt || now, updatedAt: now,
    });
    this.repository.saveProfile(value);
    await this.publish('CUSTOMER_EXTERNAL_PROFILE_LINKED', customerId, value, context);
    return value;
  }
  async saveManualSubscription(customerId, input, context, id) {
    this.authorize(context); await this.ensureCustomer(customerId);
    const channelType = enumValue(input.channelType, CHANNEL_TYPES, 'channelType');
    const targetType = enumValue(input.targetType, TARGET_TYPES, 'targetType');
    const previous = id && this.repository.findSubscription(id);
    if (id && (!previous || previous.customerId !== customerId || previous.source !== 'MANUAL')) throw new ApiError({ statusCode: 404, code: 'MANUAL_SUBSCRIPTION_NOT_FOUND', message: 'Ручная подписка не найдена.' });
    const now = this.clock().toISOString();
    const subscribed = Boolean(input.isSubscribed);
    const value = new CustomerChannelSubscription({
      ...(previous || {}), ...input, id: previous?.id || randomUUID(), customerId, channelType, targetType,
      source: 'MANUAL', verificationStatus: 'NOT_VERIFIED', actorId: context.actorId,
      auditReason: required(input.auditReason, 'auditReason'), subscribedAt: subscribed ? (input.subscribedAt || previous?.subscribedAt || now) : null,
      unsubscribedAt: subscribed ? null : (input.unsubscribedAt || now), createdAt: previous?.createdAt || now, updatedAt: now,
    });
    this.repository.saveSubscription(value);
    await this.publish('CUSTOMER_CHANNEL_SUBSCRIPTION_CHANGED', customerId, value, context);
    return value;
  }
  async engagement(customerId, context) {
    this.authorize(context); const customer = await this.customerRepository.findCustomer(customerId);
    if (!customer) throw new ApiError({ statusCode: 404, code: 'CUSTOMER_360_NOT_FOUND', message: 'Профиль клиента не найден.' });
    const profiles = this.repository.listProfiles(customerId); const subscriptions = this.repository.listSubscriptions(customerId);
    const checks = [
      ['Подтверждён телефон', 12, Boolean(customer.phoneVerifiedAt)],
      ['Подтверждён email', 10, profiles.some((x) => x.channelType === 'EMAIL' && x.isVerified)],
      ['Подтверждён Telegram', 9, profiles.some((x) => x.channelType === 'TELEGRAM' && x.isVerified)],
      ['Подтверждён MAX', 8, profiles.some((x) => x.channelType === 'MAX' && x.isVerified)],
      ['Подтверждён VK', 9, profiles.some((x) => x.channelType === 'VK' && x.isVerified)],
      ['Подписка на Telegram-канал', 7, subscriptions.some((x) => x.channelType === 'TELEGRAM' && x.isSubscribed)],
      ['Подписка на VK-сообщество', 7, subscriptions.some((x) => x.channelType === 'VK' && x.isSubscribed)],
      ['Маркетинговое согласие', 10, customer.consents?.some((x) => x.consentType === 'MARKETING' && x.isGranted)],
      ['Есть покупки', 10, customer.orders?.some((x) => ['PAID', 'COMPLETED'].includes(x.status))],
      ['Реферальная активность', 6, Boolean(customer.referralsMade?.length)],
      ['Участие в акциях', 6, Boolean(customer.promotionParticipations?.length)],
      ['Игровая активность', 6, Boolean(customer.gameActivities?.length)],
    ];
    const factors = checks.map(([name, weight, active]) => ({ code: name, explanation: active ? `${name}: учтено` : `${name}: данных нет`, contribution: active ? weight : 0, maximum: weight }));
    const score = factors.reduce((sum, x) => sum + x.contribution, 0);
    const summary = new CustomerEngagementSummary({ score, level: score >= 80 ? 'VERY_HIGH' : score >= 55 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW', factors, calculatedAt: this.clock().toISOString(), modelVersion: 'deterministic-v1', dataCompleteness: Math.round(checks.filter((x) => x[2]).length / checks.length * 100) });
    await this.publish('CUSTOMER_ENGAGEMENT_RECALCULATED', customerId, summary, context); return summary;
  }
  publish(eventType, customerId, payload, context) { return this.eventPublisher?.publish?.({ eventType, eventVersion: 1, aggregateType: 'CUSTOMER_360', aggregateId: customerId, actorType: 'ADMINISTRATOR', actorId: context.actorId, sourceChannel: 'ADMIN_API', correlationId: context.correlationId || randomUUID(), payload, metadata: {}, occurredAt: this.clock() }); }
}
function required(value, field) { if (!String(value || '').trim()) throw new ApiError({ statusCode: 400, code: 'MANUAL_AUDIT_REASON_REQUIRED', message: `Поле ${field} обязательно.` }); return String(value).trim(); }
function enumValue(value, values, field) { const normalized = String(value || '').toUpperCase(); if (!values.includes(normalized)) throw new ApiError({ statusCode: 400, code: 'INVALID_EXTERNAL_CHANNEL_DATA', message: `Недопустимое значение ${field}.` }); return normalized; }
module.exports = { ExternalChannelService };
