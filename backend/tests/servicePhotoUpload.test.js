const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const sharp = require('sharp');
const { normalizeImage, ServiceVisitService } = require('../src/modules/operator_workspace/ServiceVisitService');

test('master cannot use technician diagnostics even with a machine assignment', async () => {
  const service = new ServiceVisitService({ prisma: {} });
  await assert.rejects(service.diagnostics('assigned-machine', { roles: ['MACHINE_RESPONSIBLE'] }), { statusCode: 403, code: 'SERVICE_DIAGNOSTICS_DENIED' });
});
const { ServiceAccessPolicy } = require('../src/modules/operator_workspace/ServiceAccessPolicy');
const { createServiceWorkspaceRouter } = require('../src/api/v1/serviceWorkspaceRoutes');

test('service photo decoder rejects non-images and normalizes real PNG to JPEG', async () => {
  await assert.rejects(normalizeImage(Buffer.from('not a photo')), { code: 'SERVICE_PHOTO_INVALID' });
  const png = await sharp({ create: { width: 12, height: 9, channels: 3, background: 'white' } }).png().toBuffer();
  const metadata = await sharp(await normalizeImage(png)).metadata();
  assert.equal(metadata.format, 'jpeg');
  assert.equal(metadata.width, 12);
  assert.equal(metadata.height, 9);
});

test('staff access requires membership and a current machine assignment', async () => {
  const policy = new ServiceAccessPolicy({ prisma: { $queryRawUnsafe: async () => [] } });
  await assert.rejects(policy.machines({}), { statusCode: 401 });
  await assert.rejects(policy.machines({ subject_type: 'administrator', subject_id: 'user', roles: ['SERVICE_SPECIALIST'] }), { statusCode: 403 });
  await assert.rejects(policy.requireMachine('other-machine', { subject_type: 'administrator', subject_id: 'user', roles: ['SERVICE_SPECIALIST'], organization_member_id: 'member' }), { statusCode: 403 });
});

test('photo upload requires password session and passes actual image bytes to service', async () => {
  let authenticated = false;
  let received;
  const app = express();
  app.use((req, _res, next) => { if (authenticated) req.securityContext = { subject_type: 'administrator', auth_method: 'password' }; next(); });
  app.use(createServiceWorkspaceRouter({ serviceVisitService: { addPhoto: async (_id, photo) => { received = photo; return {}; } } }));
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ code: error.code }));
  const server = app.listen(0);
  const url = `http://127.0.0.1:${server.address().port}/visits/test/photos?stage=BEFORE`;
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  try {
    assert.equal((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'image/jpeg', 'X-Operator-Role': 'ADMIN' }, body: bytes })).status, 401);
    authenticated = true;
    assert.equal((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: bytes })).status, 201);
    assert.deepEqual(received.buffer, bytes);
    assert.equal(received.stage, 'BEFORE');
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
});
