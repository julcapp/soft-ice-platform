const crypto = require('crypto');
const express = require('express');

function createEquipmentV1Router(dependencies, { config, logger } = {}) {
  const router = express.Router();
  const service = dependencies.equipmentIntegrationService;
  if (!service) throw new Error('equipmentIntegrationService is required.');

  router.get('/health', (req, res) => {
    res.json({ status: 'online', service: 'soft-ice-equipment-integration', version: 'v1', mode: 'SANDBOX' });
  });

  router.use((req, res, next) => {
    if (!config?.equipmentIntegration?.enabled) return res.status(503).json(errorBody('EQUIPMENT_SANDBOX_DISABLED', 'Equipment Integration sandbox is disabled.'));
    const expected = config.equipmentIntegration.apiKey;
    const supplied = req.get('X-API-Key') || '';
    if (!expected || !secureEqual(supplied, expected)) {
      logger?.warn?.('equipment.auth.denied', { path: req.path, method: req.method });
      return res.status(401).json(errorBody('EQUIPMENT_AUTH_REQUIRED', 'Valid equipment sandbox credentials are required.'));
    }
    return next();
  });

  router.post('/machines/register', safe(async (req, res) => {
    const machine = service.registerMachine(req.body || {});
    res.status(200).json({ data: machine });
  }));

  router.post('/machines/:id/heartbeat', safe(async (req, res) => {
    const machine = service.heartbeat(req.params.id, req.body || {});
    res.status(202).json({ data: machine });
  }));

  router.post('/machines/:id/telemetry', safe(async (req, res) => {
    const telemetry = service.recordTelemetry(req.params.id, req.body || {});
    res.status(202).json({ data: telemetry });
  }));

  router.post('/machines/:id/status', safe(async (req, res) => {
    const machine = service.recordStatus(req.params.id, req.body || {});
    res.status(202).json({ data: machine });
  }));

  router.get('/machines/:id/commands', safe(async (req, res) => {
    res.json({ data: service.pendingCommands(req.params.id) });
  }));

  router.post('/machines/:id/commands/:commandId/ack', safe(async (req, res) => {
    const command = service.acknowledgeCommand(req.params.id, req.params.commandId);
    res.status(202).json({ data: command });
  }));

  router.post('/machines/:id/dispense/result', safe(async (req, res) => {
    const result = service.recordDispenseResult(req.params.id, req.body || {});
    res.status(202).json({ data: result });
  }));

  router.post('/machines/:id/events', safe(async (req, res) => {
    const event = service.recordEvent(req.params.id, req.body || {});
    res.status(202).json({ data: event });
  }));

  return router;
}

function createEquipmentAdminRouter(dependencies) {
  const router = express.Router();
  const service = dependencies.equipmentIntegrationService;

  router.get('/machines/:id', safe(async (req, res) => {
    res.json({ data: service.dashboardSnapshot(req.params.id) });
  }));

  router.post('/machines/:id/test-dispense', safe(async (req, res) => {
    const command = service.enqueueDispense(req.params.id, req.body || {});
    res.status(201).json({ data: command });
  }));

  return router;
}

function safe(handler) {
  return async (req, res, next) => {
    try { await handler(req, res); } catch (error) { next(error); }
  };
}

function secureEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function errorBody(code, message) { return { error: { code, message } }; }

module.exports = { createEquipmentV1Router, createEquipmentAdminRouter };
