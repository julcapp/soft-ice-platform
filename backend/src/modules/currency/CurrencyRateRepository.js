class CurrencyRateRepository {
  async findExact() {
    throw new Error('CurrencyRateRepository.findExact must be implemented.');
  }

  async save() {
    throw new Error('CurrencyRateRepository.save must be implemented.');
  }
}

class InMemoryCurrencyRateRepository extends CurrencyRateRepository {
  constructor(seed = []) {
    super();
    this.records = new Map();
    for (const record of seed) this.records.set(this.#key(record), { ...record });
  }

  #key({ currencyCode, requestedDate, source }) {
    return `${currencyCode}:${requestedDate}:${source}`;
  }

  async findExact({ currencyCode, requestedDate, source }) {
    const record = this.records.get(this.#key({ currencyCode, requestedDate, source }));
    return record ? { ...record } : null;
  }

  async save(record) {
    const key = this.#key(record);
    const existing = this.records.get(key);
    if (existing) return { ...existing };
    const stored = { ...record };
    this.records.set(key, stored);
    return { ...stored };
  }
}

module.exports = {
  CurrencyRateRepository,
  InMemoryCurrencyRateRepository,
};
