const { CurrencyError } = require('./currencyErrors');

const SUPPORTED_CURRENCIES = new Set(['RUB', 'CNY', 'USD', 'EUR']);
const DECIMAL_PATTERN = /^\d+(?:\.\d+)?$/;

function normalizeCurrencyCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!SUPPORTED_CURRENCIES.has(code)) {
    throw new CurrencyError('UNSUPPORTED_CURRENCY', `Unsupported currency: ${code || '<empty>'}`);
  }
  return code;
}

function normalizeRequestedDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new CurrencyError('INVALID_RATE_DATE', 'Rate date is invalid.');
    return value.toISOString().slice(0, 10);
  }

  const date = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new CurrencyError('INVALID_RATE_DATE', 'Rate date must use YYYY-MM-DD format.');
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new CurrencyError('INVALID_RATE_DATE', 'Rate date is invalid.');
  }
  return date;
}

function requirePositiveDecimal(value, field) {
  const text = String(value ?? '').trim();
  if (!DECIMAL_PATTERN.test(text) || Number(text) <= 0) {
    throw new CurrencyError('INVALID_PROVIDER_RESPONSE', `Provider field ${field} must be a positive decimal string.`);
  }
  return text;
}

class CurrencyRateService {
  constructor({ repository, cbrProvider, clock = () => new Date() }) {
    if (!repository) throw new TypeError('CurrencyRateService requires repository.');
    this.repository = repository;
    this.cbrProvider = cbrProvider;
    this.clock = clock;
  }

  async getRate({ currencyCode, requestedDate }) {
    const code = normalizeCurrencyCode(currencyCode);
    const date = normalizeRequestedDate(requestedDate);

    if (code === 'RUB') {
      return {
        currencyCode: 'RUB',
        requestedDate: date,
        rateDate: date,
        nominal: '1',
        rate: '1',
        unitRate: '1',
        source: 'INTERNAL_BASE',
        status: 'VALID',
        receivedAt: this.clock().toISOString(),
        cached: false,
      };
    }

    const source = 'CBR';
    const cached = await this.repository.findExact({ currencyCode: code, requestedDate: date, source });
    if (cached) return { ...cached, cached: true };

    if (!this.cbrProvider || typeof this.cbrProvider.getRate !== 'function') {
      throw new CurrencyError('SOURCE_UNAVAILABLE', 'CBR currency provider is not configured.');
    }

    let providerRate;
    try {
      providerRate = await this.cbrProvider.getRate({ currencyCode: code, requestedDate: date });
    } catch (error) {
      if (error instanceof CurrencyError) throw error;
      throw new CurrencyError('SOURCE_UNAVAILABLE', 'CBR currency provider request failed.', { cause: error.message });
    }

    if (!providerRate || typeof providerRate !== 'object') {
      throw new CurrencyError('INVALID_PROVIDER_RESPONSE', 'CBR provider returned no rate.');
    }

    const rateDate = normalizeRequestedDate(providerRate.rateDate);
    const nominal = requirePositiveDecimal(providerRate.nominal, 'nominal');
    const rate = requirePositiveDecimal(providerRate.rate, 'rate');
    const unitRate = requirePositiveDecimal(providerRate.unitRate, 'unitRate');

    const saved = await this.repository.save({
      currencyCode: code,
      requestedDate: date,
      rateDate,
      nominal,
      rate,
      unitRate,
      source,
      status: 'VALID',
      rawResponseHash: providerRate.rawResponseHash || null,
      receivedAt: this.clock().toISOString(),
    });

    return { ...saved, cached: false };
  }
}

module.exports = {
  CurrencyRateService,
  SUPPORTED_CURRENCIES,
  normalizeCurrencyCode,
  normalizeRequestedDate,
};
