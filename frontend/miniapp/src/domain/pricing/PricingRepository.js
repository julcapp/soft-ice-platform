import { NotImplementedError } from '../../shared/errors/index.js';

export class PricingRepository {
  async getPriceList() {
    throw new NotImplementedError();
  }

  async getPricingRules() {
    throw new NotImplementedError();
  }

  async getPriceModelById(priceModelId) {
    throw new NotImplementedError();
  }
}
