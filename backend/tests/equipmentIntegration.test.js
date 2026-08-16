const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const { EquipmentIntegrationService } = require('../src/modules/equipment_integration/EquipmentIntegrationService');
const { createEquipmentV1Router, createEquipmentAdminRouter } = require('../src/api/equipmentV1Routes');

function fixedClock() { return new Date('2026-08-16T10:00:00.000Z'); }

test('equipment sandbox records heartbeat and telemetry for dashboard', () => {
  const service = new EquipmentIntegrationService({ clock: fixedClock });
  service.heartbeat('TEST-MACHINE-001', { machine_id: 'TEST-MACHINE-001', status: 'READY', online: true, controller_version: '3.4.2' });
  service.recordTelemetry('TEST-MACHINE-001', {
    machine_id: 'TEST-MACHINE-001',
    telemetry: { temperature_c: -4.1, cups_remaining: 87, mix_level_percent: 62 },
  });
  const dashboard = service.dashboardSnapshot('TEST-MACHINE-001');
  assert.equal(dashboard.machine.online, true);
  assert.equal(dashboard.machine.status, 'READY');
  assert.equal(dashboard.telemetry.values.cups_remaining, 87);
  assert.equal(dashboard.data_mode, 'SANDBOX');
});

test('dispense lifecycle is correlated and completion is idempotent', () => {
  const service = new EquipmentIntegrationService({ clock: fixedClock });
  const command = service.enqueueDispense('TEST-MACHINE-001', { command_id: 'cmd_test_1', payload: { product_code: 'ICE_CREAM_BASE' } });
  assert.equal(command.state, 'PENDING');
  assert.equal(service.pendingCommands('TEST-MACHINE-001').length, 1);
  assert.equal(service.acknowledgeCommand('TEST-MACHINE-001', 'cmd_test_1').state, 'ACKNOWLEDGED');
  const result = service.recordDispenseResult('TEST-MACHINE-001', { machine_id: 'TEST-MACHINE-001', command_id: 'cmd_test_1', status: 'SUCCESS' });
  assert.equal(result.status, 'SUCCESS');
  assert.deepEqual(service.recordDispenseResult('TEST-MACHINE-001', { machine_id: 'TEST-MACHINE-001', command_id: 'cmd_test_1', status: 'SUCCESS' }), result);
  assert.equal(service.pendingCommands('TEST-MACHINE-001').length, 0);
  assert.equal(service.dashboardSnapshot('TEST-MACHINE-001').counters.technical_success_rate_percent, 100);
});

test('conflicting repeated dispense result is rejected', () => {
  const service = new EquipmentIntegrationService({ clock: fixedClock });
  service.enqueueDispense('TEST-MACHINE-001', { command_id: 'cmd_test_2' });
  service.recordDispenseResult('TEST-MACHINE-001', { command_id: 'cmd_test_2', status: 'SUCCESS' });
  assert.throws(() => service.recordDispenseResult('TEST-MACHINE-001', { command_id: 'cmd_test_2', status: 'FAILED', error_code: 'NO_CUP' }), { code: 'EQUIPMENT_COMMAND_RESULT_CONFLICT' });
});

test('external equipment routes require sandbox key and admin controls require admin auth', async (t) => {
  const service = new EquipmentIntegrationService({ clock: fixedClock });
  const app = express();
  app.use(express.json());
  app.use('/equipment/v1', createEquipmentV1Router({ equipmentIntegrationService: service }, { config: { equipmentIntegration: { enabled: true, apiKey: 'sandbox-secret' } } }));
  app.use('/api/v1/admin/equipment', createEquipmentAdminRouter({ equipmentIntegrationService: service }, { environment: 'test' }));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ error: { code: error.code, message: error.message } }));
  const server = await new Promise((resolve) => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  assert.equal((await fetch(`${base}/equipment/v1/health`)).status, 200);
  assert.equal((await fetch(`${base}/equipment/v1/machines/TEST-MACHINE-001/commands`)).status, 401);
  assert.equal((await fetch(`${base}/api/v1/admin/equipment/machines/TEST-MACHINE-001`)).status, 401);

  const admin = await fetch(`${base}/api/v1/admin/equipment/machines/TEST-MACHINE-001/test-dispense`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Role': 'PLATFORM_OWNER', 'X-Admin-Subject': 'equipment-test' },
    body: JSON.stringify({ command_id: 'cmd_http_1', payload: { topping_code: 'CHOCOLATE' } }),
  });
  assert.equal(admin.status, 201);

  const supplier = await fetch(`${base}/equipment/v1/machines/TEST-MACHINE-001/commands`, { headers: { 'X-API-Key': 'sandbox-secret' } });
  assert.equal(supplier.status, 200);
  assert.equal((await supplier.json()).data[0].command_id, 'cmd_http_1');
});
