'use strict';

const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { getPrismaClient } = require('../../common/database');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');
const { PricingEngineService, PricingRepository, ActivePromotionResolver, PromotionSafetyService, FiftiethPurchaseGiftResolver } = require('../../modules/promotion_engine');

function resolvePricingService(dependencies = {}) {
  if (dependencies.pricingEngineService) return dependencies.pricingEngineService;
  const prisma = dependencies.prisma || getPrismaClient();
  const giftResolver = dependencies.giftRewardResolver || new FiftiethPurchaseGiftResolver({
    prisma,
    itemSelector: dependencies.serverVerifiedGiftItemSelector || (() => null),
  });
  return new PricingEngineService({
    repository: new PricingRepository(prisma),
    promotionResolver: new ActivePromotionResolver({ prisma }),
    safetyService: new PromotionSafetyService(),
    giftResolver,
  });
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
  router.use(optionalCustomerAuth(dependencies.authCoreService));

  router.post('/quote', asyncHandler(async (req, res) => {
    const customerId = req.securityContext?.subject_type === 'customer' ? req.securityContext.subject_id : null;
    const items = Array.isArray(req.body?.items)
      ? req.body.items.map(({ serverProductType, giftEligible, ...safe }) => safe)
      : req.body?.items;
    const quote = await service.createQuote({
      customerId,
      machineId: req.body?.machineId,
      channel: req.body?.channel,
      items: dependencies.enrichPricingItems ? await dependencies.enrichPricingItems(items, { machineId: req.body?.machineId, customerId }) : items,
    });
    return sendData(res, req, quote, 201);
  }));

  return router;
}

module.exports = { createPricingRouter, resolvePricingService, optionalCustomerAuth };
