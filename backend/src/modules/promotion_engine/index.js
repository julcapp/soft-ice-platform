const { PromotionValidationService } = require('./PromotionValidationService');

module.exports = {
  name: 'promotion_engine',
  status: 'foundation-v1',
  owns: [
    'promotion campaign lifecycle',
    'promotion validation rules',
    'promotion compatibility policy',
  ],
  PromotionValidationService,
};
