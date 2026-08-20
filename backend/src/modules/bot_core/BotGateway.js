const { parseStartPayload } = require('./DeepLinkParser');

class BotGateway {
  constructor({ customerIdentityRegistry, eventCenter, onboardingService = null, adapters = [] } = {}) {
    this.customerIdentityRegistry = customerIdentityRegistry || null;
    this.eventCenter = eventCenter || null;
    this.onboardingService = onboardingService;
    this.adapters = new Map(adapters.map((adapter) => [adapter.channel, adapter]));
  }

  registerAdapter(adapter) {
    if (!adapter?.channel) {
      throw new Error('Bot adapter channel is required.');
    }
    this.adapters.set(adapter.channel, adapter);
  }

  getAdapter(channel) {
    const adapter = this.adapters.get(channel);
    if (!adapter) {
      throw new Error(`Bot adapter is not registered for channel: ${channel}`);
    }
    return adapter;
  }

  async handleStart({ channel, externalUserId, payload = null, profile = {}, metadata = {} }) {
    if (!channel || !externalUserId) {
      throw new Error('channel and externalUserId are required.');
    }

    const context = parseStartPayload(payload);
    const normalized = {
      channel,
      externalUserId: String(externalUserId),
      profile,
      context,
      metadata,
      receivedAt: new Date().toISOString(),
    };

    await this.publishEvent('BOT_START_RECEIVED', normalized);

    if (!this.onboardingService || typeof this.onboardingService.start !== 'function') {
      return normalized;
    }

    const onboarding = await this.onboardingService.start(normalized);
    return { ...normalized, onboarding };
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

module.exports = {
  BotGateway,
};
