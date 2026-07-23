const assert = require('node:assert/strict');
const test = require('node:test');
const { EXPLICITLY_DENIED_OPERATOR_PERMISSIONS, Operator } = require('../src/modules/machine_operations/MachineOperationsEntity');
const { MachineOperationsService } = require('../src/modules/machine_operations/MachineOperationsService');

const now = new Date('2026-07-21T10:00:00.000Z');

function fixture() {
  const repository = new MemoryRepository();
  const audits = [];
  const service = new MachineOperationsService({ repository, auditRepository: { record: async (event) => { audits.push(event); repository.audits.unshift(event); return event; } }, clock: () => now });
  return { repository, audits, service, admin: context('admin_1'), operator: context('operator_1') };
}

test('operator permissions allow operations and deny price, commercial, and loyalty changes', () => {
  const operator = new Operator({ id: 'operator_1', role: 'OPERATOR', status: 'ACTIVE', permissions: [] });
  assert.equal(operator.hasPermission('machine_operations:maintenance:execute'), true);
  for (const denied of EXPLICITLY_DENIED_OPERATOR_PERMISSIONS) assert.equal(operator.hasPermission(denied), false);
  assert.equal(operator.hasPermission('machine_operations:machine_settings:manage'), false);
});

test('operator executes only an assigned task against the configured checklist', async () => {
  const { service, admin, operator } = fixture();
  const checklist = await service.configureChecklist({ code: 'daily_service', name: 'Daily service', version: 1, items: [{ id: 'clean_nozzle', label: 'Clean nozzle' }] }, admin);
  const task = await service.createMaintenanceTask({ machineId: 'machine_1', checklistId: checklist.id, assignedToId: 'operator_1' }, admin);
  const completed = await service.executeMaintenanceTask(task.id, { checklistResults: { clean_nozzle: true }, notes: 'Done' }, operator);
  assert.equal(completed.status, 'COMPLETED');
  await assert.rejects(() => service.executeMaintenanceTask(task.id, { checklistResults: { clean_nozzle: true } }, context('operator_2')), ({ code }) => code === 'OPERATOR_TASK_SCOPE_DENIED');
});

test('test run atomically creates consumption for cups, mix, and toppings', async () => {
  const { service, repository, operator } = fixture();
  const result = await service.performTestRun({ machineId: 'machine_1', status: 'passed', consumptions: [
    { itemType: 'cup', quantity: 1, unit: 'piece' },
    { itemType: 'ice_cream_mix', quantity: 80, unit: 'ml' },
    { itemType: 'topping', itemReference: 'topping_oreo', quantity: 5, unit: 'g' },
  ] }, operator);
  assert.equal(result.inventoryMovements.length, 3);
  assert.deepEqual(new Set(result.inventoryMovements.map(({ itemType }) => itemType)), new Set(['CUP', 'ICE_CREAM_MIX', 'TOPPING']));
  assert.ok(result.inventoryMovements.every(({ testRunId }) => testRunId === result.testRun.id));
  assert.equal(repository.testRuns.length, 1);
  await assert.rejects(() => service.performTestRun({ machineId: 'machine_1', status: 'passed', consumptions: [{ itemType: 'cup', quantity: 1, unit: 'piece' }] }, operator), ({ code }) => code === 'VALIDATION_FAILED');
  assert.equal(repository.testRuns.length, 1);
});

test('admin approves reports, views actions, configures checklists, and manages settings', async () => {
  const { service, repository, admin, operator } = fixture();
  const report = await service.submitServiceReport({ machineId: 'machine_1', summary: 'Preventive service', workPerformed: { cleaned: true } }, operator);
  const approved = await service.approveServiceReport(report.id, { approvalNote: 'Accepted' }, admin);
  assert.equal(approved.status, 'APPROVED');
  const setting = await service.manageMachineSetting('machine_1', 'rinse_interval_seconds', 60, admin);
  assert.equal(setting.value, 60);
  assert.ok((await service.listOperatorActions(50, admin)).length >= 2);
  await assert.rejects(() => service.approveServiceReport(report.id, {}, operator), ({ code }) => code === 'OPERATOR_PERMISSION_DENIED');
  assert.equal(repository.settings.length, 1);
});

