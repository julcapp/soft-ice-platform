const assert = require('node:assert/strict');
const http = require('node:http');
const { test } = require('node:test');
const express = require('express');
const { createPromotionAdminRouter } = require('../src/api/v1/promotionRoutes');
const { attachCorrelationId, sendError } = require('../src/platform/http/apiResponse');

function request(server, { method = 'GET', path = '/', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request({ hostname: '127.0.0.1', port: address.port, path, method,
      headers: { ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}), ...headers } }, (res) => {
      let data = ''; res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
    });
    req.on('error', reject); if (payload) req.write(payload); req.end();
  });
}

async function withServer(promotionService, fn) {
  const app = express(); app.use(express.json()); app.use(attachCorrelationId);
  app.use('/api/v1/admin/promotions', createPromotionAdminRouter({ promotionService, adminAuth: { environment: 'test' } }));
  app.use((error, req, res, next) => sendError(res, req, error));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try { await fn(server); } finally { await new Promise((resolve) => server.close(resolve)); }
}

const adminHeaders = (role) => ({ 'X-Admin-Role': role, 'X-Admin-Subject': 'admin-1' });

test('MARKETER can create Promotion Engine DRAFT and server owns createdBy', async () => {
  let captured;
  const promotionService = { createDraft: async (input) => { captured = input; return { id: 'promo-1', status: 'DRAFT', ...input }; } };
  await withServer(promotionService, async (server) => {
    const response = await request(server, { method: 'POST', path: '/api/v1/admin/promotions', headers: adminHeaders('MARKETER'), body: { code: 'HAPPY_HOUR', name: 'Час выгоды', createdBy: 'spoofed', version: { version: 1 } } });
    assert.equal(response.status, 201); assert.equal(captured.createdBy, 'admin-1'); assert.equal(response.body.data.status, 'DRAFT');
  });
});

test('OBSERVER cannot create promotion DRAFT', async () => {
  await withServer({ createDraft: async () => ({}) }, async (server) => {
    const response = await request(server, { method: 'POST', path: '/api/v1/admin/promotions', headers: adminHeaders('OBSERVER'), body: { code: 'X' } });
    assert.equal(response.status, 403); assert.equal(response.body.error.code, 'PROMOTION_PERMISSION_DENIED');
  });
});

test('MARKETER can edit DRAFT', async () => {
  let captured;
  const promotionService = { updateDraft: async (input) => { captured = input; return { id: input.campaignId, name: input.patch.name, status: 'DRAFT' }; } };
  await withServer(promotionService, async (server) => {
    const response = await request(server, { method: 'PATCH', path: '/api/v1/admin/promotions/promo-1', headers: adminHeaders('MARKETER'), body: { name: 'Вечерний час выгоды' } });
    assert.equal(response.status, 200); assert.equal(captured.actorId, 'admin-1'); assert.equal(response.body.data.name, 'Вечерний час выгоды');
  });
});

test('MARKETER cannot create a new campaign version', async () => {
  await withServer({ createVersion: async () => ({}) }, async (server) => {
    const response = await request(server, { method: 'POST', path: '/api/v1/admin/promotions/promo-1/versions', headers: adminHeaders('MARKETER'), body: { benefitValue: 15 } });
    assert.equal(response.status, 403); assert.equal(response.body.error.code, 'PROMOTION_PERMISSION_DENIED');
  });
});

test('MANAGER can create a new campaign version', async () => {
  let captured;
  const promotionService = { createVersion: async (input) => { captured = input; return { id: input.campaignId, status: 'DRAFT', currentVersion: { version: 2, benefitValue: input.version.benefitValue } }; } };
  await withServer(promotionService, async (server) => {
    const response = await request(server, { method: 'POST', path: '/api/v1/admin/promotions/promo-1/versions', headers: adminHeaders('MANAGER'), body: { benefitValue: 15 } });
    assert.equal(response.status, 201); assert.equal(captured.actorId, 'admin-1'); assert.equal(response.body.data.currentVersion.version, 2);
  });
});

test('MANAGER can validate DRAFT', async () => {
  let actorId;
  const promotionService = { validateDraft: async (input) => { actorId = input.actorId; return { campaignId: input.campaignId, status: 'READY', validation: { valid: true } }; } };
  await withServer(promotionService, async (server) => {
    const response = await request(server, { method: 'POST', path: '/api/v1/admin/promotions/promo-1/validate', headers: adminHeaders('MANAGER') });
    assert.equal(response.status, 200); assert.equal(actorId, 'admin-1'); assert.equal(response.body.data.status, 'READY');
  });
});

test('OBSERVER can read promotion campaign', async () => {
  const promotionService = { getCampaign: async (id) => ({ id, code: 'HAPPY_HOUR', status: 'READY' }) };
  await withServer(promotionService, async (server) => {
    const response = await request(server, { path: '/api/v1/admin/promotions/promo-1', headers: adminHeaders('OBSERVER') });
    assert.equal(response.status, 200); assert.equal(response.body.data.id, 'promo-1');
  });
});
