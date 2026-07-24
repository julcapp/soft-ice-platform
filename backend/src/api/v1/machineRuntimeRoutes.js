const express = require('express');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');
const { ApiError } = require('../../platform/errors/ApiError');
const ALLOWED = ['PLATFORM_OWNER', 'ADMIN'];
function authorize(req, res, next) {
  if ((req.securityContext?.roles || []).some((role) => ALLOWED.includes(role))) return next();
  next(new ApiError({ statusCode: 403, code: 'MACHINE_RUNTIME_READ_FORBIDDEN', message: 'Machine Runtime access requires ADMIN or PLATFORM_OWNER.', source: 'api' }));
}
function createMachineRuntimeRouter({ machineRuntimeService, adminAuth } = {}) {
  const router = express.Router(); router.use(createAdminAuthenticator(adminAuth), authorize);
  router.get('/', (req, res) => res.json({ data: machineRuntimeService.list().map((machine) => decorate(machineRuntimeService, machine)), meta: meta() }));
  router.get('/:machineId', (req, res) => res.json({ data: decorate(machineRuntimeService, machineRuntimeService.get(req.params.machineId)), meta: meta() }));
  router.get('/:machineId/session', (req, res) => res.json({ data: machineRuntimeService.activeSession(req.params.machineId), meta: meta() }));
  router.get('/:machineId/transitions', (req, res) => res.json({ data: machineRuntimeService.transitions(req.params.machineId), meta: meta() }));
  return router;
}
function decorate(service, machine) { return { ...machine, activeSession: service.activeSession(machine.machineId), recentSignals: service.signals(machine.machineId), transitions: service.transitions(machine.machineId) }; }
function meta() { return { access: 'READ_ONLY', apiVersion: 'v1', durability: 'IN_MEMORY_FOUNDATION' }; }
module.exports = { createMachineRuntimeRouter };
