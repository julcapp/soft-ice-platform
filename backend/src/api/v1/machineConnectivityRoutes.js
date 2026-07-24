const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');
function context(req) { return { roles: req.securityContext.roles, permissions: req.securityContext.permissions || [], actorId: req.securityContext.subject_id, correlationId: req.correlationId }; }
function createMachineConnectivityRouter({ machineConnectivityService, adminAuth = {} }) {
  const router = express.Router(); router.use(createAdminAuthenticator(adminAuth));
  router.get('/:machineId/connectivity', asyncHandler(async (req, res) => sendData(res, req, machineConnectivityService.connectivity(req.params.machineId, context(req)))));
  router.get('/:machineId/sim-card', asyncHandler(async (req, res) => sendData(res, req, machineConnectivityService.getSim(req.params.machineId, context(req)))));
  router.get('/:machineId/mobile-plan', asyncHandler(async (req, res) => sendData(res, req, machineConnectivityService.getPlan(req.params.machineId, context(req)))));
  router.get('/:machineId/connectivity/history', asyncHandler(async (req, res) => sendData(res, req, machineConnectivityService.history(req.params.machineId, context(req)))));
  router.post('/:machineId/sim-card/manual', asyncHandler(async (req, res) => sendData(res, req, await machineConnectivityService.saveSim(req.params.machineId, req.body, context(req)))));
  router.patch('/:machineId/sim-card/manual', asyncHandler(async (req, res) => sendData(res, req, await machineConnectivityService.saveSim(req.params.machineId, req.body, context(req)))));
  router.post('/:machineId/mobile-plan/manual', asyncHandler(async (req, res) => sendData(res, req, await machineConnectivityService.savePlan(req.params.machineId, req.body, context(req)))));
  router.patch('/:machineId/mobile-plan/manual', asyncHandler(async (req, res) => sendData(res, req, await machineConnectivityService.savePlan(req.params.machineId, req.body, context(req)))));
  return router;
}
module.exports = { createMachineConnectivityRouter };
