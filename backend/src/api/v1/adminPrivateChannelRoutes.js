const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');
const { ApiError } = require('../../platform/errors/ApiError');

function createAdminPrivateChannelRouter({ privateChannelRecoveryService }) {
  const router = express.Router();
  const authenticateAdmin = createAdminAuthenticator();
  router.use(authenticateAdmin, requireAdminRole);

  router.get('/recovery', asyncHandler(async (req, res) => {
    sendData(res, req, await privateChannelRecoveryService.listQueue({ limit: req.query.limit }));
  }));

  router.post('/recovery/:attemptId/retry', asyncHandler(async (req, res) => {
    sendData(res, req, await privateChannelRecoveryService.retry(req.params.attemptId));
  }));

  router.post('/recovery/expire-exhausted-access', asyncHandler(async (req, res) => {
    sendData(res, req, await privateChannelRecoveryService.expireExhaustedAccess({ limit: req.body?.limit }));
  }));

  return router;
}

function requireAdminRole(req, res, next) {
  const roles = req.securityContext?.roles || [];
  if (roles.includes('ADMIN') || roles.includes('PLATFORM_OWNER')) return next();
  return next(new ApiError({ statusCode: 403, code: 'ADMIN_ROLE_REQUIRED', message: 'Требуется роль ADMIN или PLATFORM_OWNER.', source: 'api' }));
}

module.exports = { createAdminPrivateChannelRouter };
