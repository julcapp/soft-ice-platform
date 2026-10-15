const { randomUUID } = require('crypto');
const { ApiError } = require('../../platform/errors/ApiError');

class YooKassaPrivateChannelPaymentAdapter {
  constructor({ shopId = process.env.YOOKASSA_SHOP_ID, secretKey = process.env.YOOKASSA_SECRET_KEY, baseUrl = 'https://api.yookassa.ru/v3', returnUrl = process.env.PRIVATE_CHANNEL_PAYMENT_RETURN_URL || `${String(process.env.PUBLIC_APP_BASE_URL || 'https://app.utimoshi.ru').replace(/\/$/, '')}/?mode=private-channel`, receiptVatCode = process.env.YOOKASSA_RECEIPT_VAT_CODE } = {}) {
    this.shopId = shopId;
    this.secretKey = secretKey;
    this.baseUrl = String(baseUrl).replace(/\/$/, '');
    this.returnUrl = returnUrl;
    this.receiptVatCode = receiptVatCode ? Number(receiptVatCode) : null;
  }

  isConfigured() { return Boolean(this.shopId && this.secretKey); }
  isReceiptConfigured() { return Number.isInteger(this.receiptVatCode) && this.receiptVatCode > 0; }

  async createInitialPayment({ subscription, plan, recurringRequested = false, receiptCustomer = null, idempotencyKey = randomUUID() }) {
    this.#assertConfigured();
    const payload = {
      amount: { value: Number(plan.priceRub).toFixed(2), currency: 'RUB' },
      capture: true,
      confirmation: { type: 'redirect', return_url: this.returnUrl },
      save_payment_method: Boolean(recurringRequested),
      description: `Подписка «${plan.name}»`,
      metadata: { private_channel_subscription_id: subscription.id, customer_id: subscription.customerId, plan_code: plan.code },
    };
    if (receiptCustomer && this.isReceiptConfigured()) {
      payload.receipt = {
        customer: receiptCustomer,
        items: [{ description: String(plan.name).slice(0, 128), quantity: '1.00', amount: { value: Number(plan.priceRub).toFixed(2), currency: 'RUB' }, vat_code: this.receiptVatCode, payment_mode: 'full_payment', payment_subject: 'service' }],
      };
    }
    const payment = await this.#request('/payments', { method: 'POST', idempotencyKey, body: payload });
    return { providerPaymentId: payment.id, status: payment.status, confirmationUrl: payment.confirmation?.confirmation_url || null, idempotencyKey, raw: payment };
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

  async getPayment(paymentId) { this.#assertConfigured(); return this.#request(`/payments/${encodeURIComponent(paymentId)}`, { method: 'GET' }); }
  async getRefund(refundId) { this.#assertConfigured(); return this.#request(`/refunds/${encodeURIComponent(refundId)}`, { method: 'GET' }); }

  async createRefund({ providerPaymentId, amountRub, description, receipt = null, idempotencyKey = randomUUID() }) {
    this.#assertConfigured();
    const body = { payment_id: providerPaymentId, amount: { value: Number(amountRub).toFixed(2), currency: 'RUB' }, description };
    if (receipt) body.receipt = receipt;
    return this.#request('/refunds', { method: 'POST', idempotencyKey, body });
  }

  async createReceipt({ paymentId = null, refundId = null, type = 'payment', customer, items, settlements, idempotencyKey = randomUUID() }) {
    this.#assertConfigured();
    const body = { type, send: true, customer, items, settlements };
    if (paymentId) body.payment_id = paymentId;
    if (refundId) body.refund_id = refundId;
    return this.#request('/receipts', { method: 'POST', idempotencyKey, body });
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

  #assertConfigured() { if (!this.isConfigured()) throw new ApiError({ statusCode: 503, code: 'YOOKASSA_NOT_CONFIGURED', message: 'ЮKassa credentials are not configured.', source: 'payment_provider' }); }
}

function validation(code, message) { return new ApiError({ statusCode: 400, code, message, source: 'runtime' }); }
module.exports = { YooKassaPrivateChannelPaymentAdapter };
