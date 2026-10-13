const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');

function createSchedulerRouter({ service, adminAuth = {} }) {
  const router = express.Router();
  router.use(createAdminAuthenticator(adminAuth));
  router.get('/', asyncHandler(async (req, res) => sendData(res, req, await service.list(req.securityContext))));
  router.get('/:id', asyncHandler(async (req, res) => sendData(res, req, await service.get(req.params.id, req.securityContext))));
  return router;
}

module.exports = { createSchedulerRouter };

[executed on device: Home-Boss (3edc2642-7822-40ad-8421-dfa47fe2a398)]