'use strict';

const crypto = require('node:crypto');
const { PaymentProviderAdapter } = require('./PaymentProviderAdapter');

class YooKassaPaymentProviderAdapter extends PaymentProviderAdapter {
  constructor({
    shopId,
    secretKey,
    apiBaseUrl = 'https://api.yookassa.ru/v3',
    fetchImpl = globalThis.fetch,
    timeoutMs = 15000,
    allowedReturnOrigins = ['https://display.utimoshi.ru', 'https://miniapp.utimoshi.ru'],
  } = {}) {
    super({ provider: 'YOOKASSA' });
    this.shopId = shopId;
    this.secretKey = secretKey;
    this.apiBaseUrl = String(apiBaseUrl || '').replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.allowedReturnOrigins = new Set(allowedReturnOrigins);
    this.implementationKind = 'PRODUCTION';
    this.integrationStatus = this.isConfigured() ? 'READY' : 'BLOCKED_EXTERNAL';
  }

  isConfigured() {
    return Boolean(this.shopId && this.secretKey && this.fetchImpl);
  }

  async createPayment(request = {}) {
    this.assertConfigured();
    const { paymentId, orderId, amount, currency = 'RUB', idempotencyKey, method = 'sbp', returnUrl, description = null, receipt = null } = request;
    required({ paymentId, orderId, amount, idempotencyKey, returnUrl }, ['paymentId', 'orderId', 'amount', 'idempotencyKey', 'returnUrl']);
    this.assertReturnUrl(returnUrl);
    const normalizedMethod = String(method || 'sbp').toLowerCase();
    if (!['sbp', 'bank_card'].includes(normalizedMethod)) throw fail('YOOKASSA_PAYMENT_METHOD_UNSUPPORTED', 'Способ оплаты ЮKassa не поддерживается.', 400);

    const payload = {
      amount: { value: Number(amount).toFixed(2), currency },
      capture: true,
      confirmation: { type: 'redirect', return_url: returnUrl },
      description: description || `Оплата заказа ${orderId}`,
      metadata: { payment_id: paymentId, order_id: orderId },
      payment_method_data: { type: normalizedMethod },
      ...(receipt ? { receipt } : {}),
    };

    const object = await this.request('/payments', {
      method: 'POST',
      headers: { 'Idempotence-Key': idempotencyKey },
      body: payload,
    });
    return normalizePayment(object);
  }

  async getPaymentStatus(providerPaymentId) {
    this.assertConfigured();
    if (!providerPaymentId) throw fail('YOOKASSA_PAYMENT_ID_REQUIRED', 'Идентификатор платежа ЮKassa обязателен.', 400);
    return normalizePayment(await this.request(`/payments/${encodeURIComponent(providerPaymentId)}`, { method: 'GET' }));
  }

  async refundPayment(request = {}) {
    this.assertConfigured();
    required(request, ['refundId', 'providerPaymentId', 'amount', 'currency', 'idempotencyKey']);
    const object = await this.request('/refunds', {
      method: 'POST',
      headers: { 'Idempotence-Key': request.idempotencyKey },
      body: {
        payment_id: request.providerPaymentId,
        amount: { value: Number(request.amount).toFixed(2), currency: request.currency },
        description: request.reason || undefined,
        metadata: {
          refund_id: request.refundId,
          ...(request.orderId ? { order_id: request.orderId } : {}),
        },
      },
    });
    return {
      providerRefundId: object.id,
      providerPaymentId: object.payment_id,
      status: mapRefundStatus(object.status),
      amount: object.amount?.value || null,
      currency: object.amount?.currency || request.currency,
      rawStatus: object.status || null,
    };
  }

  async cancelPayment(providerPaymentId, { idempotencyKey } = {}) {
    this.assertConfigured();
    if (!providerPaymentId || !idempotencyKey) throw fail('YOOKASSA_CANCEL_INPUT_REQUIRED', 'Для отмены нужны payment id и idempotency key.', 400);
    const object = await this.request(`/payments/${encodeURIComponent(providerPaymentId)}/cancel`, {
      method: 'POST',
      headers: { 'Idempotence-Key': idempotencyKey },
      body: {},
    });
    return normalizePayment(object);
  }

  async verifyWebhookSignature({ rawBody }) {
    // При Basic Auth ЮKassa рекомендует проверять подлинность уведомления
    // повторным запросом статуса объекта и/или по IP. Здесь payload сам по себе
    // не считается доверенным; authoritative GET выполняется в parseWebhook().
    if (!rawBody) throw fail('YOOKASSA_WEBHOOK_BODY_REQUIRED', 'Webhook body обязателен.', 400);
    return true;
  }