test('photo evidence stores immutable storage metadata and one domain reference', async () => {
  const { service, operator } = fixture();
  const photo = await service.attachPhotoEvidence({ testRunId: 'test_run_1', storageKey: 'machine-operations/test-run-1/photo-1.jpg', contentType: 'image/jpeg', checksumSha256: 'a'.repeat(64), capturedAt: now.toISOString() }, operator);
  assert.equal(photo.checksumSha256, 'a'.repeat(64));
  await assert.rejects(() => service.attachPhotoEvidence({ testRunId: 'x', serviceLogId: 'y', storageKey: 'z', contentType: 'image/jpeg', checksumSha256: 'a'.repeat(64), capturedAt: now }, operator), ({ code }) => code === 'VALIDATION_FAILED');
});

function context(actorId) { return { actorId, correlationId: 'corr_test', sourceChannel: 'test', authMethod: 'test', idempotencyKey: 'idem_test' }; }

class MemoryRepository {
  constructor() {
    this.operators = new Map([['admin_1', { id: 'admin_1', role: 'ADMIN', status: 'ACTIVE', permissions: [] }], ['operator_1', { id: 'operator_1', role: 'OPERATOR', status: 'ACTIVE', permissions: [] }], ['operator_2', { id: 'operator_2', role: 'OPERATOR', status: 'ACTIVE', permissions: [] }]]);
    this.machines = new Map([['machine_1', { id: 'machine_1' }]]); this.checklists = []; this.tasks = []; this.testRuns = []; this.movements = []; this.logs = []; this.photos = []; this.settings = []; this.audits = [];
  }
  async findOperatorById(id) { return this.operators.get(id) || null; }
  async createOperator(data) { const row = { id: `operator_${this.operators.size + 1}`, ...data, permissions: [] }; this.operators.set(row.id, row); return row; }
  async findMachine(id) { return this.machines.get(id) || null; }
  async createChecklist(data) { const row = { id: `checklist_${this.checklists.length + 1}`, ...data }; this.checklists.push(row); return row; }
  async findChecklist(id) { return this.checklists.find((row) => row.id === id) || null; }
  async createTask(data) { const row = { id: `task_${this.tasks.length + 1}`, status: 'OPEN', ...data, checklist: await this.findChecklist(data.checklistId) }; this.tasks.push(row); return row; }
  async findTask(id) { return this.tasks.find((row) => row.id === id) || null; }
  async updateTask(id, data) { const row = await this.findTask(id); Object.assign(row, data); return row; }
  async createTestRunWithConsumption({ testRun, movements }) { const created = { id: `test_run_${this.testRuns.length + 1}`, ...testRun }; const inventoryMovements = movements.map((movement, index) => ({ id: `movement_${this.movements.length + index + 1}`, ...movement, testRunId: created.id })); this.testRuns.push(created); this.movements.push(...inventoryMovements); return { testRun: created, inventoryMovements }; }
  async createInventoryMovement(data) { const row = { id: `movement_${this.movements.length + 1}`, ...data }; this.movements.push(row); return row; }
  async createServiceLog(data) { const row = { id: `service_log_${this.logs.length + 1}`, ...data }; this.logs.push(row); return row; }
  async findServiceLog(id) { return this.logs.find((row) => row.id === id) || null; }
  async updateServiceLog(id, data) { const row = await this.findServiceLog(id); Object.assign(row, data); return row; }
  async createPhotoEvidence(data) { const row = { id: `photo_${this.photos.length + 1}`, ...data }; this.photos.push(row); return row; }
  async upsertMachineSetting(machineId, key, value, updatedById) { let row = this.settings.find((item) => item.machineId === machineId && item.key === key); if (!row) { row = { id: `setting_${this.settings.length + 1}`, machineId, key }; this.settings.push(row); } Object.assign(row, { value, updatedById }); return row; }
  async listOperatorActions(limit) { return this.audits.slice(0, limit); }
}
