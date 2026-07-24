const { randomUUID } = require('crypto');
const { ApiError } = require('../../platform/errors/ApiError');

const TITLES = {
  ORDER: 'Покупка',
  CLUB_ACCOUNT: 'Операция по клубному счёту',
  BONUS: 'Операция с бонусами',
  COMMUNICATION: 'Коммуникация',
  REFERRAL: 'Реферальная активность',
  GAME: 'Игровая активность',
  PROMOTION: 'Участие в акции',
  IDENTITY: 'Идентификация клиента',
  CONSENT: 'Решение по согласию',
  TIMELINE: 'Событие клиента',
};

class Customer360Service {
  constructor({ repository, eventPublisher, clock = () => new Date() }) {
    this.repository = repository;
    this.eventPublisher = eventPublisher;
    this.clock = clock;
  }

  async getProfile(customerId) {
    const customer = await this.repository.findCustomer(customerId);
    if (!customer) throw new ApiError({ statusCode: 404, code: 'CUSTOMER_360_NOT_FOUND', message: 'Профиль клиента не найден.' });
    return projectProfile(customer);
  }

  async getTimeline(customerId, { category, limit = 100 } = {}) {
    const customer = await this.repository.findCustomer(customerId);
    if (!customer) throw new ApiError({ statusCode: 404, code: 'CUSTOMER_360_NOT_FOUND', message: 'Профиль клиента не найден.' });
    const timeline = buildTimeline(customer)
      .filter((event) => !category || event.category === String(category).toUpperCase())
      .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
    return timeline.slice(0, Math.min(Math.max(Number(limit) || 100, 1), 200));
  }

  async setPreference(customerId, request, context = {}) {
    const input = validatePreference(request);
    await this.getProfile(customerId);
    const preference = await this.repository.upsertPreference(customerId, input, context.actorId || 'customer');
    const event = await this.repository.createTimelineEvent({
      customerId,
      eventType: 'Customer360.PreferenceUpdated',
      category: 'PREFERENCE',
      title: 'Предпочтение обновлено',
      description: `${input.category}: ${input.key}`,
      sourceDomain: 'CUSTOMER_360',
      sourceEntityType: 'CustomerPreference',
      sourceEntityId: preference.id,
      correlationId: context.correlationId || randomUUID(),
      metadata: { category: input.category, key: input.key, source: input.source },
      occurredAt: this.clock(),
    });
    await this.eventPublisher?.publish?.({
      eventType: event.eventType,
      eventVersion: 1,
      aggregateType: 'CUSTOMER_360',
      aggregateId: customerId,
      actorType: context.actorId === customerId ? 'CUSTOMER' : 'ADMINISTRATOR',
      actorId: context.actorId || 'customer-360',
      sourceChannel: 'CUSTOMER_360_API',
      correlationId: event.correlationId,
      payload: event,
      metadata: { preferenceId: preference.id },
      occurredAt: event.occurredAt,
    });
    return preference;
  }
}

function validatePreference(request = {}) {
  const category = String(request.category || '').trim().toUpperCase();
  const key = String(request.key || '').trim();
  const source = String(request.source || 'EXPLICIT').trim().toUpperCase();
  const confidence = request.confidence === undefined ? 1 : Number(request.confidence);
  if (!category || !key || request.value === undefined) {
    throw new ApiError({ statusCode: 400, code: 'CUSTOMER_360_INVALID_PREFERENCE', message: 'Укажите категорию, ключ и значение предпочтения.' });
  }
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new ApiError({ statusCode: 400, code: 'CUSTOMER_360_INVALID_CONFIDENCE', message: 'Достоверность должна быть числом от 0 до 1.' });
  }
  return { category, key, value: request.value, source, confidence };
}

