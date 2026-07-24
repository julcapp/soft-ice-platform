const { randomUUID } = require('crypto');
const { ApiError } = require('../../platform/errors/ApiError');

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
    return toCustomerCard(customer);
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
    const delivery = await this.repository.createNotification({
      id: request.id || randomUUID(),
      customerId,
      campaignId: request.campaignId || null,
      channel: request.channel || card.profile?.preferredChannel || 'TELEGRAM',
      subject: request.subject || null,
      body: request.body,
      status: 'QUEUED',
      idempotencyKey: context.idempotencyKey || null,
      correlationId: context.correlationId || null,
      createdBy: context.actorId,
    });
    await this.audit('CRM.NotificationQueued', delivery.id, context, { customer_id: customerId });
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
  return {
    id: customer.id,
    name: customer.name || 'Без имени',
    phone: customer.phone,
    email: customer.email,
    status: customer.status,
    clubBalanceRub: Number(customer.clubAccount?.availableBalanceRub || 0),
    bonusBalance: Number(customer.bonusAccount?.balanceBonus || 0),
    segments: customer.segmentAssignments.map(({ segment }) => ({ id: segment.id, code: segment.code, name: segment.name })),
    lastPurchaseAt: customer.orders[0]?.createdAt || null,
  };
}

function toCustomerCard(customer) {
  return {
    ...toCustomerSummary(customer),
    birthday: customer.birthday,
    createdAt: customer.createdAt,
    profile: customer.crmProfile,
    loyalty: {
      clubAccount: customer.clubAccount && {
        id: customer.clubAccount.id,
        status: customer.clubAccount.status,
        currency: customer.clubAccount.currency,
        availableBalanceRub: customer.clubAccount.availableBalanceRub,
      },
      bonusAccount: customer.bonusAccount,
    },
    operations: customer.clubAccount?.transactions || [],
    purchases: customer.orders || [],
    accruals: customer.bonusTransactions || [],
    referrals: { invited: customer.referralsMade || [], source: customer.referredBy?.[0] || null },
    notifications: customer.notificationDeliveries || [],
  };
}

function notFound(message) {
  return new ApiError({ statusCode: 404, code: 'RESOURCE_NOT_FOUND', message, source: 'runtime' });
}

module.exports = { CRMService, toCustomerCard, toCustomerSummary };
