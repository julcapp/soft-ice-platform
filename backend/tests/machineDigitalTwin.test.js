const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { createApp } = require('../src/main');
const {
  ComponentHealthService, FRESHNESS_STATUS, MachineTwinProjectionService,
  MachineTwinRepository, createDemoMachineTwinSources,
} = require('../src/modules/machine_digital_twin');

const now = new Date('2026-07-23T12:00:00.000Z');
const context = { roles: ['ADMIN'], subject_id: 'admin-test' };

function createService(options = {}) {
  const clock = () => now;
  return new MachineTwinProjectionService({
    sources: options.sources || createDemoMachineTwinSources(clock),
    repository: new MachineTwinRepository(), clock,
    dataMode: options.dataMode || 'DEMO',
  });
}

describe('Machine Digital Twin Core v1', () => {
  it('projects the complete read contract without becoming authoritative', async () => {
    const twin = await createService().get('machine_demo_001', context);
    for (const field of ['machineId', 'externalMachineId', 'name', 'model', 'serialNumber', 'location', 'operationalStatus', 'connectivityStatus', 'freshness', 'currentMenu', 'activePrice', 'activeAdvertisingPlacement', 'assignedOperator', 'openServiceTasks', 'activeFaults', 'recentSalesSummary', 'inventorySummary', 'maintenanceSummary', 'recentTestRuns', 'predictionSummary', 'sourceStatus']) assert.ok(field in twin);
    assert.equal(twin.dataMode, 'DEMO');
    assert.equal(twin.freshness.status, FRESHNESS_STATUS.DEMO);
    assert.ok(Object.values(twin.sourceStatus).every((source) => source.authoritative === false));
    assert.ok(Object.isFrozen(twin));
  });

  it('calculates deterministic explainable health scores', () => {
    const health = new ComponentHealthService().calculate({ activeCriticalFault: true, staleTelemetry: true });
    assert.equal(health.score, 25);
    assert.equal(health.status, 'CRITICAL');
    assert.deepEqual(health.factors.map(({ code }) => code), ['ACTIVE_CRITICAL_FAULT', 'STALE_TELEMETRY']);
  });

  it('reports stale and unavailable live source states explicitly', async () => {
    const identity = { status: 'AVAILABLE', listMachines: async () => [], getMachine: async () => ({ id: 'm1', name: 'M1', status: 'ONLINE' }) };
    const stale = createService({ dataMode: 'LIVE', sources: { machineIdentity: identity, telemetry: { getTelemetry: async () => ({ observedAt: '2026-07-23T11:50:00.000Z' }) } } });
    assert.equal((await stale.get('m1', context)).freshness.status, 'STALE');
    const unavailable = createService({ dataMode: 'LIVE', sources: { machineIdentity: identity } });
    const twin = await unavailable.get('m1', context);
    assert.equal(twin.freshness.status, 'UNAVAILABLE');
    assert.equal(twin.sourceStatus.payments.status, 'FOUNDATION_ONLY');
  });

  it('captures immutable versioned events and snapshots', async () => {
    const service = createService();
    await service.get('machine_demo_001', context);
    const events = await service.events('machine_demo_001', context);
    const snapshots = await service.snapshots('machine_demo_001', context);
    assert.equal(events[0].eventType, 'TWIN_SNAPSHOT_CREATED');
    assert.equal(events[0].eventVersion, 1);
    assert.ok(Object.isFrozen(events[0]));
    assert.ok(Object.isFrozen(snapshots[0]));
  });

  it('allows only ADMIN and PLATFORM_OWNER in the service', async () => {
    await assert.rejects(() => createService().list({ roles: ['OPERATOR'] }), ({ statusCode, code }) => statusCode === 403 && code === 'MACHINE_TWIN_READ_FORBIDDEN');
    await assert.doesNotReject(() => createService().list({ roles: ['PLATFORM_OWNER'] }));
  });

  it('exposes only read-only HTTP endpoints with demo labels', async () => {
    const dependencies = {
      machineTwinService: createService(),
      adminAuth: { environment: 'development' },
      featureFlags: {},
    };
    const app = createApp({ dependencies });
    const server = app.listen(0);
    const base = `http://127.0.0.1:${server.address().port}/api/v1/admin/machine-twins`;
    try {
      const headers = { 'X-Admin-Role': 'ADMIN' };
      for (const path of ['', '/machine_demo_001', '/machine_demo_001/components', '/machine_demo_001/events', '/machine_demo_001/snapshots', '/machine_demo_001/health']) {
        const response = await fetch(`${base}${path}`, { headers });
        assert.equal(response.status, 200, path);
        const body = await response.json();
        assert.equal(body.meta.access, 'READ_ONLY');
      }
      const list = await (await fetch(base, { headers })).json();
      assert.equal(list.data[0].dataMode, 'DEMO');
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        assert.equal((await fetch(base, { method, headers })).status, 404);
      }
      assert.equal((await fetch(base, { headers: { 'X-Admin-Role': 'OPERATOR' } })).status, 403);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('rejects development admin identity headers in production', async () => {
    const app = createApp({ dependencies: { machineTwinService: createService(), adminAuth: { environment: 'production' }, featureFlags: {} } });
    const server = app.listen(0);
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/admin/machine-twins`, { headers: { 'X-Admin-Role': 'ADMIN' } });
      assert.equal(response.status, 401);
    } finally { await new Promise((resolve) => server.close(resolve)); }
  });
});
