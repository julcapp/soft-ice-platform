'use strict';

class YooKassaPaymentAdapter {
  constructor({
    shopId = process.env.YOOKASSA_SHOP_ID,
    secretKey = process.env.YOOKASSA_SECRET_KEY,
    apiBaseUrl = 'https://api.yookassa.ru/v3',
    fetchImpl = globalThis.fetch,
    allowedReturnOrigins = (process.env.PAYMENT_RETURN_ORIGINS || 'https://app.utimoshi.ru')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  } = {}) {
    this.shopId = shopId;
    this.secretKey = secretKey;
    this.apiBaseUrl = apiBaseUrl.replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
    this.allowedReturnOrigins = new Set(allowedReturnOrigins);
  }

  isConfigured() {
    return Boolean(this.shopId && this.secretKey && this.fetchImpl);
  }

  async createPayment({ orderId, amount, currency = 'RUB', method = 'sbp', returnUrl, idempotencyKey, description = null }) {
    this._assertConfigured();
    if (!orderId) throw this._error('YOOKASSA_ORDER_REQUIRED', 'orderId is required.', 400);
    if (!idempotencyKey) throw this._error('YOOKASSA_IDEMPOTENCY_REQUIRED', 'Idempotency key is required.', 400);
    this._assertReturnUrl(returnUrl);
    const normalizedMethod = String(method || 'sbp').toLowerCase();
    if (!['sbp', 'bank_card'].includes(normalizedMethod)) throw this._error('YOOKASSA_PAYMENT_METHOD_UNSUPPORTED', `Unsupported YooKassa payment method: ${normalizedMethod}.`, 400);

    const payload = {
      amount: { value: Number(amount).toFixed(2), currency },
      capture: true,
      confirmation: { type: 'redirect', return_url: returnUrl },
      description: description || `Заказ ${orderId}`,
      metadata: { order_id: orderId },
      payment_method_data: { type: normalizedMethod },
    };

    return this._request('/payments', {
      method: 'POST',
      headers: { 'Idempotence-Key': idempotencyKey },
      body: payload,
    });
  }

  async getPayment(providerPaymentId) {
    this._assertConfigured();
    if (!providerPaymentId) throw this._error('YOOKASSA_PAYMENT_ID_REQUIRED', 'Provider payment id is required.', 400);
    return this._request(`/payments/${encodeURIComponent(providerPaymentId)}`, { method: 'GET' });
  }

  _assertReturnUrl(returnUrl) {
    if (!returnUrl) throw this._error('YOOKASSA_RETURN_URL_REQUIRED', 'returnUrl is required.', 400);
    let parsed;
    try { parsed = new URL(returnUrl); } catch { throw this._error('YOOKASSA_RETURN_URL_INVALID', 'returnUrl must be a valid absolute URL.', 400); }
    if (parsed.protocol !== 'https:' || !this.allowedReturnOrigins.has(parsed.origin)) {
      throw this._error('YOOKASSA_RETURN_URL_FORBIDDEN', 'returnUrl origin is not allowed.', 400, [{ origin: parsed.origin }]);
    }
  }

  async _request(path, { method, headers = {}, body } = {}) {
    const response = await this.fetchImpl(`${this.apiBaseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
    }
    if (!response.ok) {
      throw this._error('YOOKASSA_API_ERROR', `YooKassa API returned HTTP ${response.status}.`, 502, [{ status: response.status, response: data }]);
    }
    return data;
  }

  _assertConfigured() {
    if (!this.isConfigured()) throw this._error('YOOKASSA_NOT_CONFIGURED', 'YooKassa credentials or HTTP client are not configured.', 503);
  }

  _error(code, message, statusCode, details = []) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    error.details = details;
    error.source = 'yookassa';
    return error;
  }
}

module.exports = { YooKassaPaymentAdapter };
