const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  CurrencyRateService,
  InMemoryCurrencyRateRepository,
  CurrencyError,
} = require('../src/modules/currency');

const fixedNow = new Date('2026-09-15T08:00:00.000Z');

function createService({ provider, repository } = {}) {
  return new CurrencyRateService({
    repository: repository || new InMemoryCurrencyRateRepository(),
    cbrProvider: provider,
    clock: () => fixedNow,
  });
}

test('RUB uses internal base rate and never calls external provider', async () => {
  let calls = 0;
  const service = createService({ provider: { async getRate() { calls += 1; } } });
  const rate = await service.getRate({ currencyCode: 'rub', requestedDate: '2026-09-15' });

  assert.equal(rate.currencyCode, 'RUB');
  assert.equal(rate.unitRate, '1');
  assert.equal(rate.source, 'INTERNAL_BASE');
  assert.equal(rate.rateDate, '2026-09-15');
  assert.equal(calls, 0);
});

test('foreign rate is requested once and then served from exact-date cache', async () => {
  let calls = 0;
  const repository = new InMemoryCurrencyRateRepository();
  const provider = {
    async getRate({ currencyCode, requestedDate }) {
      calls += 1;
      assert.equal(currencyCode, 'CNY');
      assert.equal(requestedDate, '2026-09-15');
      return {
        rateDate: '2026-09-15',
        nominal: '1',
        rate: '11.75000000',
        unitRate: '11.75000000',
        rawResponseHash: 'sha256:test',
      };
    },
  };
  const service = createService({ provider, repository });

  const first = await service.getRate({ currencyCode: 'CNY', requestedDate: '2026-09-15' });
  const second = await service.getRate({ currencyCode: 'CNY', requestedDate: '2026-09-15' });

  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(second.unitRate, '11.75000000');
  assert.equal(calls, 1);
});

test('service preserves provider rate date separately from requested date', async () => {
  const service = createService({
    provider: {
      async getRate() {
        return {
          rateDate: '2026-09-11',
          nominal: '1',
          rate: '84.25000000',
          unitRate: '84.25000000',
        };
      },
    },
  });

  const rate = await service.getRate({ currencyCode: 'USD', requestedDate: '2026-09-13' });
  assert.equal(rate.requestedDate, '2026-09-13');
  assert.equal(rate.rateDate, '2026-09-11');
});

test('unsupported currency fails closed', async () => {
  const service = createService();
  await assert.rejects(
    () => service.getRate({ currencyCode: 'GBP', requestedDate: '2026-09-15' }),
    (error) => error instanceof CurrencyError && error.code === 'UNSUPPORTED_CURRENCY',
  );
});

test('invalid date fails before provider call', async () => {
  let calls = 0;
  const service = createService({ provider: { async getRate() { calls += 1; } } });

  await assert.rejects(
    () => service.getRate({ currencyCode: 'EUR', requestedDate: '2026-02-31' }),
    (error) => error instanceof CurrencyError && error.code === 'INVALID_RATE_DATE',
  );
  assert.equal(calls, 0);
});

test('foreign currency fails closed when provider is unavailable', async () => {
  const service = createService();
  await assert.rejects(
    () => service.getRate({ currencyCode: 'EUR', requestedDate: '2026-09-15' }),
    (error) => error instanceof CurrencyError && error.code === 'SOURCE_UNAVAILABLE',
  );
});

test('invalid provider payload is rejected instead of guessed', async () => {
  const service = createService({
    provider: {
      async getRate() {
        return {
          rateDate: '2026-09-15',
          nominal: '1',
          rate: '0',
          unitRate: 'not-a-number',
        };
      },
    },
  });

  await assert.rejects(
    () => service.getRate({ currencyCode: 'CNY', requestedDate: '2026-09-15' }),
    (error) => error instanceof CurrencyError && error.code === 'INVALID_PROVIDER_RESPONSE',
  );
});
