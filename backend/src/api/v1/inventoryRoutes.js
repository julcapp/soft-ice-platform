const express = require('express');
const crypto = require('crypto');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');

function createInventoryRouter({ inventoryRuntime }) {
  const router = express.Router();
  router.use(createAdminAuthenticator());
  router.get('/items', route(async () => inventoryRuntime.listItems()));
  router.get('/locations', route(async () => inventoryRuntime.listLocations()));
  router.get('/balances', route(async (req) => inventoryRuntime.listBalances(camel(req.query))));
  router.get('/movements', route(async (req) => inventoryRuntime.listMovements(camel(req.query))));
  router.get('/reservations', route(async (req) => inventoryRuntime.listReservations(camel(req.query))));
  router.post('/items', route(async (req) => inventoryRuntime.createItem(camel(req.body), context(req)), 201));
  router.post('/locations', route(async (req) => inventoryRuntime.createLocation(camel(req.body), context(req)), 201));
  router.post('/movements', route(async (req) => inventoryRuntime.recordMovement(camel(req.body), context(req)), 201));
  router.post('/reservations', route(async (req) => inventoryRuntime.reserve(camel(req.body), context(req)), 201));
  router.post('/reservations/:reservationId/consume', route(async (req) => inventoryRuntime.consumeReservation(req.params.reservationId, camel(req.body), context(req))));
  router.post('/reservations/:reservationId/release', route(async (req) => inventoryRuntime.releaseReservation(req.params.reservationId, camel(req.body), context(req))));
  return router;
}
function route(handler, status = 200) { return (req, res, next) => Promise.resolve(handler(req)).then((data) => res.status(data?.idempotentReplay ? 200 : status).json({ data, meta: { api_version: 'v1', correlation_id: req.correlationId, idempotent_replay: Boolean(data?.idempotentReplay) } })).catch(next); }
function context(req) { return { actorType: 'ADMINISTRATOR', actorId: req.securityContext.subject_id, sourceChannel: 'ADMIN_API', correlationId: req.correlationId || `corr_${crypto.randomUUID()}`, idempotencyKey: req.get('Idempotency-Key') }; }
function camel(value) { if (Array.isArray(value)) return value.map(camel); if (!value || typeof value !== 'object') return value; return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), camel(entry)])); }
module.exports = { createInventoryRouter };
