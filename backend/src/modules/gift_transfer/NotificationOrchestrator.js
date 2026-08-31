const crypto = require('crypto');
const { DELIVERY_STATUS } = require('./GiftTransferModels');
class NotificationChannelAdapter { constructor(channel) { this.channel = channel; } async send() { return { status: DELIVERY_STATUS.UNAVAILABLE }; } }
class TelegramNotificationAdapter extends NotificationChannelAdapter { constructor(sender = null) { super('TELEGRAM'); this.sender = sender; } async send(notification) { if (!this.sender) return { status: DELIVERY_STATUS.UNAVAILABLE, failureCode: 'TELEGRAM_ADAPTER_NOT_CONFIGURED' }; return this.sender(notification); } }
class MaxNotificationAdapter extends NotificationChannelAdapter { constructor(sender = null) { super('MAX'); this.sender = sender; } async send(notification) { if (!this.sender) return { status: DELIVERY_STATUS.UNAVAILABLE, failureCode: 'BLOCKED_EXTERNAL' }; return this.sender(notification); } }
class MockMaxNotificationAdapter extends MaxNotificationAdapter { constructor(result = { status: DELIVERY_STATUS.SENT, providerMessageId: 'mock-max-message' }) { super(async () => result); } }
class NotificationOrchestrator {
  constructor({ repository, adapters = [], clock = () => new Date() }) { this.repository = repository; this.adapters = new Map(adapters.map((a) => [a.channel, a])); this.clock = clock; }
  async send(notification) {
    const attempts = [];
    for (const channel of notification.channels) {
      const adapter = this.adapters.get(channel); const now = this.clock();
      let result = { status: DELIVERY_STATUS.UNAVAILABLE, failureCode: 'CHANNEL_NOT_CONFIGURED' };
      try { if (adapter) result = await adapter.send(notification); } catch (error) { result = { status: DELIVERY_STATUS.FAILED, failureCode: error.code || 'PROVIDER_ERROR' }; }
      const attempt = await this.repository.saveDelivery({ id: `delivery_${crypto.randomUUID()}`, notificationId: notification.id,
        recipientCustomerId: notification.recipientCustomerId || null, channel, providerMessageId: result.providerMessageId || null,
        status: result.status || DELIVERY_STATUS.UNKNOWN, attemptedAt: now, deliveredAt: result.status === DELIVERY_STATUS.DELIVERED ? now : null,
        openedAt: null, failedAt: result.status === DELIVERY_STATUS.FAILED ? now : null, failureCode: result.failureCode || null,
        correlationId: notification.correlationId, metadata: result.metadata || {} });
      attempts.push(attempt);
    }
    return attempts;
  }
}
module.exports = { NotificationOrchestrator, NotificationChannelAdapter, TelegramNotificationAdapter, MaxNotificationAdapter, MockMaxNotificationAdapter };
