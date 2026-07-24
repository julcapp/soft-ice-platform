const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');

function createOperatorWorkspaceRouter({ operatorWorkspaceRuntime }) {
  const router = express.Router();
  router.use((req, res, next) => {
    req.operatorWorkspaceContext = {
      actorId: req.get('X-Operator-ID') || null,
      roles: (req.get('X-Operator-Role') || '').split(',').map((role) => role.trim().toUpperCase()).filter(Boolean),
      correlationId: req.correlationId,
      idempotencyKey: req.get('Idempotency-Key') || null,
    };
    next();
  });
  router.get('/machines', route((req) => operatorWorkspaceRuntime.listMachines(req.operatorWorkspaceContext)));
  router.get('/machines/:machineId', route((req) => operatorWorkspaceRuntime.getMachine(req.params.machineId, req.operatorWorkspaceContext)));
  router.post('/machines/:machineId/sessions', route((req) => operatorWorkspaceRuntime.openSession(req.params.machineId, camel(req.body), req.operatorWorkspaceContext), 201));
  router.get('/sessions/:sessionId', route((req) => operatorWorkspaceRuntime.getSession(req.params.sessionId, req.operatorWorkspaceContext)));
  router.put('/sessions/:sessionId/checklist/:itemId', route((req) => operatorWorkspaceRuntime.updateChecklist(req.params.sessionId, req.params.itemId, camel(req.body), req.operatorWorkspaceContext)));
  router.post('/sessions/:sessionId/photos', route((req) => operatorWorkspaceRuntime.attachPhoto(req.params.sessionId, camel(req.body), req.operatorWorkspaceContext), 201));
  router.post('/sessions/:sessionId/tests', route((req) => operatorWorkspaceRuntime.performTest(req.params.sessionId, camel(req.body), req.operatorWorkspaceContext), 201));
  router.post('/sessions/:sessionId/consumptions', route((req) => operatorWorkspaceRuntime.recordConsumption(req.params.sessionId, camel(req.body), req.operatorWorkspaceContext), 201));
  router.post('/sessions/:sessionId/complete', route((req) => operatorWorkspaceRuntime.completeSession(req.params.sessionId, camel(req.body), req.operatorWorkspaceContext)));
  router.get('/actions', route((req) => operatorWorkspaceRuntime.listActions(camel(req.query), req.operatorWorkspaceContext)));
  return router;
}

function route(handler, status = 200) { return asyncHandler(async (req, res) => sendData(res, req, await handler(req), status)); }
function camel(value) {
  if (Array.isArray(value)) return value.map(camel);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), camel(child)]));
}

module.exports = { createOperatorWorkspaceRouter };
