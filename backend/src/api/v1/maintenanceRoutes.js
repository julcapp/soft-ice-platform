const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');

function createMaintenanceRouter({ maintenanceRuntime }) {
  const router = express.Router();
  router.use((req, res, next) => {
    const roles = (req.get('X-Operator-Role') || req.get('X-Admin-Role') || '').split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
    req.maintenanceContext = {
      actorId: req.get('X-Operator-ID') || req.get('X-Admin-Subject') || null, roles,
      correlationId: req.correlationId, idempotencyKey: req.get('Idempotency-Key') || null,
      sourceChannel: 'API_V1',
    }; next();
  });
  router.post('/plans', route((req) => maintenanceRuntime.createPlan(camel(req.body), req.maintenanceContext), 201));
  router.post('/machines/identify', route((req) => maintenanceRuntime.identifyMachine(camel(req.body), req.maintenanceContext)));
  router.post('/sessions', route((req) => maintenanceRuntime.openSession(camel(req.body), req.maintenanceContext), 201));
  router.get('/sessions', route((req) => maintenanceRuntime.listSessions(camel(req.query), req.maintenanceContext)));
  router.get('/sessions/:id', route((req) => maintenanceRuntime.getSession(req.params.id, req.maintenanceContext)));
  router.put('/sessions/:id/checklist/:itemId', route((req) => maintenanceRuntime.completeChecklistItem(req.params.id, req.params.itemId, camel(req.body), req.maintenanceContext)));
  router.post('/sessions/:id/photos', route((req) => maintenanceRuntime.attachPhoto(req.params.id, camel(req.body), req.maintenanceContext), 201));
  router.post('/sessions/:id/replacements', route((req) => maintenanceRuntime.replaceConsumable(req.params.id, camel(req.body), req.maintenanceContext), 201));
  router.post('/sessions/:id/test-dispense', route((req) => maintenanceRuntime.recordTestDispense(req.params.id, camel(req.body), req.maintenanceContext), 201));
  router.post('/sessions/:id/submit', route((req) => maintenanceRuntime.submit(req.params.id, camel(req.body), req.maintenanceContext)));
  router.post('/sessions/:id/approve', route((req) => maintenanceRuntime.approve(req.params.id, camel(req.body), req.maintenanceContext)));
  router.post('/sessions/:id/reject', route((req) => maintenanceRuntime.reject(req.params.id, camel(req.body), req.maintenanceContext)));
  router.get('/projection', route((req) => maintenanceRuntime.getProjection(req.maintenanceContext)));
  return router;
}
function route(handler, status = 200) { return asyncHandler(async (req, res) => sendData(res, req, await handler(req), status)); }
function camel(value) { if (Array.isArray(value)) return value.map(camel); if (!value || typeof value !== 'object') return value; return Object.fromEntries(Object.entries(value).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), camel(v)])); }
module.exports = { createMaintenanceRouter };
