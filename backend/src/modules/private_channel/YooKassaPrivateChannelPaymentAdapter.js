const { randomUUID } = require('crypto');
const { ApiError } = require('../../platform/errors/ApiError');

class YooKassaPrivateChannelPaymentAdapter {
  constructor({ shopId = process.env.YOOKASSA_SHOP_ID, secretKey = process.env.YOOKASSA_SECRET_KEY, baseUrl = 'https://api.yookassa.ru/v3', returnUrl = process.env.PRIVATE_CHANNEL_PAYMENT_RETURN_URL || `${String(process.env.PUBLIC_APP_BASE_URL || 'https://app.utimoshi.ru').replace(/\/$/, '')}/?mode=private-channel` } = {}) {
    this.shopId = shopId;
    this.secretKey = secretKey;
    this.baseUrl = String(baseUrl).replace(/\/$/, '');
    this.returnUrl = returnUrl;
  }

  isConfigured() { return Boolean(this.shopId && this.secretKey); }

  async createInitialPayment({ subscription, plan, recurringRequested = false, idempotencyKey = randomUUID() }) {
    this.#assertConfigured();
    const payload = {
      amount: { value: Number(plan.priceRub).toFixed(2), currency: 'RUB' },
      capture: true,
      confirmation: { type: 'redirect', return_url: this.returnUrl },
      save_payment_method: Boolean(recurringRequested),
      description: `Подписка «${plan.name}»`,
      metadata: { private_channel_subscription_id: subscription.id, customer_id: subscription.customerId, plan_code: plan.code },
    };
    const payment = await this.#request('/payments', { method: 'POST', idempotencyKey, body: payload });
    return {
      providerPaymentId: payment.id,
      status: payment.status,
      confirmationUrl: payment.confirmation?.confirmation_url || null,
      idempotencyKey,
      raw: payment,
    };
  }

  async createRecurringPayment({ subscription, plan, idempotencyKey = randomUUID() }) {
    this.#assertConfigured();
    if (!subscription.providerPaymentMethodRef) throw validation('PRIVATE_CHANNEL_PAYMENT_METHOD_NOT_SAVED', 'Сохранённый способ оплаты отсутствует.');
    const payment = await this.#request('/payments', {
      method: 'POST', idempotencyKey,
      body: {
        amount: { value: Number(plan.priceRub).toFixed(2), currency: 'RUB' },
        capture: true,
        payment_method_id: subscription.providerPaymentMethodRef,
        description: `Продление подписки «${plan.name}»`,
        metadata: { private_channel_subscription_id: subscription.id, customer_id: subscription.customerId, plan_code: plan.code, payment_kind: 'RENEWAL' },
      },
    });
    return { providerPaymentId: payment.id, status: payment.status, idempotencyKey, raw: payment };
  }

  async getPayment(paymentId) {
    this.#assertConfigured();
    return this.#request(`/payments/${encodeURIComponent(paymentId)}`, { method: 'GET' });
  }

  async #request(path, { method, idempotencyKey, body } = {}) {
    const headers = { Authorization: `Basic ${Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64')}`, Accept: 'application/json' };
    if (body) headers['Content-Type'] = 'application/json';
    if (idempotencyKey) headers['Idempotence-Key'] = idempotencyKey;
    const response = await fetch(`${this.baseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError({ statusCode: 502, code: 'YOOKASSA_REQUEST_FAILED', message: payload?.description || payload?.code || 'ЮKassa request failed.', source: 'payment_provider' });
    return payload;
  }

  #assertConfigured() {
    if (!this.isConfigured()) throw new ApiError({ statusCode: 503, code: 'YOOKASSA_NOT_CONFIGURED', message: 'ЮKassa credentials are not configured.', source: 'payment_provider' });
  }
}

function validation(code, message) { return new ApiError({ statusCode: 400, code, message, source: 'runtime' }); }
module.exports = { YooKassaPrivateChannelPaymentAdapter };
