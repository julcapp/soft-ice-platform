import { NotImplementedError } from '../../shared/errors/index.js';

export class LoyaltyRepository {
  async getCustomerLoyaltyProfile(customerId) {
    throw new NotImplementedError();
  }

  async listAvailableRewards(customerId) {
    throw new NotImplementedError();
  }

  async applyLoyaltyBenefit(orderId, benefitId) {
    throw new NotImplementedError();
  }
}
