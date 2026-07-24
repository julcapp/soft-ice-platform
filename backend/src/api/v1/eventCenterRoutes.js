const express = require('express');

function context(req) {
  return {
    role: req.headers['x-admin-role'] || 'ADMIN', actorId: req.headers['x-admin-subject'] || 'admin',
    tenantId: req.headers['x-tenant-id'] || 'default', correlationId: req.correlationId,
    permissions: String(req.headers['x-admin-permissions'] || '').split(',').filter(Boolean),
    machineIds: String(req.headers['x-machine-ids'] || '').split(',').filter(Boolean),
  };
}
function filters(query) {
  const boolean = (value) => value === undefined ? undefined : value === 'true';
  return { ...query, limit: query.limit && Number(query.limit), acknowledgementRequired: boolean(query.acknowledgementRequired), acknowledged: boolean(query.acknowledged) };
}
function asyncRoute(handler) { return (req, res, next) => Promise.resolve(handler(req, res)).catch(next); }

function createEventCenterRouter({ eventCenterRuntime }) {
  const router = express.Router(); const service = eventCenterRuntime.service; const repository = service.repository;
  router.get('/events/statistics', (req, res) => res.json({ data: eventCenterRuntime.statistics(filters(req.query), context(req)) }));
  router.get('/events/correlation/:correlationId', (req, res) => res.json({ data: eventCenterRuntime.correlation(req.params.correlationId, context(req)) }));
  router.get('/events', (req, res) => res.json({ data: eventCenterRuntime.list(filters(req.query), context(req)) }));
  router.post('/events/export', (req, res) => res.json({ data: service.export(req.body?.filters || {}, req.body?.format || 'JSON', context(req)) }));
  router.get('/events/:eventId/relations', (req, res) => res.json({ data: repository.relations.filter((item) => item.eventRecordId === req.params.eventId) }));
  router.get('/events/:eventId/evidence', (req, res) => res.json({ data: repository.evidence.filter((item) => item.eventRecordId === req.params.eventId) }));
  router.get('/events/:eventId/comments', (req, res) => res.json({ data: repository.comments.filter((item) => item.eventRecordId === req.params.eventId && !item.deletedAt) }));
  router.post('/events/:eventId/acknowledge', asyncRoute(async (req, res) => res.status(201).json({ data: await service.acknowledge(req.params.eventId, req.body || {}, context(req)) })));
  router.post('/events/:eventId/comments', (req, res) => res.status(201).json({ data: service.addComment(req.params.eventId, req.body?.body, context(req)) }));
  router.delete('/events/:eventId/comments/:commentId', (req, res) => res.json({ data: repository.deleteComment(req.params.eventId, req.params.commentId) }));
  router.patch('/events/:eventId/processing-state', (req, res) => res.json({ data: service.setState(req.params.eventId, req.body?.status, context(req)) }));
  router.post('/events/:eventId/tags', (req, res) => res.status(201).json({ data: service.addTag(req.params.eventId, req.body?.tag, context(req)) }));
  router.delete('/events/:eventId/tags/:tag', (req, res) => res.json({ data: { removed: repository.removeTag(req.params.eventId, req.params.tag) } }));
  router.post('/events/:eventId/legal-hold', asyncRoute(async (req, res) => res.json({ data: await service.setLegalHold(req.params.eventId, true, req.body?.reason, context(req)) })));
  router.delete('/events/:eventId/legal-hold', asyncRoute(async (req, res) => res.json({ data: await service.setLegalHold(req.params.eventId, false, req.body?.reason, context(req)) })));
  router.get('/events/:eventId', (req, res) => { const data = eventCenterRuntime.get(req.params.eventId, context(req)); if (!data) return res.status(404).json({ error: { code: 'EVENT_NOT_FOUND', message: 'Событие не найдено.' } }); return res.json({ data }); });
  router.get('/event-types', (req, res) => res.json({ data: service.registry.list() }));
  router.get('/machines/:machineId/events', (req, res) => res.json({ data: eventCenterRuntime.list({ ...filters(req.query), machineId: req.params.machineId }, context(req)) }));
  router.get('/customers/:customerId/events', (req, res) => res.json({ data: eventCenterRuntime.list({ ...filters(req.query), customerId: req.params.customerId }, context(req)) }));
  router.get('/organizations/:organizationId/events', (req, res) => res.json({ data: eventCenterRuntime.list({ ...filters(req.query), organizationId: req.params.organizationId }, context(req)) }));
  router.get('/video-incidents/:incidentId/events', (req, res) => res.json({ data: eventCenterRuntime.list({ ...filters(req.query), videoIncidentId: req.params.incidentId }, context(req)) }));
  router.post('/internal/events', asyncRoute(async (req, res) => res.status(201).json({ data: await eventCenterRuntime.ingest(req.body) })));
  router.get('/event-center/health', (req, res) => res.json({ data: service.health() }));
  return router;
}
module.exports = { createEventCenterRouter };
