'use strict';

const express = require('express');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');

function context(req) { return { correlationId: req.correlationId, idempotencyKey: req.get('Idempotency-Key') || null, actorType: req.securityContext.subject_type, actorId: req.securityContext.subject_id, authMethod: req.securityContext.auth_method, sourceChannel: 'api_v1' }; }

function createGiftTransferRouter({ authCoreService, giftTransferRuntime }) {
  const router = express.Router();
  const auth = createCustomerAuthenticator(authCoreService);
  router.get('/prepaid-orders/:orderId/gift-options', auth, asyncHandler(async (req,res) => sendData(res,req,await giftTransferRuntime.giftOptions(req.securityContext.subject_id,req.params.orderId))));
  router.post('/prepaid-orders/:orderId/cancel-to-balance', auth, asyncHandler(async (req,res) => sendData(res,req,await giftTransferRuntime.cancelPrepaidOrderToBalance(req.securityContext.subject_id,req.params.orderId,context(req)))));
  router.post('/prepaid-orders/:orderId/gift', auth, asyncHandler(async (req,res) => sendData(res,req,await giftTransferRuntime.createGift(req.securityContext.subject_id,req.params.orderId,req.body || {},context(req)),201)));
  router.get('/gifts', auth, asyncHandler(async (req,res) => sendData(res,req,await giftTransferRuntime.listOwn(req.securityContext.subject_id))));
  router.get('/gifts/:id', auth, asyncHandler(async (req,res) => sendData(res,req,await giftTransferRuntime.getOwn(req.securityContext.subject_id,req.params.id))));
  router.post('/gifts/:id/accept', auth, asyncHandler(async (req,res) => sendData(res,req,await giftTransferRuntime.accept(req.securityContext.subject_id,req.params.id,context(req)))));
  router.post('/gifts/:id/request-redemption', auth, asyncHandler(async (req,res) => sendData(res,req,await giftTransferRuntime.requestRedemption(req.securityContext.subject_id,req.params.id,context(req)))));
  router.post('/gifts/:id/cancel', auth, asyncHandler(async (req,res) => sendData(res,req,await giftTransferRuntime.cancel(req.securityContext.subject_id,req.params.id,context(req)))));
  router.post('/gift-invitations/claim', auth, asyncHandler(async (req,res) => sendData(res,req,await giftTransferRuntime.claimInvitation(req.securityContext.subject_id,req.body?.token,context(req)))));
  return router;
}

function createAdminGiftTransferRouter({ giftTransferRuntime }) {
  const router = express.Router();
  const auth = createAdminAuthenticator();
  const permit = (permission) => (req,res,next) => { const roles = req.securityContext.roles || []; if (roles.some((x) => ['ADMIN','PLATFORM_OWNER',permission].includes(x))) return next(); const error = new Error('Недостаточно прав.'); error.statusCode=403; error.code='PERMISSION_DENIED'; next(error); };
  router.get('/', auth, permit('gift_transfer.admin_view'), asyncHandler(async (req,res) => sendData(res,req,(await giftTransferRuntime.service.repository.list()).map(adminGiftDto))));
  router.get('/statistics', auth, permit('gift_transfer.admin_view'), asyncHandler(async (req,res) => sendData(res,req,await giftTransferRuntime.statistics())));
  router.get('/:id', auth, permit('gift_transfer.admin_view'), asyncHandler(async (req,res) => sendData(res,req,adminGiftDto(await giftTransferRuntime.service.repository.findById(req.params.id)))));
  router.get('/:id/deliveries', auth, permit('notification_delivery.view'), asyncHandler(async (req,res) => {
    const repository = giftTransferRuntime.service.repository;
    const gift = await repository.findById(req.params.id);
    const rows = gift ? await repository.listDeliveriesByCorrelationId(gift.correlationId) : [];
    sendData(res,req,rows);
  }));
  return router;
}

function adminGiftDto(gift) { if (!gift) return null; const { recipientPhoneNormalized, invitationTokenHash, ...safe } = gift; return { ...safe, recipientPhoneMasked: recipientPhoneNormalized ? `${recipientPhoneNormalized.slice(0,2)} *** ***-${recipientPhoneNormalized.slice(-4,-2)}-${recipientPhoneNormalized.slice(-2)}` : null }; }

module.exports = { createGiftTransferRouter, createAdminGiftTransferRouter };
