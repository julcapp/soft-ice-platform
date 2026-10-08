'use strict';

const crypto = require('node:crypto');
const { money, sameMoney, error } = require('./PaymentModels');

class PaymentCheckoutService {
  constructor({ paymentService, repository, providers = {}, clock = () => new Date() }) {
    if (!paymentService) throw new Error('paymentService is required');
    if (!repository) throw new Error('payment repository is required');
    this.paymentService = paymentService;
    this.repository = repository;
    this.providers = providers;
    this.clock = clock;
  }

  async initiate(request, context = {}) {
    required(request, ['organizationId', 'orderId', 'provider', 'idempotencyKey', 'returnUrl']);
    const provider = String(request.provider).toUpperCase();
    const adapter = this.providers[provider];
    if (!adapter) throw error('PAYMENT_PROVIDER_UNSUPPORTED', 'Платёжный провайдер не поддерживается.', 400);

    const local = await this.paymentService.createPayment({
      ...request,
      provider,
      channel: normalizeChannel(request.channel),
    }, context);

    let payment = local.payment;
    if (payment.providerPaymentId && payment.status !== 'CREATED') {
      return this.present(payment, null, true);
    }

    const remote = await adapter.createPayment({
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: money(payment.amount),
      currency: payment.currency,
      idempotencyKey: 'provider-create:' + payment.idempotencyKey,
      method: request.method || 'sbp',
      returnUrl: request.returnUrl,
      description: request.description || payment.description,
      receipt: request.receipt || null,
    });

    this.assertPaymentMatch(payment, remote);
    await this.repository.update(payment.organizationId, payment.id, {
      providerPaymentId: remote.providerPaymentId,
      providerStatus: remote.rawStatus || remote.status,
      confirmationUrl: remote.confirmationUrl || null,
      paymentMethodType: remote.paymentMethodType || request.method || null,
      incomeAmount: remote.incomeAmount == null ? null : money(remote.incomeAmount),
      channel: normalizeChannel(request.channel),
      failureCode: remote.failureCode || null,
    });

    payment = await this.repository.getById(payment.organizationId, payment.id);
    payment = await this.applyRemotePaymentState(payment, remote, context, 'provider-init');
    return this.present(payment, remote, local.duplicate);
  }

  async refreshPayment({ organizationId, paymentId }, context = {}) {
    required({ organizationId, paymentId }, ['organizationId', 'paymentId']);
    let payment = await this.repository.getById(organizationId, paymentId);
    if (!payment) throw error('PAYMENT_NOT_FOUND', 'Платёж не найден.', 404);
    if (!payment.providerPaymentId) throw error('PAYMENT_PROVIDER_REFERENCE_MISSING', 'Платёж ещё не создан у ЮKassa.', 409);

    const adapter = this.providers[payment.provider];
    if (!adapter) throw error('PAYMENT_PROVIDER_UNSUPPORTED', 'Платёжный провайдер не поддерживается.', 400);

    const remote = await adapter.getPaymentStatus(payment.providerPaymentId);
    this.assertPaymentMatch(payment, remote);

    await this.repository.update(payment.organizationId, payment.id, {
      providerStatus: remote.rawStatus || remote.status,
      confirmationUrl: remote.confirmationUrl || payment.confirmationUrl,
      paymentMethodType: remote.paymentMethodType || payment.paymentMethodType,
      incomeAmount: remote.incomeAmount == null ? payment.incomeAmount : money(remote.incomeAmount),
      failureCode: remote.failureCode || null,
    });

    payment = await this.repository.getById(payment.organizationId, payment.id);
    payment = await this.applyRemotePaymentState(payment, remote, context, 'provider-status');
    return this.present(payment, remote, false);
  }

