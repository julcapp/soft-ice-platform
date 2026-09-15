const { CbrCurrencyProvider } = require('./CbrCurrencyProvider');
const { CurrencyRateService } = require('./CurrencyRateService');
const { PostgresCurrencyRateRepository } = require('./PostgresCurrencyRateRepository');

function createCurrencyRuntime({ prisma, fetchImpl = globalThis.fetch, clock = () => new Date() }) {
  if (!prisma) throw new TypeError('createCurrencyRuntime requires Prisma client.');

  const repository = new PostgresCurrencyRateRepository(prisma);
  const cbrProvider = new CbrCurrencyProvider({ fetchImpl });
  const currencyRateService = new CurrencyRateService({ repository, cbrProvider, clock });

  return {
    currencyRateRepository: repository,
    currencyRateService,
    cbrCurrencyProvider: cbrProvider,
  };
}

module.exports = {
  createCurrencyRuntime,
};
