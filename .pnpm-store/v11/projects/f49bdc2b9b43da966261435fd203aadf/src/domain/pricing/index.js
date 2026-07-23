export {
  createPricingEntity,
  isValidDiscount,
  isValidPricingEntity,
} from './PricingEntity.js';
export { PricingRepository } from './PricingRepository.js';
export {
  PricingService,
  PricingValidationError,
} from './PricingService.js';
export { PricingEngine } from './PricingEngine.js';

import { PricingService } from './PricingService.js';

const pricingService = new PricingService();

export { pricingService };
export default pricingService;
