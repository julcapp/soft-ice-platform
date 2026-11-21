const crypto = require('crypto');
const { ApiError } = require('../../platform/errors/ApiError');

const ACTIONS = new Set(['COPY', 'SHARE', 'SEND']);
const DESTINATIONS = new Set(['TELEGRAM', 'VK', 'MAX', 'SYSTEM_SHARE', 'CLIPBOARD', 'OTHER']);

class ReferralEngagementService {
  constructor({ prisma, clock = () => new Date(), publicBaseUrl = process.env.PUBLIC_APP_BASE_URL || 'https://app.utimoshi.ru' }) {
    if (!prisma) throw new Error('prisma is required');
    this.prisma = prisma;
    this.clock = clock;
    this.publicBaseUrl = String(publicBaseUrl).replace(/\/$/, '');
  }

  async getOrCreateLink(customerId) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!customer) throw new ApiError({ statusCode: 404, code: 'CUSTOMER_NOT_FOUND', message: 'Пользователь не найден.' });
    let row = await this.prisma.referral.findFirst({ where: { referrerCustomerId: customerId, referredCustomerId: null, status: 'link_ready' }, orderBy: { createdAt: 'asc' } });
    if (!row) {
      row = await this.prisma.referral.create({ data: { referrerCustomerId: customerId, referralCode: createCode(), status: 'link_ready' } });
    }
    return { referralCode: row.referralCode, referralLink: `${this.publicBaseUrl}/?ref=${encodeURIComponent(row.referralCode)}` };
  }

  async record(customerId, request = {}, context = {}) {
    const action = String(request.action || '').trim().toUpperCase();
    const destination = String(request.destination || defaultDestination(action)).trim().toUpperCase();
    if (!ACTIONS.has(action)) throw validation('REFERRAL_ENGAGEMENT_ACTION_INVALID', 'Неизвестное действие с реферальной ссылкой.');
    if (!DESTINATIONS.has(destination)) throw validation('REFERRAL_ENGAGEMENT_DESTINATION_INVALID', 'Неизвестный канал отправки реферальной ссылки.');

    const link = await this.getOrCreateLink(customerId);
    return this.prisma.auditEvent.create({ data: {
      eventType: 'Referral.LinkAction',
      subjectType: 'customer',
      subjectId: customerId,
      targetType: 'REFERRAL_LINK',
      targetId: link.referralCode,
      action: `REFERRAL_LINK_${action}`,
      decision: 'success',
      authMethod: context.authMethod || null,
      sourceChannel: context.sourceChannel || 'miniapp',
      correlationId: context.correlationId || null,
      metadata: { action, destination, referralCode: link.referralCode, surface: String(request.surface || 'REFERRAL_SECTION').slice(0, 80) },
      occurredAt: this.clock(),
    } });
  }
}

function createCode() { return crypto.randomBytes(6).toString('base64url').replace(/[-_]/g, '').slice(0, 8).toUpperCase(); }
function defaultDestination(action) { return action === 'COPY' ? 'CLIPBOARD' : 'SYSTEM_SHARE'; }
function validation(code, message) { return new ApiError({ statusCode: 400, code, message, source: 'runtime' }); }
module.exports = { ReferralEngagementService, ACTIONS, DESTINATIONS };