  async submitRefund(request, context = {}) {
    required(request, ['organizationId', 'paymentId', 'idempotencyKey', 'reason']);

    const payment = await this.repository.getById(request.organizationId, request.paymentId);
    if (!payment || !payment.providerPaymentId) throw error('REFUND_PROVIDER_PAYMENT_REFERENCE_MISSING', 'У платежа отсутствует идентификатор ЮKassa.', 409);
    const requestedAmount = request.amount == null ? Number(payment.amount) : Number(request.amount);
    const isPartialRefund = requestedAmount < Number(payment.amount);
    if (isPartialRefund && !request.receipt) {
      throw error('REFUND_RECEIPT_REQUIRED', 'Для частичного возврата требуется состав фискального чека возврата.', 409);
    }

    const created = await this.paymentService.requestRefund(request, context);
    let refund = created.refund;
    if (refund.providerRefundId) {
      return this.refreshRefund({ organizationId: request.organizationId, refundId: refund.id }, context);
    }

    const adapter = this.providers[payment.provider];
    if (!adapter) throw error('PAYMENT_PROVIDER_UNSUPPORTED', 'Платёжный провайдер не поддерживается.', 400);

    const remote = await adapter.refundPayment({
      refundId: refund.id,
      providerPaymentId: payment.providerPaymentId,
      orderId: payment.orderId,
      amount: money(refund.amount),
      currency: refund.currency,
      idempotencyKey: 'provider-refund:' + refund.idempotencyKey,
      reason: refund.reason,
      receipt: request.receipt || null,
    });

    if (remote.providerPaymentId && remote.providerPaymentId !== payment.providerPaymentId) {
      throw error('REFUND_PROVIDER_PAYMENT_MISMATCH', 'Возврат относится к другому платежу.', 409);
    }
    if (!sameMoney(remote.amount, refund.amount) || remote.currency !== refund.currency) {
      throw error('REFUND_PROVIDER_AMOUNT_MISMATCH', 'Сумма возврата ЮKassa не совпадает с локальной.', 409);
    }

    await this.repository.updateRefund(refund.organizationId, refund.id, {
      providerRefundId: remote.providerRefundId,
      status: 'PENDING',
      pendingAt: this.clock(),
      failureCode: remote.failureCode || null,
    });

    return this.refreshRefund({ organizationId: refund.organizationId, refundId: refund.id }, context);
  }

  async refreshRefund({ organizationId, refundId }, context = {}) {
    required({ organizationId, refundId }, ['organizationId', 'refundId']);
    const refund = await this.repository.getRefund(organizationId, refundId);
    if (!refund) throw error('REFUND_NOT_FOUND', 'Возврат не найден.', 404);
    if (!refund.providerRefundId) throw error('REFUND_PROVIDER_REFERENCE_MISSING', 'Возврат ещё не создан у ЮKassa.', 409);

    const adapter = this.providers[refund.payment.provider];
    if (!adapter) throw error('PAYMENT_PROVIDER_UNSUPPORTED', 'Платёжный провайдер не поддерживается.', 400);

    const remote = await adapter.getRefund(refund.providerRefundId);
    if (remote.providerPaymentId !== refund.payment.providerPaymentId) {
      throw error('REFUND_PROVIDER_PAYMENT_MISMATCH', 'Возврат относится к другому платежу.', 409);
    }
    if (!sameMoney(remote.amount, refund.amount) || remote.currency !== refund.currency) {
      throw error('REFUND_PROVIDER_AMOUNT_MISMATCH', 'Сумма возврата ЮKassa не совпадает с локальной.', 409);
    }

    if (remote.status === 'PENDING') {
      await this.repository.updateRefund(refund.organizationId, refund.id, {
        status: 'PENDING',
        pendingAt: refund.pendingAt || this.clock(),
        failureCode: null,
      });
      return {
        refund: await this.repository.getRefund(refund.organizationId, refund.id),
        provider: remote,
        verified: true,
      };
    }

    const providerEventId = crypto.createHash('sha256').update(JSON.stringify({
      type: 'refund.status.verified',
      provider: refund.payment.provider,
      providerRefundId: remote.providerRefundId,
      status: remote.status,
      amount: remote.amount,
      currency: remote.currency,
    })).digest('hex');

    let inbox = await this.repository.findInbox(refund.payment.provider, providerEventId);
    if (!inbox) {
      inbox = await this.repository.createInbox({
        organizationId: refund.organizationId,
        paymentId: refund.paymentId,
        provider: refund.payment.provider,
        providerEventId,
        eventType: 'refund.' + String(remote.status).toLowerCase() + '.verified',
        payload: {
          providerPaymentId: refund.payment.providerPaymentId,
          providerStatus: 'REFUND',
          refundId: refund.id,
          refundStatus: remote.status,
          providerRefundId: remote.providerRefundId,
          amount: remote.amount,
          currency: remote.currency,
          failureCode: remote.failureCode || null,
        },
        status: 'RECEIVED',
      });
    }

    if (inbox.status === 'PROCESSED') {
      return {
        refund: await this.repository.getRefund(refund.organizationId, refund.id),
        provider: remote,
        verified: true,
        duplicate: true,
      };
    }

    const processed = await this.paymentService.processInbox(inbox, context);
    return { ...processed, provider: remote, verified: true };
  }

