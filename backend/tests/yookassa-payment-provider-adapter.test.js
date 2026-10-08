const test = require('node:test');
const assert = require('node:assert/strict');
const { YooKassaPaymentProviderAdapter } = require('../src/modules/payment/YooKassaPaymentProviderAdapter');

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return body === undefined ? '' : JSON.stringify(body); },
  };
}

test('creates SBP payment with Basic Auth and Idempotence-Key', async () => {
  const calls = [];
  const adapter = new YooKassaPaymentProviderAdapter({
    shopId: 'shop-test',
    secretKey: 'secret-test',
    allowedReturnOrigins: ['https://display.utimoshi.ru'],
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return response(200, {
        id: 'yk_1',
        status: 'pending',
        paid: false,
        amount: { value: '95.00', currency: 'RUB' },
        confirmation: { confirmation_url: 'https://yoomoney.ru/checkout/payments/v2/contract?orderId=1' },
        payment_method: { type: 'sbp' },
        created_at: '2026-10-06T10:00:00Z',
      });
    },
  });

  const created = await adapter.createPayment({
    paymentId: 'pay_1',
    orderId: 'order_1',
    amount: '95.00',
    currency: 'RUB',
    idempotencyKey: 'idem_1',
    method: 'sbp',
    returnUrl: 'https://display.utimoshi.ru/payment/return?orderId=order_1',
  });

  assert.equal(created.providerPaymentId, 'yk_1');
  assert.equal(created.status, 'PENDING');
  assert.equal(created.confirmationUrl.startsWith('https://yoomoney.ru/'), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.yookassa.ru/v3/payments');
  assert.equal(calls[0].options.headers['Idempotence-Key'], 'idem_1');
  assert.equal(calls[0].options.headers.Authorization, 'Basic ' + Buffer.from('shop-test:secret-test').toString('base64'));
  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual(body.amount, { value: '95.00', currency: 'RUB' });
  assert.equal(body.capture, true);
  assert.equal(body.payment_method_data.type, 'sbp');
  assert.equal(body.confirmation.type, 'redirect');
  assert.equal(body.metadata.payment_id, 'pay_1');
  assert.equal(body.metadata.order_id, 'order_1');
});

test('rejects return URL outside configured origins', async () => {
  const adapter = new YooKassaPaymentProviderAdapter({
    shopId: 'shop-test',
    secretKey: 'secret-test',
    allowedReturnOrigins: ['https://display.utimoshi.ru'],
    fetchImpl: async () => response(500, {}),
  });
  await assert.rejects(adapter.createPayment({
    paymentId: 'pay_1',
    orderId: 'order_1',
    amount: '95.00',
    idempotencyKey: 'idem_1',
    method: 'sbp',
    returnUrl: 'https://evil.example/return',
  }), { code: 'YOOKASSA_RETURN_URL_FORBIDDEN' });
});

test('webhook does not trust payload status and verifies payment by GET', async () => {
  const calls = [];
  const adapter = new YooKassaPaymentProviderAdapter({
    shopId: 'shop-test',
    secretKey: 'secret-test',
    fetchImpl: async (url) => {
      calls.push(String(url));
      return response(200, {
        id: 'yk_2',
        status: 'succeeded',
        paid: true,
        amount: { value: '120.00', currency: 'RUB' },
        captured_at: '2026-10-06T10:01:00Z',
      });
    },
  });
  const event = await adapter.parseWebhook({
    body: {
      type: 'notification',
      event: 'payment.succeeded',
      object: { id: 'yk_2', status: 'canceled' },
    },
  });
  assert.equal(calls[0], 'https://api.yookassa.ru/v3/payments/yk_2');
  assert.equal(event.providerPaymentId, 'yk_2');
  assert.equal(event.providerStatus, 'SUCCEEDED');
  assert.equal(event.amount, '120.00');
  assert.match(event.providerEventId, /^[a-f0-9]{64}$/);
});

test('maps YooKassa payment states into authoritative states', async () => {
  const statuses = [
    ['waiting_for_capture', 'AUTHORIZED'],
    ['succeeded', 'SUCCEEDED'],
    ['canceled', 'CANCELED'],
    ['pending', 'PENDING'],
  ];
  for (const [providerStatus, expected] of statuses) {
    const adapter = new YooKassaPaymentProviderAdapter({
      shopId: 'shop-test',
      secretKey: 'secret-test',
      fetchImpl: async () => response(200, {
        id: 'p',
        status: providerStatus,
        amount: { value: '10.00', currency: 'RUB' },
      }),
    });
    assert.equal((await adapter.getPaymentStatus('p')).status, expected);
  }
});


test('refund request includes local refund metadata for webhook correlation', async () => {
  const calls = [];
  const adapter = new YooKassaPaymentProviderAdapter({
    shopId: 'shop-test',
    secretKey: 'secret-test',
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return response(200, {
        id: 'yr_1',
        status: 'pending',
        payment_id: 'yk_1',
        amount: { value: '40.00', currency: 'RUB' },
        metadata: { refund_id: 'refund_1', order_id: 'order_1' },
      });
    },
  });

  const created = await adapter.refundPayment({
    refundId: 'refund_1',
    providerPaymentId: 'yk_1',
    orderId: 'order_1',
    amount: '40.00',
    currency: 'RUB',
    idempotencyKey: 'refund-idem-1',
    reason: 'Возврат части заказа',
  });

  assert.equal(created.providerRefundId, 'yr_1');
  assert.equal(created.status, 'PENDING');
  assert.equal(calls[0].url, 'https://api.yookassa.ru/v3/refunds');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.payment_id, 'yk_1');
  assert.deepEqual(body.metadata, { refund_id: 'refund_1', order_id: 'order_1' });
});
