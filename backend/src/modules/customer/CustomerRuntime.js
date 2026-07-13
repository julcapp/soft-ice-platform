const { ApiError } = require('../../platform/errors/ApiError');

class CustomerRuntime {
  constructor({ customerRepository, auditRepository }) {
    this.customerRepository = customerRepository;
    this.auditRepository = auditRepository;
  }

  async resolveOrCreateTelegramCustomer(telegramIdentity, context) {
    const displayName = buildDisplayName(telegramIdentity.user);
    const existing = await this.customerRepository.findByIdentity(
      'telegram',
      telegramIdentity.subjectHash,
    );

    if (existing) {
      const updated = await this.customerRepository.updateTelegramIdentitySeen(
        existing.identity.id,
        {
          displayName,
          username: telegramIdentity.user.username,
        },
      );

      return {
        customer: updated.customer,
        created: false,
      };
    }

    const created = await this.customerRepository.createTelegramCustomer({
      telegramIdentity,
      displayName,
      sourceChannel: context.sourceChannel,
    });

    await this.auditRepository.record({
      eventType: 'Customers.TelegramIdentityLinked',
      subjectType: 'user',
      subjectId: created.customer.id,
      targetType: 'CustomerIdentity',
      targetId: created.identity.id,
      action: 'link',
      decision: 'success',
      reasonCode: 'telegram_mini_app_registration',
      authMethod: 'telegram_init_data',
      sourceChannel: context.sourceChannel,
      correlationId: context.correlationId,
      metadata: {
        provider: 'telegram',
      },
    });

    return {
      customer: created.customer,
      created: true,
    };
  }

  async getOwnProfile(customerId) {
    const customer = await this.customerRepository.findById(customerId);

    if (!customer) {
      throw new ApiError({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Customer was not found.',
        source: 'runtime',
      });
    }

    return customer;
  }
}

function buildDisplayName(user) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || null;
}

module.exports = {
  CustomerRuntime,
  buildDisplayName,
};
