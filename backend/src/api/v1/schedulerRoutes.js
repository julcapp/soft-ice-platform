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
