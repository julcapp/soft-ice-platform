const { CurrencyRateService, SUPPORTED_CURRENCIES } = require('./CurrencyRateService');
const { CurrencyRateRepository, InMemoryCurrencyRateRepository } = require('./CurrencyRateRepository');
const { CbrCurrencyProvider } = require('./CbrCurrencyProvider');
const { CurrencyError } = require('./currencyErrors');

module.exports = {
  name: 'currency',
  status: 'foundation-v0.1',
  owns: ['historical FX rate lookup', 'currency rate cache'],
  CurrencyRateService,
  CurrencyRateRepository,
  InMemoryCurrencyRateRepository,
  CbrCurrencyProvider,
  CurrencyError,
  SUPPORTED_CURRENCIES,
};
