const crypto = require('node:crypto');
const express = require('express');
const { asyncHandler, sendData } = require('../platform/http/apiResponse');
const { ApiError } = require('../platform/errors/ApiError');

function createMachineEdgeRouter({ adminMachineSettingsService }, { config, logger } = {}) {
  const router = express.Router();

  router.use((req, _res, next) => {
    const expected = config?.equipmentIntegration?.apiKey || '';
    const supplied = req.get('X-API-Key') || '';
    if (!expected || !secureEqual(supplied, expected)) {
      logger?.warn?.('machine.edge.auth.denied', { path: req.path, method: req.method });
      return next(new ApiError({
        statusCode: 401,
        code: 'MACHINE_EDGE_AUTH_REQUIRED',
        message: 'Valid machine edge credentials are required.',
        source: 'machine_edge',
      }));
    }
    return next();
  });

  router.post('/machines/:machineId/hardware-inventory', asyncHandler(async (req, res) => {
    const payload = { ...(req.body || {}), correlationId: req.correlationId };
    const result = await adminMachineSettingsService.reportHardwareInventory(req.params.machineId, payload);
    sendData(res, req, result, 202);
  }));

  return router;
}

function secureEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { createMachineEdgeRouter };
