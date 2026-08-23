'use strict';

const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { getPrismaClient } = require('../../common/database');
const { PricingEngineService, PricingRepository, ActivePromotionResolver, PromotionSafetyService } = require('../../modules/promotion_engine');

function resolvePricingService(dependencies = {}) {
  if (dependencies.pricingEngineService) return dependencies.pricingEngineService;
  const prisma = dependencies.prisma || getPrismaClient();
  return new PricingEngineService({
    repository: new PricingRepository(prisma),
    promotionResolver: new ActivePromotionResolver({ prisma }),
    safetyService: new PromotionSafetyService(),
    giftResolver: dependencies.giftRewardResolver || undefined,
  });
}

function createPricingRouter(dependencies = {}) {
  const router = express.Router();
  const service = resolvePricingService(dependencies);

  router.post('/quote', asyncHandler(async (req, res) => {
    const customerId = req.securityContext?.subject_type === 'customer' ? req.securityContext.subject_id : null;
    const quote = await service.createQuote({
      customerId,
      machineId: req.body?.machineId,
      channel: req.body?.channel,
      items: req.body?.items,
    });
    return sendData(res, req, quote, 201);
  }));

  return router;
}

module.exports = { createPricingRouter, resolvePricingService };
