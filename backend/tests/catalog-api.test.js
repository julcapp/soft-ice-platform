const assert = require('node:assert/strict');
const { test } = require('node:test');
const express = require('express');
const { attachCorrelationId, sendError } = require('../src/platform/http/apiResponse');
const { createCatalogRouter, createAdminCatalogRouter } = require('../src/api/v1/catalogRoutes');

async function serverFor(service) {
  const app = express();
  app.use(express.json()); app.use(attachCorrelationId);
  app.use('/api/v1/catalog', createCatalogRouter({ catalogService: service }));
  app.use('/api/v1/admin/catalog', createAdminCatalogRouter({ catalogService: service, adminAuth: { environment: 'test' } }));
  app.use((error, req, res, next) => sendError(res, req, error));
  return new Promise((resolve) => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
}

test('display reads machine-specific catalog without accepting client prices', async (t) => {
  const service = { getMachineCatalog: async (machineId) => ({ machine: { id: machineId }, currentFlavor: { sku: 'vanilla', basePrice: 175 }, items: [] }) };
  const server = await serverFor(service); t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/catalog/machines/machine-a`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.currentFlavor.basePrice, 175);
});

test('catalog mutation requires admin role and forwards audit context', async (t) => {
  let captured;
  const service = { createItem: async (body, context) => { captured = { body, context }; return { id: 'new', ...body }; }, listAll: async () => [] };
  const server = await serverFor(service); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api/v1/admin/catalog/items`;
  const denied = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Role': 'SERVICE_SPECIALIST' }, body: JSON.stringify({ sku: 'x' }) });
  assert.equal(denied.status, 403);
  const allowed = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Role': 'ADMIN', 'X-Admin-Subject': 'catalog-admin', 'X-Correlation-Id': 'corr-catalog' }, body: JSON.stringify({ sku: 'x' }) });
  assert.equal(allowed.status, 201);
  assert.equal(captured.context.actorId, 'catalog-admin');
  assert.equal(captured.context.correlationId, 'corr-catalog');
});

test('admin catalog exposes machine selector data and bulk price mutation', async (t) => {
  let captured;
  const service = {
    listMachines: async () => [{ id: 'machine-a', machineCode: 'A-01', name: 'Томск' }],
    updatePrices: async (changes, context) => { captured = { changes, context }; return changes; },
  };
  const server = await serverFor(service); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api/v1/admin/catalog`;
  const machines = await fetch(`${base}/machines`, { headers: { 'X-Admin-Role': 'ADMIN' } });
  assert.equal(machines.status, 200);
  assert.equal((await machines.json()).data[0].machineCode, 'A-01');
  const response = await fetch(`${base}/items/prices`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Admin-Role': 'ADMIN', 'X-Admin-Subject': 'catalog-admin' }, body: JSON.stringify({ changes: [{ id: 'ice-a', basePrice: 180, currency: 'RUB' }] }) });
  assert.equal(response.status, 200);
  assert.equal(captured.changes[0].basePrice, 180);
  assert.equal(captured.context.actorId, 'catalog-admin');
});
