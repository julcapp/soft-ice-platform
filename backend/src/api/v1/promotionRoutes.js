'use strict';

const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');
const { getPrismaClient } = require('../../common/database');
const { PromotionRepository, PromotionService } = require('../../modules/promotion_engine');

function resolvePromotionService(dependencies = {}) {
  if (dependencies.promotionService) return dependencies.promotionService;
  const prisma = dependencies.prisma || getPrismaClient();
  return new PromotionService({ repository: new PromotionRepository(prisma) });
}

function createPromotionAdminRouter(dependencies = {}) {
  const router = express.Router();
  const promotionService = resolvePromotionService(dependencies);
  router.use(createAdminAuthenticator(dependencies.adminAuth || {}));

  const actorContext = (req) => ({
    actorId: req.securityContext.subject_id,
    roles: req.securityContext.roles || [],
    authMethod: req.securityContext.auth_method,
    correlationId: req.correlationId,
    idempotencyKey: req.get('Idempotency-Key') || null,
  });

  router.post('/', asyncHandler(async (req, res) => {
    const actor = actorContext(req);
    const draft = await promotionService.createDraft({
      ...req.body,
      createdBy: actor.actorId,
    });
    return sendData(res, req, draft, 201);
  }));

  router.get('/:campaignId', asyncHandler(async (req, res) => {
    const campaign = await promotionService.getCampaign(req.params.campaignId);
    return sendData(res, req, campaign);
  }));

  router.post('/:campaignId/validate', asyncHandler(async (req, res) => {
    const actor = actorContext(req);
    const result = await promotionService.validateDraft({
      campaignId: req.params.campaignId,
      actorId: actor.actorId,
    });
    return sendData(res, req, result);
  }));

  return router;
}

module.exports = {
  createPromotionAdminRouter,
  resolvePromotionService,
};
