const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  CbrCurrencyProvider,
  CurrencyError,
} = require('../src/modules/currency');

function xml({ date = '15.09.2026', code = 'CNY', nominal = '1', value = '11,7500' } = {}) {
  return `<?xml version="1.0" encoding="windows-1251"?>
<ValCurs Date="${date}" name="Foreign Currency Market">
  <Valute ID="R01375">
    <NumCode>156</NumCode>
    <CharCode>${code}</CharCode>
    <Nominal>${nominal}</Nominal>
    <Name>Test currency</Name>
    <Value>${value}</Value>
  </Valute>
</ValCurs>`;
}

function response(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return body; },
  };
}

test('CBR provider requests official XML endpoint for requested historical date', async () => {
  let calledUrl;
  const provider = new CbrCurrencyProvider({
    fetchImpl: async (url) => {
      calledUrl = String(url);
      return response(xml());
    },
  });

  const rate = await provider.getRate({ currencyCode: 'CNY', requestedDate: '2026-09-15' });

  assert.match(calledUrl, /www\.cbr\.ru\/scripts\/XML_daily\.asp/);
  assert.match(calledUrl, /date_req=15%2F09%2F2026/);
  assert.equal(rate.rateDate, '2026-09-15');
  assert.equal(rate.nominal, '1');
  assert.equal(rate.rate, '11.7500');
  assert.equal(rate.unitRate, '11.75000000');
  assert.match(rate.rawResponseHash, /^[a-f0-9]{64}$/);
});

test('CBR provider preserves actual quotation date returned for weekend request', async () => {
  const provider = new CbrCurrencyProvider({
    fetchImpl: async () => response(xml({ date: '11.09.2026', code: 'USD', value: '84,2500' })),
  });

  const rate = await provider.getRate({ currencyCode: 'USD', requestedDate: '2026-09-13' });
  assert.equal(rate.rateDate, '2026-09-11');
  assert.equal(rate.unitRate, '84.25000000');
});

test('CBR provider calculates per-unit rate from nominal without floating point arithmetic', async () => {
  const provider = new CbrCurrencyProvider({
    fetchImpl: async () => response(xml({ code: 'CNY', nominal: '10', value: '117,5000' })),
  });

  const rate = await provider.getRate({ currencyCode: 'CNY', requestedDate: '2026-09-15' });
  assert.equal(rate.unitRate, '11.75000000');
});

test('CBR provider fails closed when currency is absent from official response', async () => {
  const provider = new CbrCurrencyProvider({ fetchImpl: async () => response(xml({ code: 'USD' })) });

  await assert.rejects(
    () => provider.getRate({ currencyCode: 'EUR', requestedDate: '2026-09-15' }),
    (error) => error instanceof CurrencyError && error.code === 'RATE_NOT_FOUND',
  );
});

test('CBR provider maps HTTP failure to SOURCE_UNAVAILABLE', async () => {
  const provider = new CbrCurrencyProvider({ fetchImpl: async () => response('', { status: 503 }) });

  await assert.rejects(
    () => provider.getRate({ currencyCode: 'EUR', requestedDate: '2026-09-15' }),
    (error) => error instanceof CurrencyError && error.code === 'SOURCE_UNAVAILABLE',
  );
});

test('CBR provider rejects malformed XML instead of guessing a rate', async () => {
  const provider = new CbrCurrencyProvider({ fetchImpl: async () => response('<html>broken</html>') });

  await assert.rejects(
    () => provider.getRate({ currencyCode: 'USD', requestedDate: '2026-09-15' }),
    (error) => error instanceof CurrencyError && error.code === 'INVALID_PROVIDER_RESPONSE',
  );
});