  async applyRemotePaymentState(payment, remote, context, source) {
    const baseKey = source + ':' + payment.providerPaymentId + ':' + remote.status;

    if (remote.status === 'PENDING') {
      if (payment.status === 'CREATED') {
        return (await this.paymentService.markPending(payment.organizationId, payment.id, {
          idempotencyKey: baseKey,
          providerPaymentId: payment.providerPaymentId,
          providerStatus: remote.rawStatus || remote.status,
        }, context)).payment;
      }
      return payment;
    }

    if (remote.status === 'AUTHORIZED') {
      if (payment.status === 'CREATED') {
        payment = (await this.paymentService.markPending(payment.organizationId, payment.id, {
          idempotencyKey: baseKey + ':pending',
          providerPaymentId: payment.providerPaymentId,
          providerStatus: remote.rawStatus || remote.status,
        }, context)).payment;
      }
      if (payment.status === 'PENDING') {
        return (await this.paymentService.transition({
          organizationId: payment.organizationId,
          paymentId: payment.id,
          idempotencyKey: baseKey,
          providerPaymentId: payment.providerPaymentId,
          providerStatus: remote.rawStatus || remote.status,
          to: 'AUTHORIZED',
          eventType: 'PaymentAuthorized',
        }, context)).payment;
      }
      return payment;
    }

    if (remote.status === 'SUCCEEDED') {
      if (remote.paid !== true) throw error('PAYMENT_PROVIDER_PAID_FLAG_MISMATCH', 'ЮKassa не подтвердила paid=true.', 409);
      if (['SUCCEEDED', 'REFUND_PENDING', 'REFUNDED'].includes(payment.status)) return payment;
      if (payment.status === 'CREATED') {
        payment = (await this.paymentService.markPending(payment.organizationId, payment.id, {
          idempotencyKey: baseKey + ':pending',
          providerPaymentId: payment.providerPaymentId,
          providerStatus: remote.rawStatus || remote.status,
        }, context)).payment;
      }
      return (await this.paymentService.confirmPayment({
        organizationId: payment.organizationId,
        paymentId: payment.id,
        idempotencyKey: baseKey,
        providerPaymentId: payment.providerPaymentId,
        providerStatus: remote.rawStatus || remote.status,
        amount: remote.amount,
        currency: remote.currency,
      }, context)).payment;
    }

    if (remote.status === 'CANCELED') {
      if (['CANCELED', 'FAILED'].includes(payment.status)) return payment;
      if (['CREATED', 'PENDING', 'AUTHORIZED'].includes(payment.status)) {
        return (await this.paymentService.cancelPayment({
          organizationId: payment.organizationId,
          paymentId: payment.id,
          idempotencyKey: baseKey,
          providerPaymentId: payment.providerPaymentId,
          providerStatus: remote.rawStatus || remote.status,
          failureCode: remote.failureCode || null,
        }, context)).payment;
      }
    }

    return payment;
  }

  assertPaymentMatch(payment, remote) {
    if (!remote || !remote.providerPaymentId) throw error('PAYMENT_PROVIDER_REFERENCE_MISSING', 'ЮKassa не вернула идентификатор платежа.', 502);
    if (!sameMoney(remote.amount, payment.amount) || remote.currency !== payment.currency) {
      throw error('PAYMENT_PROVIDER_AMOUNT_MISMATCH', 'Сумма или валюта ЮKassa не совпадает с заказом.', 409);
    }
    if (remote.metadata?.payment_id && remote.metadata.payment_id !== payment.id) {
      throw error('PAYMENT_PROVIDER_METADATA_MISMATCH', 'ЮKassa payment_id не совпадает с локальным Payment.', 409);
    }
    if (remote.metadata?.order_id && remote.metadata.order_id !== payment.orderId) {
      throw error('PAYMENT_PROVIDER_ORDER_MISMATCH', 'ЮKassa order_id не совпадает с локальным Order.', 409);
    }
  }

  present(payment, remote, duplicate) {
    return {
      payment,
      provider: remote,
      duplicate: Boolean(duplicate),
      confirmationUrl: payment.confirmationUrl || remote?.confirmationUrl || null,
      status: payment.status,
      userState: userState(payment.status),
    };
  }
}

function required(value, keys) {
  for (const key of keys) {
    if (value[key] === undefined || value[key] === null || value[key] === '') {
      throw error('PAYMENT_VALIDATION_FAILED', key + ' обязателен.', 400);
    }
  }
}

function normalizeChannel(value) {
  const channel = String(value || '').toUpperCase();
  return ['TERMINAL', 'WEB', 'MINIAPP'].includes(channel) ? channel : null;
}

function userState(status) {
  if (status === 'SUCCEEDED') return 'SUCCESS';
  if (['FAILED', 'CANCELED'].includes(status)) return 'ERROR';
  if (status === 'REFUNDED') return 'REFUNDED';
  return 'PENDING';
}

module.exports = { PaymentCheckoutService, userState };
