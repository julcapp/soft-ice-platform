'use strict';

const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { getPrismaClient } = require('../../common/database');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');
const {
  PricingEngineService,
  PricingRepository,
  ActivePromotionResolver,
  PromotionAwarenessService,
  PromotionRepository,
  PromotionSafetyService,
  FiftiethPurchaseGiftResolver,
  ServerProductPricingResolver,
} = require('../../modules/promotion_engine');

function resolvePricingService(dependencies = {}) {
  if (dependencies.pricingEngineService) return dependencies.pricingEngineService;
  const prisma = dependencies.prisma || getPrismaClient();
  const giftResolver = dependencies.giftRewardResolver || new FiftiethPurchaseGiftResolver({
    prisma,
    itemSelector: (items) => items.find((item) => item.serverProductType === 'ICE_CREAM'),
  });
  const promotionRepository = new PromotionRepository(prisma);
  return new PricingEngineService({
    repository: new PricingRepository(prisma),
    promotionResolver: new ActivePromotionResolver({ prisma }),
    safetyService: new PromotionSafetyService({ repository: promotionRepository }),
    giftResolver,
  });
}

function resolveAwarenessService(dependencies = {}) {
  if (dependencies.promotionAwarenessService) return dependencies.promotionAwarenessService;
  const prisma = dependencies.prisma || getPrismaClient();
  return new PromotionAwarenessService({ prisma, resolver: new ActivePromotionResolver({ prisma }) });
}

function resolveServerProductPricing(dependencies = {}) {
  return dependencies.serverProductPricingResolver || new ServerProductPricingResolver();
}

function optionalCustomerAuth(authCoreService) {
  if (!authCoreService) return (req, res, next) => next();
  const authenticate = createCustomerAuthenticator(authCoreService);
  return (req, res, next) => {
    if (!req.get('Authorization')) return next();
    return authenticate(req, res, next);
  };
}

function createPricingRouter(dependencies = {}) {
  const router = express.Router();
  const service = resolvePricingService(dependencies);
  const awareness = resolveAwarenessService(dependencies);
  const serverProductPricing = resolveServerProductPricing(dependencies);
  router.use(optionalCustomerAuth(dependencies.authCoreService));

  router.get('/promotion-awareness', asyncHandler(async (req, res) => {
    const customerId = req.securityContext?.subject_type === 'customer' ? req.securityContext.subject_id : null;
    const data = await awareness.getStatus({
      customerId,
      machineId: req.query?.machineId || req.query?.machine_id,
      channel: String(req.query?.channel || 'MINI_APP').toUpperCase(),
      withinMinutes: Math.min(60, Math.max(1, Number(req.query?.withinMinutes || 60))),
    });
    return sendData(res, req, data);
  }));

  router.post('/quote', asyncHandler(async (req, res) => {
    const customerId = req.securityContext?.subject_type === 'customer' ? req.securityContext.subject_id : null;
    const requestedItems = Array.isArray(req.body?.items)
      ? req.body.items.map(({ unitPrice, price, amount, serverProductType, giftEligible, ...safe }) => safe)
      : req.body?.items;
    const serverItems = await serverProductPricing.resolveItems(requestedItems);
    const quote = await service.createQuote({
      customerId,
      machineId: req.body?.machineId,
      channel: req.body?.channel,
      items: serverItems,
    });
    return sendData(res, req, quote, 201);
  }));

  return router;
}

module.exports = {
  createPricingRouter,
  resolvePricingService,
  resolveAwarenessService,
  resolveServerProductPricing,
  optionalCustomerAuth,
};
