const { ApiError } = require('../../platform/errors/ApiError');

const ACTIONS = new Set(['COPY', 'SHARE', 'SEND']);
const DESTINATIONS = new Set(['TELEGRAM', 'VK', 'MAX', 'SYSTEM_SHARE', 'CLIPBOARD', 'OTHER']);

class ReferralEngagementService {
  constructor({ prisma, clock = () => new Date() }) {
    if (!prisma) throw new Error('prisma is required');
    this.prisma = prisma;
    this.clock = clock;
  }

  async record(customerId, request = {}, context = {}) {
    const action = String(request.action || '').trim().toUpperCase();
    const destination = String(request.destination || defaultDestination(action)).trim().toUpperCase();
    if (!ACTIONS.has(action)) throw validation('REFERRAL_ENGAGEMENT_ACTION_INVALID', 'Неизвестное действие с реферальной ссылкой.');
    if (!DESTINATIONS.has(destination)) throw validation('REFERRAL_ENGAGEMENT_DESTINATION_INVALID', 'Неизвестный канал отправки реферальной ссылки.');

    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!customer) throw new ApiError({ statusCode: 404, code: 'CUSTOMER_NOT_FOUND', message: 'Пользователь не найден.' });

    return this.prisma.auditEvent.create({ data: {
      eventType: 'Referral.LinkAction',
      subjectType: 'customer',
      subjectId: customerId,
      targetType: 'REFERRAL_LINK',
      targetId: customerId,
      action: `REFERRAL_LINK_${action}`,
      decision: 'success',
      authMethod: context.authMethod || null,
      sourceChannel: context.sourceChannel || 'miniapp',
      correlationId: context.correlationId || null,
      metadata: { action, destination, surface: String(request.surface || 'REFERRAL_SECTION').slice(0, 80) },
      occurredAt: this.clock(),
    } });
  }
}

function defaultDestination(action) { return action === 'COPY' ? 'CLIPBOARD' : 'SYSTEM_SHARE'; }
function validation(code, message) { return new ApiError({ statusCode: 400, code, message, source: 'runtime' }); }
module.exports = { ReferralEngagementService, ACTIONS, DESTINATIONS };
