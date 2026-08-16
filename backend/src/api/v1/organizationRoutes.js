const express = require('express');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');
const { ApiError } = require('../../platform/errors/ApiError');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');

const GLOBAL_ROLES = new Set(['PLATFORM_OWNER', 'ADMIN']);
const ORGANIZATION_ROLES = new Set(['ORGANIZATION_ADMIN', 'ORGANIZATION_MANAGER']);

function createOrganizationRouter({ organizationRuntime, adminAuth = {} }) {
  const router = express.Router();
  const environment = adminAuth.environment || process.env.NODE_ENV || 'development';
  router.use(createAdminAuthenticator(adminAuth));
  router.use((req, res, next) => {
    const roles = req.securityContext.roles || [];
    const global = roles.some((role) => GLOBAL_ROLES.has(role));
    const organizationId = req.securityContext.organization_id || (environment !== 'production' ? req.get('X-Organization-Id') : null);
    if (!global && !roles.some((role) => ORGANIZATION_ROLES.has(role))) return next(denied());
    if (!global && !organizationId) return next(new ApiError({ statusCode: 403, code: 'ORGANIZATION_SCOPE_REQUIRED', message: 'Для роли организации не задан контур доступа.', source: 'api' }));
    req.organizationScope = { global, organizationId };
    next();
  });
  const scoped = (req, id = req.params.id) => {
    if (!req.organizationScope.global && req.organizationScope.organizationId !== id) throw denied();
  };
  const read = (handler) => asyncHandler(async (req, res) => { scoped(req); return sendData(res, req, await handler(req)); });
  const mutate = (handler, status = 200) => asyncHandler(async (req, res) => {
    scoped(req); const roles = req.securityContext.roles || [];
    if (!roles.some((role) => GLOBAL_ROLES.has(role) || role === 'ORGANIZATION_ADMIN')) throw denied();
    return sendData(res, req, await handler(req), status);
  });
  const context = (req) => ({ actorType: 'ADMINISTRATOR', actorId: req.securityContext.subject_id, authMethod: req.securityContext.auth_method, sourceChannel: 'ADMIN_API', correlationId: req.correlationId, global: req.organizationScope.global });

  router.get('/', asyncHandler(async (req, res) => sendData(res, req, await organizationRuntime.list(req.organizationScope))));
  router.post('/', mutate((req) => organizationRuntime.create(camel(req.body), context(req)), 201));
  router.get('/:id', read((req) => organizationRuntime.get(req.params.id)));
  router.patch('/:id', mutate((req) => organizationRuntime.update(req.params.id, camel(req.body), context(req))));
  router.get('/:id/units', read((req) => organizationRuntime.listUnits(req.params.id)));
  router.post('/:id/units', mutate((req) => organizationRuntime.createUnit(req.params.id, camel(req.body), context(req)), 201));
  router.patch('/:id/units/:unitId', mutate((req) => organizationRuntime.updateUnit(req.params.id, req.params.unitId, camel(req.body), context(req))));
  router.get('/:id/members', read((req) => organizationRuntime.listMembers(req.params.id)));
  router.post('/:id/members', mutate((req) => organizationRuntime.createMember(req.params.id, camel(req.body), context(req)), 201));
  router.patch('/:id/members/:memberId', mutate((req) => organizationRuntime.updateMember(req.params.id, req.params.memberId, camel(req.body), context(req))));
  router.post('/:id/members/:memberId/roles', mutate((req) => organizationRuntime.assignRole(req.params.id, req.params.memberId, camel(req.body), context(req)), 201));
  router.delete('/:id/roles/:roleId', mutate((req) => organizationRuntime.revokeRole(req.params.id, req.params.roleId, context(req))));
  router.get('/:id/locations', read((req) => organizationRuntime.listLocations(req.params.id)));
  router.post('/:id/locations', mutate((req) => organizationRuntime.createLocation(req.params.id, camel(req.body), context(req)), 201));
  router.patch('/:id/locations/:locationId', mutate((req) => organizationRuntime.updateLocation(req.params.id, req.params.locationId, camel(req.body), context(req))));
  router.get('/:id/machines', read((req) => organizationRuntime.listMachines(req.params.id)));
  router.post('/:id/machines', mutate((req) => organizationRuntime.assignMachine(req.params.id, camel(req.body), context(req)), 201));
  router.delete('/:id/machines/:machineId', mutate((req) => organizationRuntime.unassignMachine(req.params.id, req.params.machineId, context(req))));
  router.get('/:id/responsibilities', read((req) => organizationRuntime.listResponsibilities(req.params.id)));
  router.post('/:id/responsibilities', mutate((req) => organizationRuntime.assignResponsibility(req.params.id, camel(req.body), context(req)), 201));
  router.delete('/:id/responsibilities/:responsibilityId', mutate((req) => organizationRuntime.revokeResponsibility(req.params.id, req.params.responsibilityId, context(req))));
  router.get('/:id/events', read((req) => organizationRuntime.events(req.params.id, camel(req.query), { role: req.securityContext.roles.includes('PLATFORM_OWNER') ? 'PLATFORM_OWNER' : 'ADMIN', organizationId: req.params.id, tenantId: req.params.id })));
  router.get('/:id/metrics', read((req) => organizationRuntime.metrics(req.params.id)));
  return router;
}

function denied() { return new ApiError({ statusCode: 403, code: 'ORGANIZATION_ACCESS_DENIED', message: 'Нет доступа к данным этой организации.', source: 'api' }); }
function camel(value) { if (Array.isArray(value)) return value.map(camel); if (!value || typeof value !== 'object') return value; return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), camel(entry)])); }
module.exports = { createOrganizationRouter };
