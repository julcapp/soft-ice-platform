const assert = require('node:assert/strict');
const { test } = require('node:test');
const { YooKassaPaymentAdapter } = require('../src/modules/payment/YooKassaPaymentAdapter');

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}

test('YooKassa adapter creates SBP redirect payment with capture and metadata', async () => {
  let request;
  const adapter = new YooKassaPaymentAdapter({
    shopId: 'shop', secretKey: 'secret', allowedReturnOrigins: ['https://app.utimoshi.ru'],
    fetchImpl: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return response({ id: 'yk-1', status: 'pending', confirmation: { confirmation_url: 'https://yookassa.example/pay' } });
    },
  });
  await adapter.createPayment({ orderId: 'order-1', amount: 72, method: 'sbp', returnUrl: 'https://app.utimoshi.ru/payment/return', idempotencyKey: 'idem-1' });
  assert.equal(request.body.payment_method_data.type, 'sbp');
  assert.equal(request.body.confirmation.type, 'redirect');
  assert.equal(request.body.capture, true);
  assert.equal(request.body.amount.value, '72.00');
  assert.equal(request.body.metadata.order_id, 'order-1');
  assert.equal(request.options.headers['Idempotence-Key'], 'idem-1');
});

test('YooKassa adapter rejects untrusted return URL', async () => {
  const adapter = new YooKassaPaymentAdapter({ shopId: 'shop', secretKey: 'secret', fetchImpl: async () => response({}), allowedReturnOrigins: ['https://app.utimoshi.ru'] });
  await assert.rejects(
    () => adapter.createPayment({ orderId: 'order-1', amount: 72, method: 'sbp', returnUrl: 'https://evil.example/return', idempotencyKey: 'idem-1' }),
    (error) => error.code === 'YOOKASSA_RETURN_URL_FORBIDDEN',
  );
});
