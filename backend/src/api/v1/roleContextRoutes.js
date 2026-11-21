const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');

function createRoleContextRouter({ authCoreService, customerRoleContextService, serviceSpecialistWorkspaceService }) {
  const router = express.Router();
  const authenticateCustomer = createCustomerAuthenticator(authCoreService);

  router.get('/contexts', authenticateCustomer, asyncHandler(async (req, res) => {
    sendData(res, req, await customerRoleContextService.getForCustomer(req.securityContext.subject_id));
  }));

  router.get('/service-workspace', authenticateCustomer, asyncHandler(async (req, res) => {
    sendData(res, req, await serviceSpecialistWorkspaceService.getForCustomer(req.securityContext.subject_id));
  }));

  return router;
}

module.exports = { createRoleContextRouter };
