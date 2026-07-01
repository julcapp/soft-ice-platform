import { LoyaltyRepository } from './LoyaltyRepository.js';

export class LoyaltyService {
  constructor(repository = new LoyaltyRepository()) {
    this.repository = repository;
  }

  getCustomerLoyaltyProfile(customerId) {
    return this.repository.getCustomerLoyaltyProfile(customerId);
  }

  listAvailableRewards(customerId) {
    return this.repository.listAvailableRewards(customerId);
  }

  applyLoyaltyBenefit(orderId, benefitId) {
    return this.repository.applyLoyaltyBenefit(orderId, benefitId);
  }
}
