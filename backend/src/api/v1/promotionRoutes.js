'use strict';

const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { ApiError } = require('../../platform/errors/ApiError');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');
const { getPrismaClient } = require('../../common/database');
const { PromotionRepository, PromotionService } = require('../../modules/promotion_engine');

const PROMOTION_ROLES = {
  READ: new Set(['OBSERVER', 'MARKETER', 'MANAGER', 'ADMIN', 'OWNER']),
  CREATE_DRAFT: new Set(['MARKETER', 'MANAGER', 'ADMIN', 'OWNER']),
  EDIT_DRAFT: new Set(['MARKETER', 'MANAGER', 'ADMIN', 'OWNER']),
  CREATE_VERSION: new Set(['MANAGER', 'ADMIN', 'OWNER']),
  VALIDATE: new Set(['MANAGER', 'ADMIN', 'OWNER']),
};

function resolvePromotionService(dependencies = {}) {
  if (dependencies.promotionService) return dependencies.promotionService;
  const prisma = dependencies.prisma || getPrismaClient();
  return new PromotionService({ repository: new PromotionRepository(prisma) });
}

function requirePromotionRole(allowedRoles) {
  return (req, res, next) => {
    const roles = (req.securityContext?.roles || []).map((role) => String(role).trim().toUpperCase());
    if (roles.some((role) => allowedRoles.has(role))) return next();
    return next(new ApiError({
      statusCode: 403,
      code: 'PROMOTION_PERMISSION_DENIED',
      message: 'You do not have permission to perform this Promotion Engine operation.',
      source: 'promotion_engine',
      details: [{ allowedRoles: [...allowedRoles], actualRoles: roles }],
    }));
  };
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

  router.post('/', requirePromotionRole(PROMOTION_ROLES.CREATE_DRAFT), asyncHandler(async (req, res) => {
    const actor = actorContext(req);
    const draft = await promotionService.createDraft({ ...req.body, createdBy: actor.actorId });
    return sendData(res, req, draft, 201);
  }));

  router.get('/:campaignId', requirePromotionRole(PROMOTION_ROLES.READ), asyncHandler(async (req, res) => {
    const campaign = await promotionService.getCampaign(req.params.campaignId);
    return sendData(res, req, campaign);
  }));

  router.patch('/:campaignId', requirePromotionRole(PROMOTION_ROLES.EDIT_DRAFT), asyncHandler(async (req, res) => {
    const actor = actorContext(req);
    const campaign = await promotionService.updateDraft({ campaignId: req.params.campaignId, patch: req.body, actorId: actor.actorId });
    return sendData(res, req, campaign);
  }));

  router.post('/:campaignId/versions', requirePromotionRole(PROMOTION_ROLES.CREATE_VERSION), asyncHandler(async (req, res) => {
    const actor = actorContext(req);
    const campaign = await promotionService.createVersion({ campaignId: req.params.campaignId, version: req.body, actorId: actor.actorId });
    return sendData(res, req, campaign, 201);
  }));

  router.post('/:campaignId/validate', requirePromotionRole(PROMOTION_ROLES.VALIDATE), asyncHandler(async (req, res) => {
    const actor = actorContext(req);
    const result = await promotionService.validateDraft({ campaignId: req.params.campaignId, actorId: actor.actorId });
    return sendData(res, req, result);
  }));

  return router;
}

module.exports = { createPromotionAdminRouter, resolvePromotionService, requirePromotionRole, PROMOTION_ROLES };
