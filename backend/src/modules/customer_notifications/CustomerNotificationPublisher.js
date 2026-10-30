'use strict';

const { KIND } = require('./CustomerNotificationService');

class CustomerNotificationPublisher {
  constructor({
    prisma,
    bindingService,
    telegramClient = null,
    maxClient = null,
    smsClient = null,
    miniAppUrl = 'https://app.utimoshi.ru',
    notificationService,
    logger = console,
  } = {}) {
    if (!prisma) throw new Error('prisma is required');
    if (!notificationService) throw new Error('notificationService is required');
    Object.assign(this, { prisma, bindingService, telegramClient, maxClient, smsClient, miniAppUrl, notificationService, logger });
  }

  async publish(event) {
    const customerId = event?.payload?.customerId;
    if (!customerId) throw permanent('CUSTOMER_NOTIFICATION_CUSTOMER_REQUIRED');

    if (event.payload.kind === KIND.SMS_FALLBACK) {
      return this.sendSms(customerId, event);
    }

    const message = await this.messageFor(event.payload.kind, customerId, event.payload.orderId);
    const sent = await this.sendPreferredBoundChannel(customerId, message);
    if (sent) return sent;

    await this.notificationService.scheduleSmsFallback(customerId, event.eventId, {
      machineId: event.payload.machineId || null,
      orderId: event.payload.orderId || null,
      correlationId: event.correlationId || null,
    });
    return { status: 'SMS_FALLBACK_SCHEDULED' };
  }

  async sendPreferredBoundChannel(customerId, message) {
    if (!this.bindingService) return null;
    for (const [channel, client] of [['telegram', this.telegramClient], ['max', this.maxClient]]) {
      if (!client) continue;
      const binding = await this.bindingService.resolve(customerId, channel);
      if (!binding) continue;
      try {
        if (channel === 'telegram' && binding.recipientType === 'chat_id') {
          const result = await client.sendMessage(binding.recipientId, message.text, {
            reply_markup: { inline_keyboard: [[{ text: 'Открыть Личный кабинет', url: this.miniAppUrl }]] },
          });
          return { channel: 'TELEGRAM', providerMessageId: String(result?.message_id || '') };
        }
        if (channel === 'max' && binding.recipientType === 'user_id') {
          const result = await client.sendMessage({
            userId: binding.recipientId,
            text: message.text,
            attachments: [{ type: 'inline_keyboard', payload: { buttons: [[{ type: 'link', text: 'Открыть Личный кабинет', url: this.miniAppUrl }]] } }],
          });
          return { channel: 'MAX', providerMessageId: String(result?.message?.mid || result?.message?.id || result?.mid || '') };
        }
      } catch (error) {
        this.logger?.error?.('customer.notification.channel_failed', { customerId, channel, code: error.code || 'SEND_FAILED' });
      }
    }
    return null;
  }

  async sendSms(customerId, event) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { phone: true, phoneVerifiedAt: true } });
    if (!customer?.phone || !customer.phoneVerifiedAt) throw permanent('CUSTOMER_SMS_PHONE_NOT_VERIFIED');
    if (!this.smsClient?.sendMessage) throw deferred('CUSTOMER_SMS_PROVIDER_NOT_CONFIGURED', new Date(Date.now() + 15 * 60 * 1000));

    const originalKind = event.payload.orderId ? KIND.PURCHASE_COMPLETED : KIND.RECOGNITION_WELCOME;
    const message = await this.messageFor(originalKind, customerId, event.payload.orderId);
    const result = await this.smsClient.sendMessage({ to: customer.phone, text: `${message.text}\n${this.miniAppUrl}` });
    return { channel: 'SMS', providerMessageId: String(result?.id || result?.messageId || '') };
  }

  async messageFor(kind, customerId, orderId = null) {
    if (kind === KIND.RECOGNITION_WELCOME) {
      const balances = await this.balances(customerId);
      return { text: `С возвращением в «Клуб Тимоши»! Ваш профиль найден. Баланс: ${money(balances.availableRub)}. Бонусы: ${balances.bonus}. Откройте Личный кабинет, чтобы посмотреть и использовать их.` };
    }
    if (kind === KIND.PURCHASE_COMPLETED) {
      const [balances, order] = await Promise.all([
        this.balances(customerId),
        this.prisma.order.findFirst({ where: { id: orderId, customerId }, select: { id: true, amountPaidRub: true, amount: true, currency: true, bonusEarned: true, status: true } }),
      ]);
      if (!order || order.status !== 'COMPLETED') throw permanent('CUSTOMER_PURCHASE_NOT_COMPLETED');
      return { text: `Покупка мороженого завершена. Оплачено: ${money(order.amountPaidRub ?? order.amount)}. Начислено бонусов: ${Number(order.bonusEarned || 0)}. Текущий баланс: ${money(balances.availableRub)}. Бонусов всего: ${balances.bonus}.` };
    }
    throw permanent('CUSTOMER_NOTIFICATION_KIND_UNSUPPORTED');
  }

  async balances(customerId) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { clubAccount: { select: { availableBalanceRub: true } }, bonusAccount: { select: { balanceBonus: true } } },
    });
    return {
      availableRub: Number(customer?.clubAccount?.availableBalanceRub || 0),
      bonus: Number(customer?.bonusAccount?.balanceBonus || 0),
    };
  }
}

function money(value) { return `${Number(value || 0).toFixed(2).replace('.', ',')} ₽`; }
function permanent(code) { const error = new Error(code); error.code = code; error.permanent = true; return error; }
function deferred(code, availableAt) { const error = new Error(code); error.code = code; error.deferWithoutAttempt = true; error.availableAt = availableAt; return error; }

module.exports = { CustomerNotificationPublisher };
