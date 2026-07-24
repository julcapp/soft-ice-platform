const express = require('express');
const { asyncHandler } = require('../../platform/http/apiResponse');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');

function createMachineTwinRouter({ machineTwinService, adminAuth = {} }) {
  const router = express.Router();
  const authenticate = createAdminAuthenticator(adminAuth);
  router.use(authenticate);
  router.get('/', asyncHandler(async (req, res) => res.json({ data: await machineTwinService.list(req.securityContext), meta: readMeta() })));
  router.get('/:machineId', asyncHandler(async (req, res) => res.json({ data: await machineTwinService.get(req.params.machineId, req.securityContext), meta: readMeta() })));
  router.get('/:machineId/components', asyncHandler(async (req, res) => res.json({ data: await machineTwinService.components(req.params.machineId, req.securityContext), meta: readMeta() })));
  router.get('/:machineId/events', asyncHandler(async (req, res) => res.json({ data: await machineTwinService.events(req.params.machineId, req.securityContext), meta: readMeta() })));
  router.get('/:machineId/snapshots', asyncHandler(async (req, res) => res.json({ data: await machineTwinService.snapshots(req.params.machineId, req.securityContext), meta: readMeta() })));
  router.get('/:machineId/health', asyncHandler(async (req, res) => res.json({ data: await machineTwinService.health(req.params.machineId, req.securityContext), meta: readMeta() })));
  return router;
}
function readMeta() { return { access: 'READ_ONLY', apiVersion: 'v1' }; }
module.exports = { createMachineTwinRouter };
