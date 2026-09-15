const { CurrencyRateService, SUPPORTED_CURRENCIES } = require('./CurrencyRateService');
const { CurrencyRateRepository, InMemoryCurrencyRateRepository } = require('./CurrencyRateRepository');
const { PostgresCurrencyRateRepository } = require('./PostgresCurrencyRateRepository');
const { CbrCurrencyProvider } = require('./CbrCurrencyProvider');
const { createCurrencyRuntime } = require('./CurrencyRuntimeFactory');
const { CurrencyError } = require('./currencyErrors');

module.exports = {
  name: 'currency',
  status: 'foundation-v0.1',
  owns: ['historical FX rate lookup', 'currency rate cache'],
  CurrencyRateService,
  CurrencyRateRepository,
  InMemoryCurrencyRateRepository,
  PostgresCurrencyRateRepository,
  CbrCurrencyProvider,
  createCurrencyRuntime,
  CurrencyError,
  SUPPORTED_CURRENCIES,
};
