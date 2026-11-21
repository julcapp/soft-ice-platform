const { PromotionValidationService } = require('./PromotionValidationService');
const { PromotionSafetyService } = require('./PromotionSafetyService');
const { PromotionRepository } = require('./PromotionRepository');
const { PromotionService } = require('./PromotionService');
const { PricingEngineService } = require('./PricingEngineService');
const { PricingRepository } = require('./PricingRepository');
const { ActivePromotionResolver } = require('./ActivePromotionResolver');
const { PromotionAwarenessService } = require('./PromotionAwarenessService');
const { PromotionAnalyticsService } = require('./PromotionAnalyticsService');
const { PromotionChannelWebhookDispatcher, createPromotionDispatchersFromEnv } = require('./PromotionChannelWebhookDispatcher');
const { FiftiethPurchaseGiftResolver } = require('./FiftiethPurchaseGiftResolver');
const { ServerProductPricingResolver } = require('./ServerProductPricingResolver');

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
    'server-side pricing quotes',
    'promotion price locks and snapshots',
    'promotion awareness and pre-notifications',
    'promotion channel dispatch',
    'promotion channel funnel analytics',
    'per-machine fiftieth-purchase gifts',
    'authoritative server product prices',
  ],
  PromotionValidationService,
  PromotionSafetyService,
  PromotionRepository,
  PromotionService,
  PricingEngineService,
  PricingRepository,
  ActivePromotionResolver,
  PromotionAwarenessService,
  PromotionAnalyticsService,
  PromotionChannelWebhookDispatcher,
  createPromotionDispatchersFromEnv,
  FiftiethPurchaseGiftResolver,
  ServerProductPricingResolver,
};
