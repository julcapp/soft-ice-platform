const { PromotionValidationService } = require('./PromotionValidationService');
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
  ],
  PromotionValidationService,
  PromotionRepository,
  PromotionService,
};
