const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');
function context(req) { return { roles: req.securityContext.roles, actorId: req.securityContext.subject_id, correlationId: req.correlationId }; }
function createExternalChannelRouter({ externalChannelService, adminAuth = {} }) {
  const router = express.Router(); router.use(createAdminAuthenticator(adminAuth));
  router.get('/:customerId/external-channels', asyncHandler(async (req, res) => sendData(res, req, await externalChannelService.channels(req.params.customerId, null, context(req)))));
  router.get('/:customerId/external-channels/:channelType', asyncHandler(async (req, res) => sendData(res, req, await externalChannelService.channels(req.params.customerId, String(req.params.channelType).toUpperCase(), context(req)))));
  router.get('/:customerId/subscriptions', asyncHandler(async (req, res) => sendData(res, req, await externalChannelService.subscriptions(req.params.customerId, context(req)))));
  router.get('/:customerId/engagement', asyncHandler(async (req, res) => sendData(res, req, await externalChannelService.engagement(req.params.customerId, context(req)))));
  router.post('/:customerId/external-channels/manual', asyncHandler(async (req, res) => sendData(res, req, await externalChannelService.saveManualProfile(req.params.customerId, req.body, context(req)))));
  router.patch('/:customerId/external-channels/manual/:id', asyncHandler(async (req, res) => sendData(res, req, await externalChannelService.saveManualProfile(req.params.customerId, req.body, context(req), req.params.id))));
  router.post('/:customerId/subscriptions/manual', asyncHandler(async (req, res) => sendData(res, req, await externalChannelService.saveManualSubscription(req.params.customerId, req.body, context(req)))));
  router.patch('/:customerId/subscriptions/manual/:id', asyncHandler(async (req, res) => sendData(res, req, await externalChannelService.saveManualSubscription(req.params.customerId, req.body, context(req), req.params.id))));
  return router;
}
module.exports = { createExternalChannelRouter };
