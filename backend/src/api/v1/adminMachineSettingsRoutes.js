const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');

function context(req) {
  return {
    roles: req.securityContext?.roles || [],
    subjectId: req.securityContext?.subject_id || req.securityContext?.subject || null,
    authMethod: req.securityContext?.auth_method || 'admin_session',
    correlationId: req.correlationId,
  };
}

function createAdminMachineSettingsRouter({ adminMachineSettingsService, adminAuth = {} }) {
  const router = express.Router();
  router.use(createAdminAuthenticator(adminAuth));
  router.get('/:machineId/settings', asyncHandler(async (req, res) => {
    sendData(res, req, await adminMachineSettingsService.get(req.params.machineId, context(req)));
  }));
  router.put('/:machineId/settings/:key', express.json(), asyncHandler(async (req, res) => {
    sendData(res, req, await adminMachineSettingsService.update(req.params.machineId, req.params.key, req.body?.value, context(req)));
  }));
  return router;
}

module.exports = { createAdminMachineSettingsRouter };
