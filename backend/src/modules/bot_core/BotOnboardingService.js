const { sha256 } = require('../../platform/security/hash');
const { IDENTITY_PROVIDER } = require('../customer/CustomerEntity');
const {
  ONBOARDING_STAGE,
  buildWelcomeMessage,
  buildSubscriptionOffer,
  buildMainMenu,
} = require('./OnboardingPolicy');

class BotOnboardingService {
  constructor({ customerService, eventCenter = null, miniAppUrl = null, telegramChannelUrl = null, maxChannelUrl = null } = {}) {
    this.customerService = customerService || null;
    this.eventCenter = eventCenter;
    this.miniAppUrl = miniAppUrl;
    this.telegramChannelUrl = telegramChannelUrl;
    this.maxChannelUrl = maxChannelUrl;
  }

  async start(session) {
    const welcome = buildWelcomeMessage(session.context);
    const customerResult = await this.resolveCustomer(session);
    const customer = customerResult?.customer || null;
    const phoneVerified = Boolean(customer?.phone && customer?.phoneVerifiedAt);

    const response = {
      stage: phoneVerified ? ONBOARDING_STAGE.VERIFIED : ONBOARDING_STAGE.PHONE_VERIFICATION_REQUIRED,
      welcome,
      customer,
      customerCreated: Boolean(customerResult?.created),
      requiresPhoneVerification: !phoneVerified,
      subscriptionOffer: phoneVerified
        ? buildSubscriptionOffer({
            telegramChannelUrl: this.telegramChannelUrl,
            maxChannelUrl: this.maxChannelUrl,
          })
        : null,
      menu: phoneVerified
        ? buildMainMenu({ miniAppUrl: this.miniAppUrl, machineId: session.context?.machineId || null })
        : [],
    };

    await this.publishEvent('BOT_ONBOARDING_STARTED', {
      channel: session.channel,
      customerId: customer?.id || null,
      context: session.context,
      stage: response.stage,
      customerCreated: response.customerCreated,
    });

    return response;
  }

  async resolveCustomer(session) {
    if (!this.customerService) {
      return { customer: null, created: false };
    }

    if (session.channel === IDENTITY_PROVIDER.TELEGRAM && typeof this.customerService.resolveOrCreateTelegramCustomer === 'function') {
      return this.customerService.resolveOrCreateTelegramCustomer({
        subjectHash: sha256(String(session.externalUserId)),
        user: {
          username: session.profile?.username || null,
          firstName: session.profile?.firstName || null,
          lastName: session.profile?.lastName || null,
        },
      }, this.toCustomerContext(session));
    }

    if (session.channel === IDENTITY_PROVIDER.MAX && typeof this.customerService.linkVerifiedExternalIdentity === 'function') {
      // MAX Bot API identity verification will be supplied by the MAX adapter/provider.
      // Until then Bot Core does not create a duplicate Customer record from an unverified subject.
      return { customer: null, created: false, pendingIdentityProvider: IDENTITY_PROVIDER.MAX };
    }

    return { customer: null, created: false };
  }

  toCustomerContext(session) {
    return {
      sourceChannel: session.channel,
      authMethod: `${session.channel}_bot`,
      correlationId: session.metadata?.correlationId || session.metadata?.updateId || null,
    };
  }

  async publishEvent(type, payload) {
    if (!this.eventCenter) return;
    if (typeof this.eventCenter.publish === 'function') {
      await this.eventCenter.publish({ type, payload });
      return;
    }
    if (typeof this.eventCenter.emit === 'function') {
      await this.eventCenter.emit(type, payload);
    }
  }
}

module.exports = { BotOnboardingService };