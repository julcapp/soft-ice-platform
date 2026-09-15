const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createApp } = require('../src/main');
const { CurrencyError } = require('../src/modules/currency');

async function withServer(currencyRateService, run) {
  const app = createApp({ dependencies: { currencyRateService } });
  const server = app.listen(0);
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('currency rate endpoint requires administrator authentication', async () => {
  await withServer({ async getRate() { throw new Error('must not be called'); } }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/currency-rates?currency=CNY&date=2026-09-15`);
    assert.equal(response.status, 401);
  });
});

test('currency rate endpoint returns service result without recalculating it in the route', async () => {
  const service = {
    async getRate(input) {
      assert.deepEqual(input, { currencyCode: 'CNY', requestedDate: '2026-09-15' });
      return {
        currencyCode: 'CNY',
        requestedDate: '2026-09-15',
        rateDate: '2026-09-15',
        nominal: '1',
        rate: '11.75000000',
        unitRate: '11.75000000',
        source: 'CBR',
        status: 'VALID',
        receivedAt: '2026-09-15T08:00:00.000Z',
        cached: true,
      };
    },
  };

  await withServer(service, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/currency-rates?currency=CNY&date=2026-09-15`, {
      headers: { 'X-Admin-Role': 'ADMIN' },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.type, 'currency_rate');
    assert.equal(body.data.attributes.unitRate, '11.75000000');
    assert.equal(body.data.attributes.cached, true);
  });
});

test('currency domain validation errors are exposed as safe API errors', async () => {
  const service = {
    async getRate() {
      throw new CurrencyError('UNSUPPORTED_CURRENCY', 'Unsupported currency: GBP');
    },
  };

  await withServer(service, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/currency-rates?currency=GBP&date=2026-09-15`, {
      headers: { 'X-Admin-Role': 'ADMIN' },
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error.code, 'UNSUPPORTED_CURRENCY');
  });
});

test('CBR outage is reported as retryable service-unavailable error', async () => {
  const service = {
    async getRate() {
      throw new CurrencyError('SOURCE_UNAVAILABLE', 'CBR currency provider request failed.');
    },
  };

  await withServer(service, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/currency-rates?currency=EUR&date=2026-09-15`, {
      headers: { 'X-Admin-Role': 'ADMIN' },
    });
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.error.code, 'SOURCE_UNAVAILABLE');
    assert.equal(body.error.retryable, true);
  });
});
