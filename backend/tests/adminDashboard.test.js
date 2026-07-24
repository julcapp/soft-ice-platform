const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createApp } = require('../src/main');
const { AdminDashboardService, DemoAdminDashboardProvider } = require('../src/modules/admin_dashboard');
const fixedNow = new Date('2026-07-23T08:00:00.000Z');
function dependencies(overrides = {}) {
  return {
    adminDashboardService: new AdminDashboardService({ provider: new DemoAdminDashboardProvider({ clock: () => fixedNow }) }),
    ...overrides,
  };
}
async function withServer(run, overrides) {
  const server = createApp({ dependencies: dependencies(overrides) }).listen(0);
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}
test('dashboard requires administrator authentication', async () => withServer(async (baseUrl) => {
  assert.equal((await fetch(`${baseUrl}/api/v1/admin/dashboard`)).status, 401);
}));
test('dashboard denies roles outside the administrative allow-list', async () => withServer(async (baseUrl) => {
  assert.equal((await fetch(`${baseUrl}/api/v1/admin/dashboard`, { headers: { 'X-Admin-Role': 'REGIONAL_MANAGER' } })).status, 403);
}));
test('production rejects the development administrator header adapter', async () => withServer(async (baseUrl) => {
  assert.equal((await fetch(`${baseUrl}/api/v1/admin/dashboard`, { headers: { 'X-Admin-Role': 'ADMIN' } })).status, 401);
}, { adminAuth: { environment: 'production' } }));
test('dashboard response is read-only, contract-complete, and demo-labelled', async () => withServer(async (baseUrl) => {
  const response = await fetch(`${baseUrl}/api/v1/admin/dashboard`, { headers: { 'X-Admin-Role': 'ADMIN' } });
  assert.equal(response.status, 200);
  const body = await response.json();
  for (const key of ['generatedAt', 'freshness', 'permissionScope', 'summary', 'machineStatus', 'inventoryAlerts', 'operatorSummary', 'maintenanceSummary', 'paymentSummary', 'recentEvents']) assert.ok(Object.hasOwn(body, key), key);
  assert.equal(body.freshness.isDemo, true);
  assert.equal(body.freshness.source, 'DEMO_READ_MODEL');
  assert.equal(body.permissionScope.access, 'READ_ONLY');
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal((await fetch(`${baseUrl}/api/v1/admin/dashboard`, { method, headers: { 'X-Admin-Role': 'ADMIN' } })).status, 404);
  }
}));
