'use strict';

const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { ApiError } = require('../../platform/errors/ApiError');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');
const { getPrismaClient } = require('../../common/database');
const { PromotionRepository, PromotionService } = require('../../modules/promotion_engine');

const PROMOTION_ROLES = {
  READ: new Set(['OBSERVER','MARKETER','MANAGER','ADMIN','OWNER']),
  CREATE_DRAFT: new Set(['MARKETER','MANAGER','ADMIN','OWNER']),
  EDIT_DRAFT: new Set(['MARKETER','MANAGER','ADMIN','OWNER']),
  CREATE_VERSION: new Set(['MANAGER','ADMIN','OWNER']),
  VALIDATE: new Set(['MANAGER','ADMIN','OWNER']),
  REQUEST_APPROVAL: new Set(['MANAGER','ADMIN','OWNER']),
  APPROVE: new Set(['MANAGER','ADMIN','OWNER']),
  SCHEDULE: new Set(['MANAGER','ADMIN','OWNER']),
  ACTIVATE: new Set(['ADMIN','OWNER']),
  CONTROL: new Set(['ADMIN','OWNER']),
  ARCHIVE: new Set(['ADMIN','OWNER']),
};
function resolvePromotionService(dependencies={}) { if (dependencies.promotionService) return dependencies.promotionService; const prisma = dependencies.prisma || getPrismaClient(); return new PromotionService({ repository: new PromotionRepository(prisma) }); }
function requirePromotionRole(allowedRoles) { return (req,res,next) => { const roles=(req.securityContext?.roles||[]).map((role)=>String(role).trim().toUpperCase()); if (roles.some((role)=>allowedRoles.has(role))) return next(); return next(new ApiError({ statusCode:403, code:'PROMOTION_PERMISSION_DENIED', message:'You do not have permission to perform this Promotion Engine operation.', source:'promotion_engine', details:[{allowedRoles:[...allowedRoles],actualRoles:roles}] })); }; }
function createPromotionAdminRouter(dependencies={}) {
  const router=express.Router(); const promotionService=resolvePromotionService(dependencies); router.use(createAdminAuthenticator(dependencies.adminAuth||{}));
  const actor=(req)=>({ actorId:req.securityContext.subject_id, roles:req.securityContext.roles||[], authMethod:req.securityContext.auth_method, correlationId:req.correlationId, idempotencyKey:req.get('Idempotency-Key')||null });
  router.post('/', requirePromotionRole(PROMOTION_ROLES.CREATE_DRAFT), asyncHandler(async(req,res)=>sendData(res,req,await promotionService.createDraft({...req.body,createdBy:actor(req).actorId}),201)));
  router.get('/:campaignId', requirePromotionRole(PROMOTION_ROLES.READ), asyncHandler(async(req,res)=>sendData(res,req,await promotionService.getCampaign(req.params.campaignId))));
  router.patch('/:campaignId', requirePromotionRole(PROMOTION_ROLES.EDIT_DRAFT), asyncHandler(async(req,res)=>sendData(res,req,await promotionService.updateDraft({campaignId:req.params.campaignId,patch:req.body,actorId:actor(req).actorId}))));
  router.post('/:campaignId/versions', requirePromotionRole(PROMOTION_ROLES.CREATE_VERSION), asyncHandler(async(req,res)=>sendData(res,req,await promotionService.createVersion({campaignId:req.params.campaignId,version:req.body,actorId:actor(req).actorId}),201)));
  router.post('/:campaignId/validate', requirePromotionRole(PROMOTION_ROLES.VALIDATE), asyncHandler(async(req,res)=>sendData(res,req,await promotionService.validateDraft({campaignId:req.params.campaignId,actorId:actor(req).actorId}))));

  router.post('/:campaignId/approval-requests', requirePromotionRole(PROMOTION_ROLES.REQUEST_APPROVAL), asyncHandler(async(req,res)=>sendData(res,req,await promotionService.requestApproval({campaignId:req.params.campaignId,actorId:actor(req).actorId,reason:req.body?.reason||null}),201)));
  router.get('/:campaignId/approvals', requirePromotionRole(PROMOTION_ROLES.READ), asyncHandler(async(req,res)=>sendData(res,req,await promotionService.getApprovalHistory(req.params.campaignId))));
  router.post('/:campaignId/approve', requirePromotionRole(PROMOTION_ROLES.APPROVE), asyncHandler(async(req,res)=>{ const a=actor(req); return sendData(res,req,await promotionService.approve({campaignId:req.params.campaignId,actorId:a.actorId,actorRoles:a.roles,reason:req.body?.reason||null}),201); }));
  router.post('/:campaignId/reject', requirePromotionRole(PROMOTION_ROLES.APPROVE), asyncHandler(async(req,res)=>{ const a=actor(req); return sendData(res,req,await promotionService.reject({campaignId:req.params.campaignId,actorId:a.actorId,actorRoles:a.roles,reason:req.body?.reason||null}),201); }));

  router.post('/:campaignId/schedule', requirePromotionRole(PROMOTION_ROLES.SCHEDULE), asyncHandler(async(req,res)=>sendData(res,req,await promotionService.schedule({campaignId:req.params.campaignId,actorId:actor(req).actorId,startsAt:req.body.startsAt,endsAt:req.body.endsAt}))));
  router.post('/:campaignId/activate', requirePromotionRole(PROMOTION_ROLES.ACTIVATE), asyncHandler(async(req,res)=>sendData(res,req,await promotionService.activate({campaignId:req.params.campaignId,actorId:actor(req).actorId}))));
  router.post('/:campaignId/run-now', requirePromotionRole(PROMOTION_ROLES.ACTIVATE), asyncHandler(async(req,res)=>sendData(res,req,await promotionService.activate({campaignId:req.params.campaignId,actorId:actor(req).actorId,runNow:true,durationMinutes:req.body?.durationMinutes ?? null}))));
  router.post('/:campaignId/pause', requirePromotionRole(PROMOTION_ROLES.CONTROL), asyncHandler(async(req,res)=>sendData(res,req,await promotionService.pause({campaignId:req.params.campaignId,actorId:actor(req).actorId,reason:req.body?.reason||null}))));
  router.post('/:campaignId/resume', requirePromotionRole(PROMOTION_ROLES.CONTROL), asyncHandler(async(req,res)=>sendData(res,req,await promotionService.resume({campaignId:req.params.campaignId,actorId:actor(req).actorId,reason:req.body?.reason||null}))));
  router.post('/:campaignId/end', requirePromotionRole(PROMOTION_ROLES.CONTROL), asyncHandler(async(req,res)=>sendData(res,req,await promotionService.end({campaignId:req.params.campaignId,actorId:actor(req).actorId,reason:req.body?.reason||null}))));
  router.post('/:campaignId/archive', requirePromotionRole(PROMOTION_ROLES.ARCHIVE), asyncHandler(async(req,res)=>sendData(res,req,await promotionService.archive({campaignId:req.params.campaignId,actorId:actor(req).actorId,reason:req.body?.reason||null}))));
  return router;
}
module.exports={createPromotionAdminRouter,resolvePromotionService,requirePromotionRole,PROMOTION_ROLES};