const crypto = require('crypto');

const { CurrencyError } = require('./currencyErrors');

const DEFAULT_ENDPOINT = 'https://www.cbr.ru/scripts/XML_daily.asp';

function toCbrDate(isoDate) {
  const [year, month, day] = String(isoDate).split('-');
  if (!year || !month || !day) throw new CurrencyError('INVALID_RATE_DATE', 'Rate date must use YYYY-MM-DD format.');
  return `${day}/${month}/${year}`;
}

function normalizeDecimal(value) {
  return String(value || '').trim().replace(',', '.');
}

function parseCbrDate(value) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(value || '').trim());
  if (!match) throw new CurrencyError('INVALID_PROVIDER_RESPONSE', 'CBR response date is invalid.');
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function extractTag(block, tag) {
  const match = new RegExp(`<${tag}>([^<]+)</${tag}>`, 'i').exec(block);
  return match ? match[1].trim() : null;
}

function decimalFraction(value) {
  const normalized = normalizeDecimal(value);
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    throw new CurrencyError('INVALID_PROVIDER_RESPONSE', `CBR decimal value is invalid: ${value}`);
  }
  const [whole, fraction = ''] = normalized.split('.');
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = BigInt(`${whole}${fraction}`);
  return { numerator, denominator };
}

function divideDecimalStrings(value, nominal, scale = 8) {
  const left = decimalFraction(value);
  const right = decimalFraction(nominal);
  if (right.numerator === 0n) throw new CurrencyError('INVALID_PROVIDER_RESPONSE', 'CBR nominal must be greater than zero.');

  const scaleFactor = 10n ** BigInt(scale);
  const numerator = left.numerator * right.denominator * scaleFactor;
  const denominator = left.denominator * right.numerator;
  let quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder * 2n >= denominator) quotient += 1n;

  const text = quotient.toString().padStart(scale + 1, '0');
  return `${text.slice(0, -scale)}.${text.slice(-scale)}`;
}

function parseDailyXml(xml, currencyCode) {
  const header = /<ValCurs[^>]*\bDate="([^"]+)"/i.exec(xml);
  if (!header) throw new CurrencyError('INVALID_PROVIDER_RESPONSE', 'CBR response does not contain quotation date.');
  const rateDate = parseCbrDate(header[1]);

  const blocks = xml.match(/<Valute\b[\s\S]*?<\/Valute>/gi) || [];
  const block = blocks.find((candidate) => extractTag(candidate, 'CharCode') === currencyCode);
  if (!block) throw new CurrencyError('RATE_NOT_FOUND', `CBR rate was not found for ${currencyCode}.`);

  const nominal = normalizeDecimal(extractTag(block, 'Nominal'));
  const rate = normalizeDecimal(extractTag(block, 'Value'));
  if (!nominal || !rate) throw new CurrencyError('INVALID_PROVIDER_RESPONSE', 'CBR response is missing nominal or value.');

  return {
    rateDate,
    nominal,
    rate,
    unitRate: divideDecimalStrings(rate, nominal, 8),
  };
}

class CbrCurrencyProvider {
  constructor({ fetchImpl = globalThis.fetch, endpoint = DEFAULT_ENDPOINT, timeoutMs = 5000 } = {}) {
    if (typeof fetchImpl !== 'function') throw new TypeError('CbrCurrencyProvider requires fetch implementation.');
    this.fetchImpl = fetchImpl;
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
  }

  async getRate({ currencyCode, requestedDate }) {
    const url = new URL(this.endpoint);
    url.searchParams.set('date_req', toCbrDate(requestedDate));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    try {
      response = await this.fetchImpl(url, {
        method: 'GET',
        headers: { accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1' },
        signal: controller.signal,
      });
    } catch (error) {
      throw new CurrencyError('SOURCE_UNAVAILABLE', 'CBR currency source is unavailable.', { cause: error.message });
    } finally {
      clearTimeout(timer);
    }

    if (!response || !response.ok) {
      throw new CurrencyError('SOURCE_UNAVAILABLE', 'CBR currency source returned an unsuccessful response.', {
        status: response?.status ?? null,
      });
    }

    const xml = await response.text();
    const parsed = parseDailyXml(xml, currencyCode);
    return {
      ...parsed,
      rawResponseHash: crypto.createHash('sha256').update(xml).digest('hex'),
    };
  }
}

module.exports = {
  CbrCurrencyProvider,
  DEFAULT_ENDPOINT,
  parseDailyXml,
  divideDecimalStrings,
  toCbrDate,
};
