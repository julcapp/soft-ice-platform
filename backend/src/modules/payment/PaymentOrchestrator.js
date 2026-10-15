'use strict';

const crypto = require('node:crypto');

class PaymentOrchestrator {
  constructor({ repository, adapter, orderRuntime, fiftiethPurchaseGiftResolver = null } = {}) {
    if (!repository) throw new Error('Payment repository is required.');
    if (!adapter) throw new Error('Payment adapter is required.');
    if (!orderRuntime) throw new Error('Order runtime is required.');
    this.repository = repository;
    this.adapter = adapter;
    this.orderRuntime = orderRuntime;
    this.fiftiethPurchaseGiftResolver = fiftiethPurchaseGiftResolver;
  }

  async startPayment({ orderId, customerId, method = 'sbp', returnUrl, idempotencyKey = null }) {
    const order = await this.orderRuntime.orderService.orderRepository.findById(orderId);
    if (!order || (customerId && order.customerId !== customerId)) throw this._error('PAYMENT_ORDER_NOT_FOUND', 'Order was not found.', 404);
    if (order.status === 'PAID') return { alreadyPaid: true, order };
    const amount = Number(order.amount ?? order.amountPaidRub ?? 0);
    if (!(amount > 0)) throw this._error('PAYMENT_NOT_REQUIRED', 'This order does not require an external payment.', 409);
    if (!['PAYMENT_PENDING', 'CREATED'].includes(order.status)) throw this._error('PAYMENT_ORDER_STATUS_INVALID', `Order status ${order.status} cannot start payment.`, 409);

    const key = idempotencyKey || `order:${orderId}:payment:${crypto.randomUUID()}`;
    let attempt;
    try {
      attempt = await this.repository.createAttempt({ orderId, method, amount, currency: order.currency || 'RUB', idempotencyKey: key });
    } catch (error) {
      if (error?.code === 'P2002') {
        const existing = (await this.repository.findByOrderId(orderId)).find((row) => row.idempotencyKey === key);
        if (existing) return existing;
      }
      throw error;
    }

    const payment = await this.adapter.createPayment({
      orderId,
      amount,
      currency: order.currency || 'RUB',
      method,
      returnUrl,
      idempotencyKey: key,
    });
    return this.repository.attachProviderPayment(attempt.id, payment);
  }

  async handleWebhook(notification, context = {}) {
    if (!notification || notification.type !== 'notification' || !notification.object?.id) {
      throw this._error('YOOKASSA_WEBHOOK_INVALID', 'Invalid YooKassa notification payload.', 400);
    }
    const providerPaymentId = notification.object.id;
    const attempt = await this.repository.findByProviderPaymentId(providerPaymentId);
    if (!attempt) throw this._error('YOOKASSA_PAYMENT_ATTEMPT_NOT_FOUND', 'Payment attempt was not found.', 404);

    // Never trust webhook monetary/status fields alone: verify current object via YooKassa API.
    const payment = await this.adapter.getPayment(providerPaymentId);
    const metadataOrderId = payment?.metadata?.order_id;
    if (metadataOrderId !== attempt.orderId) throw this._error('YOOKASSA_ORDER_MISMATCH', 'Verified YooKassa payment does not match the local order.', 409);
    if (payment?.amount?.currency !== attempt.currency || Number(payment?.amount?.value) !== Number(attempt.amount)) {
      throw this._error('YOOKASSA_AMOUNT_MISMATCH', 'Verified YooKassa amount does not match the local order.', 409);
    }

    if (payment.status === 'succeeded' && payment.paid === true) {
      await this.repository.markSucceeded(attempt.id, payment);
      const confirmed = await this.orderRuntime.confirmPayment(attempt.orderId, {
        ...context,
        actorType: 'system',
        actorId: 'yookassa_webhook',
        sourceChannel: 'yookassa_webhook',
        idempotencyKey: `yookassa:${providerPaymentId}:succeeded`,
      });
      const order = confirmed.order;
      if (this.fiftiethPurchaseGiftResolver && order?.machineId) {
        await this.fiftiethPurchaseGiftResolver.completePurchase({ customerId: order.customerId, machineId: order.machineId, orderId: order.id });
      }
      return { accepted: true, status: 'SUCCEEDED', order: confirmed.order, changed: confirmed.changed };
    }

    if (payment.status === 'canceled') {
      await this.repository.markCancelled(attempt.id, payment);
      return { accepted: true, status: 'CANCELLED', orderId: attempt.orderId };
    }

    return { accepted: true, status: String(payment.status || 'UNKNOWN').toUpperCase(), orderId: attempt.orderId };
  }

  _error(code, message, statusCode, details = []) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    error.details = details;
    error.source = 'payment';
    return error;
  }
}

module.exports = { PaymentOrchestrator };
