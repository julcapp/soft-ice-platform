const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createCRMRouter } = require('../src/api/v1/crmRoutes');

async function requestWithRole(role, route) {
  const calls = [];
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.securityContext = {
      subject_id: 'test-admin',
      roles: role === 'development' ? ['PLATFORM_OWNER'] : [role],
      auth_method: role === 'development' ? 'development_header' : 'session',
    };
    next();
  });
  const runtime = {
    adjustBonus: async () => { calls.push('adjustBonus'); return {ok: true}; },
    eraseAndReleaseCustomer: async () => { calls.push('eraseAndRelease'); return {ok: true}; },
  };
  app.use(createCRMRouter({crmRuntime: runtime}));
  app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ code: err.code }));
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const port = server.address().port;
    const response = await fetch('http://127.0.0.1:' + port + route, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}',
    });
    return { status: response.status, calls };
  } finally { await new Promise(resolve => server.close(resolve)); }
}
for (const route of ['/customers/c1/bonus-adjustments', '/customers/c1/erase-and-release']) {
  test('non-owner forbidden: '+route, async () => {
    const result = await requestWithRole('ORG_ADMIN', route);
    assert.equal(result.status, 403);
    assert.equal(result.calls.length, 0);
  });
  test('development header forbidden: '+route, async () => {
    const result = await requestWithRole('development', route);
    assert.equal(result.status, 403);
    assert.equal(result.calls.length, 0);
  });
  test('owner allowed: '+route, async () => {
    const result = await requestWithRole('PLATFORM_OWNER', route);
    assert.equal(result.status, route.includes('bonus-adjustments') ? 201 : 200);
    assert.equal(result.calls.length, 1);
  });
}
