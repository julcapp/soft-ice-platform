import { PricingRepository } from './PricingRepository.js';

export class PriceEngine {
  constructor(repository = new PricingRepository()) {
    this.repository = repository;
  }

  getPriceList() {
    return this.repository.getPriceList();
  }

  getPricingRules() {
    return this.repository.getPricingRules();
  }

  getPriceModelById(priceModelId) {
    return this.repository.getPriceModelById(priceModelId);
  }
}
