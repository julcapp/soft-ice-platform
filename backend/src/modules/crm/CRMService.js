const { randomUUID } = require('crypto');
const { ApiError } = require('../../platform/errors/ApiError');

const DIRECT_CHANNELS = new Set(['TELEGRAM', 'VK', 'MAX']);

class CRMService {
  constructor({ repository, clubAccountRuntime, segmentationRuntime, auditRepository, eventPublisher, clock = () => new Date() }) {
    this.repository = repository;
    this.clubAccountRuntime = clubAccountRuntime;
    this.segmentationRuntime = segmentationRuntime;
    this.auditRepository = auditRepository;
    this.eventPublisher = eventPublisher;
    this.clock = clock;
  }

  async getDashboard() {
    const summary = await this.repository.dashboard();
    const [campaigns, notifications] = await Promise.all([
      this.repository.listCampaigns(),
      this.repository.listNotifications({ limit: 10 }),
    ]);
    return { dataMode: 'LIVE', generatedAt: this.clock().toISOString(), summary, campaigns, notifications };
  }

  async listCustomers(options) {
    const customers = await this.repository.listCustomers(options);
    return customers.map(toCustomerSummary);
  }

  async getCustomerCard(customerId) {
    const customer = await this.repository.findCustomer(customerId);
    if (!customer) throw notFound('Клиент не найден.');
    const referredIds = (customer.referralsMade || []).map((item) => item.referredCustomerId).filter(Boolean);
    const referredCustomers = referredIds.length && this.repository.findCustomersByIds
      ? await this.repository.findCustomersByIds(referredIds)
      : [];
    return toCustomerCard(customer, referredCustomers);
  }

  async updateCustomerCard(customerId, request, context) {
    await this.getCustomerCard(customerId);
    const profile = await this.repository.upsertProfile(customerId, {
      managerId: request.managerId || null,
      serviceNote: request.serviceNote || null,
      preferredChannel: request.preferredChannel || 'TELEGRAM',
      communicationStatus: request.communicationStatus || 'ALLOWED',
      updatedBy: context.actorId,
    });
    await this.audit('CRM.CustomerCardUpdated', customerId, context, { profile_id: profile.id });
    return this.getCustomerCard(customerId);
  }

  async topUp(customerId, request, context) {
    const result = await this.clubAccountRuntime.topUpOwnAccount(customerId, request, {
      correlationId: context.correlationId,
      idempotencyKey: context.idempotencyKey,
      actorType: 'administrator',
      actorId: context.actorId,
      authMethod: context.authMethod,
      sourceChannel: 'crm',
    });
    await this.audit('CRM.TopUpRequested', customerId, context, { transaction_id: result.transaction.id });
    return result;
  }

  async assignSegment(customerId, segmentId, request, context) {
    return this.segmentationRuntime.assignCustomer(customerId, segmentId, {
      source: 'CRM',
      reason: request.reason || 'Назначено сотрудником CRM',
      assignedBy: context.actorId,
    }, context);
  }

  async createCampaign(request, context) {
    const campaign = await this.repository.createCampaign({
      id: request.id || randomUUID(),
      code: request.code,
      name: request.name,
      description: request.description || null,
      status: 'DRAFT',
      segmentId: request.segmentId || null,
      channel: request.channel,
      messageTemplate: request.messageTemplate,
      startsAt: request.startsAt ? new Date(request.startsAt) : null,
      endsAt: request.endsAt ? new Date(request.endsAt) : null,
      createdBy: context.actorId,
    });
    await this.audit('CRM.CampaignCreated', campaign.id, context, { code: campaign.code });
    return campaign;
  }

