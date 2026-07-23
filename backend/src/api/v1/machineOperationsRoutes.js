const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { toChecklistDto, toInventoryMovementDto, toOperatorDto, toPhotoEvidenceDto, toServiceLogDto, toTaskDto, toTestRunDto } = require('../../modules/machine_operations/machineOperationsDto');

function createMachineOperationsRouter({ machineOperationsRuntime }) {
  const router = express.Router();
  router.use((req, res, next) => {
    req.operatorContext = {
      actorId: req.get('X-Operator-ID') || null,
      authMethod: 'trusted_operator_gateway', sourceChannel: 'api_v1',
      correlationId: req.correlationId, idempotencyKey: req.get('Idempotency-Key') || null,
    };
    next();
  });
  router.post('/operators', route(async (req) => toOperatorDto(await machineOperationsRuntime.createOperator(camel(req.body), req.operatorContext)), 201));
  router.post('/checklists', route(async (req) => toChecklistDto(await machineOperationsRuntime.configureChecklist(camel(req.body), req.operatorContext)), 201));
  router.post('/maintenance-tasks', route(async (req) => toTaskDto(await machineOperationsRuntime.createMaintenanceTask(camel(req.body), req.operatorContext)), 201));
  router.post('/maintenance-tasks/:id/execute', route(async (req) => toTaskDto(await machineOperationsRuntime.executeMaintenanceTask(req.params.id, camel(req.body), req.operatorContext))));
  router.post('/test-runs', route(async (req) => toTestRunDto(await machineOperationsRuntime.performTestRun(camel(req.body), req.operatorContext)), 201));
  router.post('/inventory-movements', route(async (req) => toInventoryMovementDto(await machineOperationsRuntime.recordConsumption(camel(req.body), req.operatorContext)), 201));
  router.post('/service-logs', route(async (req) => toServiceLogDto(await machineOperationsRuntime.submitServiceReport(camel(req.body), req.operatorContext)), 201));
  router.post('/service-logs/:id/approve', route(async (req) => toServiceLogDto(await machineOperationsRuntime.approveServiceReport(req.params.id, camel(req.body), req.operatorContext))));
  router.post('/photo-evidence', route(async (req) => toPhotoEvidenceDto(await machineOperationsRuntime.attachPhotoEvidence(camel(req.body), req.operatorContext)), 201));
  router.get('/actions', route(async (req) => machineOperationsRuntime.listOperatorActions(req.query.limit, req.operatorContext)));
  router.put('/machines/:machineId/settings/:key', route(async (req) => machineOperationsRuntime.manageMachineSetting(req.params.machineId, req.params.key, req.body && req.body.value, req.operatorContext)));
  return router;
}

function route(handler, status = 200) { return asyncHandler(async (req, res) => sendData(res, req, await handler(req), status)); }
function camel(value) {
  if (Array.isArray(value)) return value.map(camel);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), camel(child)]));
}

module.exports = { createMachineOperationsRouter };
