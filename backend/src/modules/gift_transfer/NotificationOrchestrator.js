'use strict';

const crypto = require('crypto');
const { DELIVERY_STATUS } = require('./GiftTransferModels');

class NotificationChannelAdapter {
  constructor(channel) { this.channel = channel; }
  async send() { return { status: DELIVERY_STATUS.UNAVAILABLE }; }
}

class TelegramNotificationAdapter extends NotificationChannelAdapter {
  constructor(options = null) {
    super('TELEGRAM');
    if (typeof options === 'function') this.sender = options;
    else Object.assign(this, { sender: null, bindingService: null, client: null, enabled: false, miniAppUrl: null }, options || {});
  }

  async send(notification) {
    if (this.sender) return this.sender(notification);
    if (!this.enabled) return unavailable('TELEGRAM_GIFT_NOTIFICATIONS_DISABLED');
    if (!this.bindingService || !this.client) return unavailable('TELEGRAM_ADAPTER_NOT_CONFIGURED');
    if (!notification.recipientCustomerId) return unavailable('RECIPIENT_NOT_REGISTERED');
    const binding = await this.bindingService.resolve(notification.recipientCustomerId, 'telegram');
    if (!binding || binding.recipientType !== 'chat_id') return unavailable('TELEGRAM_RECIPIENT_NOT_BOUND');
    const result = await this.client.sendMessage(binding.recipientId, giftText(notification), {
      ...(this.miniAppUrl ? { reply_markup: { inline_keyboard: [[{ text: 'Открыть мои подарки', url: this.miniAppUrl }]] } } : {}),
    });
    return { status: DELIVERY_STATUS.SENT, providerMessageId: providerId(result?.message_id), metadata: { recipientBinding: 'encrypted' } };
  }
}

class MaxNotificationAdapter extends NotificationChannelAdapter {
  constructor(options = null) {
    super('MAX');
    if (typeof options === 'function') this.sender = options;
    else Object.assign(this, { sender: null, bindingService: null, client: null, enabled: false, miniAppUrl: null }, options || {});
  }

  async send(notification) {
    if (this.sender) return this.sender(notification);
    if (!this.enabled) return unavailable('MAX_GIFT_NOTIFICATIONS_DISABLED');
    if (!this.bindingService || !this.client) return unavailable('MAX_ADAPTER_NOT_CONFIGURED');
    if (!notification.recipientCustomerId) return unavailable('RECIPIENT_NOT_REGISTERED');
    const binding = await this.bindingService.resolve(notification.recipientCustomerId, 'max');
    if (!binding || binding.recipientType !== 'user_id') return unavailable('MAX_RECIPIENT_NOT_BOUND');
    const attachments = this.miniAppUrl ? [{ type: 'inline_keyboard', payload: { buttons: [[{ type: 'link', text: 'Открыть мои подарки', url: this.miniAppUrl }]] } }] : null;
    const result = await this.client.sendMessage({ userId: binding.recipientId, text: giftText(notification), attachments });
    return { status: DELIVERY_STATUS.SENT, providerMessageId: providerId(result?.message?.mid || result?.message?.id || result?.mid), metadata: { recipientBinding: 'encrypted' } };
  }
}

class MockMaxNotificationAdapter extends MaxNotificationAdapter {
  constructor(result = { status: DELIVERY_STATUS.SENT, providerMessageId: 'mock-max-message' }) { super(async () => result); }
}

class NotificationOrchestrator {
  constructor({ repository, adapters = [], clock = () => new Date() }) { this.repository = repository; this.adapters = new Map(adapters.map((a) => [a.channel, a])); this.clock = clock; }
  async send(notification) {
    const attempts = [];
    for (const channel of notification.channels) {
      const adapter = this.adapters.get(channel); const now = this.clock();
      let result = unavailable('CHANNEL_NOT_CONFIGURED');
      try { if (adapter) result = await adapter.send(notification); } catch (error) { result = { status: DELIVERY_STATUS.FAILED, failureCode: error.code || `PROVIDER_HTTP_${error.status || 'ERROR'}` }; }
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

function giftText(notification) {
  const sender = notification.senderName ? ` от ${notification.senderName}` : '';
  return `${notification.title || 'Вам подарили мороженое 🎁'}${sender}. Откройте раздел «Мои подарки», чтобы принять подарок.`;
}
function unavailable(failureCode) { return { status: DELIVERY_STATUS.UNAVAILABLE, failureCode }; }
function providerId(value) { return value === undefined || value === null || value === '' ? null : String(value); }

module.exports = { NotificationOrchestrator, NotificationChannelAdapter, TelegramNotificationAdapter, MaxNotificationAdapter, MockMaxNotificationAdapter, giftText };
