const { PromotionValidationService } = require('./PromotionValidationService');
const { PromotionSafetyService } = require('./PromotionSafetyService');
const { PromotionRepository } = require('./PromotionRepository');
const { PromotionService } = require('./PromotionService');

module.exports = {
  name: 'promotion_engine',
  status: 'foundation-v1',
  owns: [
    'promotion campaign lifecycle',
    'promotion draft workflow',
    'promotion validation rules',
    'promotion compatibility policy',
    'promotion approval workflow',
    'promotion runtime safety',
  ],
  PromotionValidationService,
  PromotionSafetyService,
  PromotionRepository,
  PromotionService,
};