  async queueNotification(customerId, request, context) {
    const card = await this.getCustomerCard(customerId);
    if (card.profile?.communicationStatus === 'BLOCKED') {
      throw new ApiError({ statusCode: 422, code: 'CRM_COMMUNICATION_BLOCKED', message: 'Уведомления для клиента запрещены.', source: 'runtime' });
    }
    const channel = String(request.channel || card.profile?.preferredChannel || 'TELEGRAM').toUpperCase();
    if (DIRECT_CHANNELS.has(channel)) {
      const subscription = await this.repository.findActiveSubscription(customerId, channel);
      if (!subscription) {
        throw new ApiError({ statusCode: 422, code: 'CRM_CHANNEL_NOT_ACTIVE', message: 'Нельзя отправить сообщение: выбранный канал не подтверждён как активный.', source: 'runtime' });
      }
    }
    const delivery = await this.repository.createNotification({
      id: request.id || randomUUID(),
      customerId,
      campaignId: request.campaignId || null,
      channel,
      subject: request.subject || null,
      body: request.body,
      status: 'QUEUED',
      idempotencyKey: context.idempotencyKey || null,
      correlationId: context.correlationId || null,
      createdBy: context.actorId,
    });
    await this.audit('CRM.NotificationQueued', delivery.id, context, { customer_id: customerId, channel });
    return delivery;
  }

  async audit(eventType, targetId, context, metadata) {
    if (!this.auditRepository) return;
    await this.auditRepository.record({
      eventType, subjectType: 'administrator', subjectId: context.actorId,
      targetType: 'CRM', targetId, action: eventType, decision: 'success',
      authMethod: context.authMethod, sourceChannel: 'crm', correlationId: context.correlationId, metadata,
    });
  }
}

function toCustomerSummary(customer) {
  const activeChannels = [...new Set((customer.channelSubscriptions || []).filter((item) => item.isSubscribed).map((item) => String(item.channelType).toUpperCase()))];
  return {
    id: customer.id,
    name: customer.name || 'Без имени',
    phone: customer.phone,
    email: customer.email,
    status: customer.status,
    clubActive: Boolean(customer.clubAccount?.clubActive),
    clubBalanceRub: Number(customer.clubAccount?.availableBalanceRub || 0),
    bonusBalance: Number(customer.bonusAccount?.balanceBonus || 0),
    purchasesCount: Number(customer._count?.orders || 0),
    referralsCount: Number(customer._count?.referralsMade || 0),
    activeChannels,
    segments: (customer.segmentAssignments || []).map(({ segment }) => ({ id: segment.id, code: segment.code, name: segment.name })),
    lastPurchaseAt: customer.orders?.[0]?.createdAt || null,
    createdAt: customer.createdAt,
  };
}

function toCustomerCard(customer, referredCustomers = []) {
  const referredById = new Map(referredCustomers.map((item) => [item.id, item]));
  const invited = (customer.referralsMade || []).map((referral) => ({
    ...referral,
    referredCustomer: referral.referredCustomerId ? referredById.get(referral.referredCustomerId) || null : null,
  }));
  return {
    ...toCustomerSummary({ ...customer, _count: { orders: customer.orders?.length || 0, referralsMade: customer.referralsMade?.length || 0 } }),
    birthday: customer.birthday,
    telegramId: customer.telegramId,
    telegramUsername: customer.telegramUsername,
    vkProfile: customer.vkProfile,
    createdAt: customer.createdAt,
    profile: customer.crmProfile,
    identities: customer.identities || [],
    externalProfiles: customer.externalProfiles || [],
    channelSubscriptions: customer.channelSubscriptions || [],
    loyalty: {
      clubAccount: customer.clubAccount && {
        id: customer.clubAccount.id,
        status: customer.clubAccount.status,
        clubActive: customer.clubAccount.clubActive,
        activatedAt: customer.clubAccount.activatedAt,
        currency: customer.clubAccount.currency,
        availableBalanceRub: customer.clubAccount.availableBalanceRub,
        reservedBalanceRub: customer.clubAccount.reservedBalanceRub,
        lastTopupAt: customer.clubAccount.lastTopupAt,
      },
      bonusAccount: customer.bonusAccount,
    },
    operations: customer.clubAccount?.transactions || [],
    purchases: customer.orders || [],
    accruals: customer.bonusTransactions || [],
    referrals: { invited, source: customer.referredBy?.[0] || null },
    notifications: customer.notificationDeliveries || [],
  };
}

function notFound(message) {
  return new ApiError({ statusCode: 404, code: 'RESOURCE_NOT_FOUND', message, source: 'runtime' });
}

module.exports = { CRMService, toCustomerCard, toCustomerSummary };