  async parseWebhook({ body }) {
    if (!body || body.type !== 'notification' || !body.event || !body.object?.id) {
      throw fail('YOOKASSA_WEBHOOK_INVALID', 'Некорректное уведомление ЮKassa.', 400);
    }

    const eventType = String(body.event);
    if (eventType.startsWith('payment.')) {
      const verified = await this.getPaymentStatus(body.object.id);
      return {
        providerEventId: eventIdentity(eventType, verified.providerPaymentId, verified.rawStatus, verified.updatedAt),
        eventType,
        providerPaymentId: verified.providerPaymentId,
        providerStatus: verified.status,
        amount: verified.amount,
        currency: verified.currency,
      };
    }

    if (eventType.startsWith('refund.')) {
      const refund = await this.getRefund(body.object.id);
      return {
        providerEventId: eventIdentity(eventType, refund.providerRefundId, refund.rawStatus, refund.updatedAt),
        eventType,
        providerPaymentId: refund.providerPaymentId,
        providerStatus: 'REFUND',
        refundId: body.object?.metadata?.refund_id || null,
        refundStatus: refund.status,
        providerRefundId: refund.providerRefundId,
        amount: refund.amount,
        currency: refund.currency,
      };
    }

    throw fail('YOOKASSA_WEBHOOK_EVENT_UNSUPPORTED', `Событие ${eventType} не поддерживается.`, 409);
  }

  async getRefund(providerRefundId) {
    const object = await this.request(`/refunds/${encodeURIComponent(providerRefundId)}`, { method: 'GET' });
    return {
      providerRefundId: object.id,
      providerPaymentId: object.payment_id,
      status: mapRefundStatus(object.status),
      amount: object.amount?.value || null,
      currency: object.amount?.currency || 'RUB',
      rawStatus: object.status || null,
      updatedAt: object.created_at || null,
      metadata: sanitize(object.metadata || {}),
      failureCode: object.cancellation_details?.reason || null,
    };
  }

  assertReturnUrl(returnUrl) {
    let parsed;
    try { parsed = new URL(returnUrl); } catch { throw fail('YOOKASSA_RETURN_URL_INVALID', 'Некорректный return URL.', 400); }
    if (parsed.protocol !== 'https:' || !this.allowedReturnOrigins.has(parsed.origin)) {
      throw fail('YOOKASSA_RETURN_URL_FORBIDDEN', 'Домен return URL не разрешён.', 400);
    }
  }

  async request(path, { method = 'GET', headers = {}, body } = {}) {
    this.assertConfigured();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.apiBaseUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64')}`,
          'Content-Type': 'application/json',
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const text = await response.text();
      let payload = null;
      if (text) {
        try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
      }
      if (!response.ok) throw fail('YOOKASSA_API_ERROR', `ЮKassa вернула HTTP ${response.status}.`, 502, { status: response.status, response: sanitize(payload) });
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError') throw fail('YOOKASSA_TIMEOUT', 'Истекло время ожидания ЮKassa.', 504);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  assertConfigured() {
    if (!this.isConfigured()) throw fail('YOOKASSA_NOT_CONFIGURED', 'Реквизиты ЮKassa не настроены.', 503);
  }
}

function normalizePayment(object = {}) {
  return {
    providerPaymentId: object.id,
    status: mapPaymentStatus(object.status),
    rawStatus: object.status || null,
    paid: object.paid === true,
    amount: object.amount?.value || null,
    currency: object.amount?.currency || 'RUB',
    confirmationUrl: object.confirmation?.confirmation_url || null,
    paymentMethodType: object.payment_method?.type || null,
    incomeAmount: object.income_amount?.value || null,
    capturedAt: object.captured_at || null,
    createdAt: object.created_at || null,
    updatedAt: object.captured_at || object.created_at || null,
    metadata: sanitize(object.metadata || {}),
    failureCode: object.cancellation_details?.reason || null,
  };
}

function mapPaymentStatus(status) {
  if (status === 'succeeded') return 'SUCCEEDED';
  if (status === 'canceled') return 'CANCELED';
  if (status === 'waiting_for_capture') return 'AUTHORIZED';
  return 'PENDING';
}
function mapRefundStatus(status) {
  if (status === 'succeeded') return 'SUCCEEDED';
  if (status === 'canceled') return 'FAILED';
  return 'PENDING';
}
function eventIdentity(eventType, objectId, status, timestamp) {
  return crypto.createHash('sha256').update([eventType, objectId, status, timestamp || ''].join(':')).digest('hex');
}
function required(value, keys) {
  for (const key of keys) if (value[key] === undefined || value[key] === null || value[key] === '') throw fail('YOOKASSA_VALIDATION_FAILED', `${key} обязателен.`, 400);
}
function sanitize(value) {
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (/(authorization|cookie|secret|token|card|cvv|cvc|pan|api.?key)/i.test(key)) continue;
    out[key] = child && typeof child === 'object' ? sanitize(child) : child;
  }
  return out;
}
function fail(code, message, statusCode = 400, details = null) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.source = 'yookassa';
  if (details) error.details = [details];
  return error;
}

module.exports = { YooKassaPaymentProviderAdapter, normalizePayment };
