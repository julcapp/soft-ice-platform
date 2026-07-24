const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { EventBus, EventHandlerRegistry, InMemoryEventStore, InMemoryOutbox, InMemoryDeadLetterStore } = require('../src/platform/events');
const { MaintenanceRuntime, MaintenanceService, InMemoryMaintenanceRepository, MaintenanceProjection } = require('../src/modules/maintenance');

function fixture() {
  const repository = new InMemoryMaintenanceRepository(), projection = new MaintenanceProjection({ clock: () => new Date('2026-07-24T12:30:00Z') });
  repository.registerMachine({ machineId: 'machine_1', machineCode: 'SI-TOM-001', qrCode: 'softice:machine:machine_1:SI-TOM-001' });
  repository.registerMachine({ machineId: 'machine_2', machineCode: 'SI-TOM-002', qrCode: 'softice:machine:machine_2:SI-TOM-002' });
  const registry = new EventHandlerRegistry(); registry.register('*', projection.subscriber());
  const bus = new EventBus({ registry, eventStore: new InMemoryEventStore(), outbox: new InMemoryOutbox(), deadLetterStore: new InMemoryDeadLetterStore() });
  const inventoryCalls = [], runtimeCalls = [];
  const service = new MaintenanceService({
    repository, projection, eventPublisher: bus,
    inventoryRuntime: { recordMovement: async (request, context) => { inventoryCalls.push({ request, context }); return { movement: { id: 'inventory_movement_1' } }; } },
    machineRuntimeService: {
      startSession: async (request) => { runtimeCalls.push(['start', request]); return { sessionId: `mrs_${request.machineId}` }; },
      completeSession: async (id) => { runtimeCalls.push(['complete', id]); },
    },
    clock: () => new Date('2026-07-24T12:00:00Z'),
  });
  return { runtime: new MaintenanceRuntime({ service }), repository, projection, inventoryCalls, runtimeCalls };
}
const ctx = (actorId, roles, key) => ({ actorId, roles, idempotencyKey: key, correlationId: `corr_${key}`, sourceChannel: 'TEST' });

describe('Maintenance Runtime v1', () => {
  it('runs preventive maintenance with QR identity, checklist, evidence, inventory, test dispensing, and approval', async () => {
    const f = fixture(), admin = ctx('admin_1', ['ADMIN'], 'plan'), operator = (key) => ctx('operator_1', ['OPERATOR'], key);
    const plan = await f.runtime.createPlan({ code: 'monthly_service', name: 'Monthly service', type: 'PREVENTIVE', version: 1, machineIds: ['machine_1','machine_2'], checklist: [{ id: 'sanitize_nozzle', label: 'Sanitize nozzle' }], requiredPhotoCount: 1, requireTestDispense: true }, admin);
    const identified = f.runtime.identifyMachine({ qrCode: 'softice:machine:machine_1:SI-TOM-001' }, operator('identify'));
    assert.equal(identified.machineId, 'machine_1');
    const session = await f.runtime.openSession({ qrCode: identified.qrCode, planId: plan.id }, operator('open'));
    await f.runtime.completeChecklistItem(session.id, 'sanitize_nozzle', { status: 'PASSED' }, operator('check'));
    await f.runtime.attachPhoto(session.id, { storageKey: 'maintenance/m1/photo.jpg', checksumSha256: 'a'.repeat(64), contentType: 'image/jpeg', capturedAt: '2026-07-24T11:59:00Z' }, operator('photo'));
    await f.runtime.replaceConsumable(session.id, { itemId: 'service_filter', locationId: 'machine_1_stock', quantity: 1, reason: 'scheduled_replacement' }, operator('replace'));
    await f.runtime.recordTestDispense(session.id, { status: 'PASSED', dispenseReference: 'test_dispense_1' }, operator('test'));
    const submitted = await f.runtime.submit(session.id, { summary: 'Preventive service completed' }, operator('submit'));
    assert.equal(submitted.status, 'SUBMITTED');
    const approved = await f.runtime.approve(session.id, { approvalNote: 'Evidence accepted' }, ctx('admin_1', ['ADMIN'], 'approve'));
    assert.equal(approved.status, 'APPROVED');
    assert.equal(f.inventoryCalls[0].request.movementType, 'MAINTENANCE');
    assert.deepEqual(f.runtimeCalls.map((x) => x[0]), ['start','complete']);
    assert.ok(f.repository.listAudit(session.id).length >= 7);
    assert.equal(f.projection.kpis().approvedSessions, 1);
  });

  it('supports corrective multi-machine sessions and enforces actor scope and approvals', async () => {
    const f = fixture();
    const first = await f.runtime.openSession({ qrCode: 'softice:machine:machine_1:SI-TOM-001', type: 'CORRECTIVE', issue: 'Pump fault', checklist: [{ id: 'inspect_pump', label: 'Inspect pump' }], requireTestDispense: false }, ctx('op_1', ['OPERATOR'], 'm1'));
    const second = await f.runtime.openSession({ qrCode: 'softice:machine:machine_2:SI-TOM-002', type: 'CORRECTIVE', issue: 'Door sensor', checklist: [{ id: 'inspect_door', label: 'Inspect door' }], requireTestDispense: false }, ctx('op_2', ['OPERATOR'], 'm2'));
    assert.notEqual(first.machineId, second.machineId);
    await assert.rejects(() => f.runtime.completeChecklistItem(first.id, 'inspect_pump', { status: 'PASSED' }, ctx('op_2', ['OPERATOR'], 'wrong')), ({ code }) => code === 'MAINTENANCE_SESSION_SCOPE_DENIED');
    await assert.rejects(() => f.runtime.approve(first.id, {}, ctx('op_1', ['OPERATOR'], 'no-admin')), ({ code }) => code === 'MAINTENANCE_PERMISSION_DENIED');
  });

  it('deduplicates commands and rejects semantic idempotency-key reuse', async () => {
    const f = fixture(), context = ctx('op_1', ['OPERATOR'], 'same');
    const request = { qrCode: 'softice:machine:machine_1:SI-TOM-001', type: 'CORRECTIVE', checklist: [{ id: 'inspect', label: 'Inspect' }], requireTestDispense: false };
    const first = await f.runtime.openSession(request, context), replay = await f.runtime.openSession(request, context);
    assert.equal(first.id, replay.id);
    await assert.rejects(() => f.runtime.openSession({ ...request, issue: 'different' }, context), ({ code }) => code === 'MAINTENANCE_IDEMPOTENCY_CONFLICT');
  });
});
