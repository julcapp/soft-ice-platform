const express = require('express');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');
const { ApiError } = require('../../platform/errors/ApiError');
function createPlatformEventRouter({ platformEventStore, platformEventBus, deadLetterStore, adminAuth } = {}) {
  const router = express.Router(); router.use(createAdminAuthenticator(adminAuth), (req, res, next) => {
    if ((req.securityContext?.roles || []).some((role) => ['ADMIN','PLATFORM_OWNER'].includes(role))) return next();
    next(new ApiError({ statusCode: 403, code: 'PLATFORM_EVENTS_READ_FORBIDDEN', message: 'Platform Event access requires ADMIN or PLATFORM_OWNER.', source: 'api' }));
  });
  router.get('/dead-letter', (req, res) => res.json({ data: deadLetterStore.list(), meta: meta() }));
  router.get('/', (req, res) => res.json({ data: platformEventStore.list({ eventType: req.query.eventType, aggregateId: req.query.aggregateId }).map((event) => {
    const deliveries = platformEventBus.listDeliveries(event.eventId);
    return { ...event, deliveryStatus: summarize(deliveries), subscriberFailures: deliveries.filter(({ status }) => ['FAILED','DEAD_LETTERED'].includes(status)), deliveries };
  }), meta: meta() }));
  router.get('/:eventId', (req, res, next) => {
    const event = platformEventStore.findById(req.params.eventId);
    if (!event) return next(new ApiError({ statusCode: 404, code: 'PLATFORM_EVENT_NOT_FOUND', message: 'Platform event was not found.', source: 'api' }));
    res.json({ data: { ...event, deliveries: platformEventBus.listDeliveries(event.eventId) }, meta: meta() });
  });
  return router;
}
function meta() { return { access: 'READ_ONLY', apiVersion: 'v1', delivery: 'SYNCHRONOUS_IN_PROCESS', durability: 'IN_MEMORY_FOUNDATION' }; }
function summarize(deliveries) {
  if (deliveries.some(({ status }) => status === 'DEAD_LETTERED')) return 'DEAD_LETTERED';
  if (deliveries.some(({ status }) => status === 'FAILED')) return 'FAILED';
  if (deliveries.length && deliveries.every(({ status }) => ['DELIVERED','DUPLICATE_SKIPPED'].includes(status))) return 'DELIVERED';
  return deliveries.length ? 'PENDING' : 'NO_SUBSCRIBERS';
}
module.exports = { createPlatformEventRouter };