function projectProfile(customer) {
  const completedOrders = customer.orders.filter((order) => order.status === 'COMPLETED' || order.status === 'PAID');
  const spent = completedOrders.reduce((sum, order) => sum + Number(order.amountPaidRub ?? order.amount ?? 0), 0);
  return {
    id: customer.id,
    identification: {
      name: customer.name, phone: customer.phone, phoneVerifiedAt: customer.phoneVerifiedAt,
      email: customer.email, telegramUsername: customer.telegramUsername, birthday: customer.birthday,
      status: customer.status, identities: customer.identities, consents: customer.consents,
    },
    loyalty: {
      clubAccount: customer.clubAccount,
      bonusAccount: customer.bonusAccount,
      segments: customer.segmentAssignments.map((item) => item.segment),
    },
    purchaseHistory: customer.orders,
    purchaseSummary: { count: completedOrders.length, spentRub: spent, lastPurchaseAt: customer.orders[0]?.createdAt || null },
    preferences: customer.customerPreferences,
    communications: customer.notificationDeliveries,
    promotions: customer.promotionParticipations,
    referrals: { invited: customer.referralsMade, referredBy: customer.referredBy[0] || null },
    games: { activities: customer.gameActivities, photoChallenges: customer.photoChallenges, birthdayRewards: customer.birthdayRewards },
    aiProfile: customer.aiProfile || {
      schemaVersion: 1, status: 'FOUNDATION_ONLY', featureSnapshot: null, summary: null,
      modelReference: null, calculatedAt: null,
    },
    capabilities: {
      crm: true, runtime: true, digitalTwin: true, inventory: true, maintenance: true,
      adminConsole: true, operatorWorkspace: true, miniApp: true,
    },
  };
}

function buildTimeline(customer) {
  const stored = customer.timelineEvents.map((event) => ({ ...event, origin: 'STORED' }));
  const map = (items, config) => items.map((item) => ({
    id: `${config.domain}:${item.id}`, eventType: config.type(item), category: config.category,
    title: TITLES[config.category] || TITLES.TIMELINE, description: config.description(item),
    sourceDomain: config.domain, sourceEntityType: config.entity, sourceEntityId: item.id,
    occurredAt: config.at(item), metadata: config.metadata?.(item) || {}, origin: 'PROJECTION',
  }));
  return [
    ...stored,
    ...map(customer.orders, { domain: 'ORDERS', entity: 'Order', category: 'ORDER', type: (x) => `Order.${x.status}`, at: (x) => x.paidAt || x.createdAt, description: (x) => `Заказ ${x.id}: ${x.status}`, metadata: (x) => ({ amountRub: x.amountPaidRub ?? x.amount, machineId: x.machineId }) }),
    ...map(customer.clubAccount?.transactions || [], { domain: 'CLUB_ACCOUNT', entity: 'ClubAccountTransaction', category: 'CLUB_ACCOUNT', type: (x) => `ClubAccount.${x.transactionType}`, at: (x) => x.postedAt, description: (x) => `${x.reason}: ${x.amountRub} ₽` }),
    ...map(customer.bonusTransactions, { domain: 'BONUS', entity: 'BonusTransaction', category: 'BONUS', type: (x) => `Bonus.${x.type}`, at: (x) => x.postedAt, description: (x) => `${x.reason || x.source}: ${x.amountBonus} бонусов` }),
    ...map(customer.notificationDeliveries, { domain: 'CRM', entity: 'CrmNotificationDelivery', category: 'COMMUNICATION', type: (x) => `Communication.${x.status}`, at: (x) => x.sentAt || x.createdAt, description: (x) => `${x.channel}: ${x.body}` }),
    ...map(customer.referralsMade, { domain: 'REFERRALS', entity: 'Referral', category: 'REFERRAL', type: (x) => `Referral.${x.status}`, at: (x) => x.firstPurchaseAt || x.createdAt, description: (x) => `Приглашение по коду ${x.referralCode}` }),
    ...map(customer.gameActivities, { domain: 'GAMIFICATION', entity: 'CustomerGameActivity', category: 'GAME', type: (x) => `Game.${x.activityType}`, at: (x) => x.occurredAt, description: (x) => `${x.gameCode}: ${x.status}` }),
    ...map(customer.promotionParticipations, { domain: 'PROMOTIONS', entity: 'CustomerPromotionParticipation', category: 'PROMOTION', type: (x) => `Promotion.${x.status}`, at: (x) => x.completedAt || x.joinedAt, description: (x) => `Акция ${x.promotionCode}: ${x.status}` }),
    ...map(customer.identities, { domain: 'CUSTOMER_IDENTITY', entity: 'CustomerIdentity', category: 'IDENTITY', type: () => 'Identity.Linked', at: (x) => x.linkedAt, description: (x) => `Подключён способ входа ${x.provider}` }),
    ...map(customer.consents, { domain: 'CONSENT', entity: 'CustomerConsent', category: 'CONSENT', type: (x) => x.isGranted ? 'Consent.Granted' : 'Consent.Revoked', at: (x) => x.revokedAt || x.consentedAt, description: (x) => `${x.consentType}: ${x.isGranted ? 'предоставлено' : 'отозвано'}` }),
  ];
}

module.exports = { Customer360Service, projectProfile, buildTimeline };
