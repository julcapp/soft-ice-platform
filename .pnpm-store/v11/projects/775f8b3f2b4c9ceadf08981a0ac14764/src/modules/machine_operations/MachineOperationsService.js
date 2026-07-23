const { ApiError } = require('../../platform/errors/ApiError');
const { INVENTORY_ITEM_TYPE, OPERATOR_ROLE, Operator, PERMISSION, REQUIRED_TEST_RUN_ITEMS } = require('./MachineOperationsEntity');

class MachineOperationsService {
  constructor({ repository, auditRepository, clock = () => new Date() }) {
    this.repository = repository; this.auditRepository = auditRepository; this.clock = clock;
  }

  async createOperator(request, context = {}) {
    await this.authorize(context.actorId, PERMISSION.MANAGE_MACHINE_SETTINGS);
    const displayName = requiredText(request.displayName, 'display_name');
    const role = normalizeEnum(request.role || OPERATOR_ROLE.OPERATOR, Object.values(OPERATOR_ROLE), 'role');
    const operator = await this.repository.createOperator({ displayName, externalSubject: optionalText(request.externalSubject), role, status: 'ACTIVE' });
    await this.audit('MachineOperations.OperatorCreated', operator.id, 'create_operator', context, { role });
    return operator;
  }

  async configureChecklist(request, context = {}) {
    await this.authorize(context.actorId, PERMISSION.CONFIGURE_CHECKLIST);
    const items = validateChecklistItems(request.items);
    const checklist = await this.repository.createChecklist({ code: requiredCode(request.code, 'code'), name: requiredText(request.name, 'name'), version: positiveInteger(request.version, 'version'), items, active: request.active !== false, configuredById: context.actorId });
    await this.audit('MachineOperations.ChecklistConfigured', checklist.id, 'configure_checklist', context, { code: checklist.code, version: checklist.version });
    return checklist;
  }

  async createMaintenanceTask(request, context = {}) {
    await this.authorize(context.actorId, PERMISSION.CONFIGURE_CHECKLIST);
    await this.requireMachine(request.machineId); await this.requireChecklist(request.checklistId);
    const assignee = await this.requireOperator(request.assignedToId);
    if (assignee.status !== 'ACTIVE') throw conflict('OPERATOR_INACTIVE', 'Maintenance tasks require an active operator.');
    const task = await this.repository.createTask({ machineId: request.machineId, checklistId: request.checklistId, assignedToId: request.assignedToId, dueAt: optionalDate(request.dueAt, 'due_at') });
    await this.audit('MachineOperations.MaintenanceTaskCreated', task.id, 'create_task', context, { machine_id: task.machineId, assigned_to_id: task.assignedToId });
    return task;
  }

  async executeMaintenanceTask(taskId, request, context = {}) {
    await this.authorize(context.actorId, PERMISSION.EXECUTE_MAINTENANCE);
    const task = await this.requireTask(taskId);
    if (task.assignedToId !== context.actorId) throw forbidden('OPERATOR_TASK_SCOPE_DENIED');
    if (['COMPLETED', 'CANCELLED'].includes(task.status)) throw conflict('MAINTENANCE_TASK_TERMINAL', 'Maintenance task is already terminal.');
    const results = validateChecklistResults(task.checklist.items, request.checklistResults);
    const completedAt = this.clock();
    const updated = await this.repository.updateTask(taskId, { status: 'COMPLETED', checklistResults: results, notes: optionalText(request.notes), startedAt: task.startedAt || completedAt, completedAt, completedById: context.actorId });
    await this.audit('MachineOperations.MaintenanceTaskCompleted', taskId, 'execute_maintenance', context, { machine_id: task.machineId });
    return updated;
  }

  async performTestRun(request, context = {}) {
    await this.authorize(context.actorId, PERMISSION.PERFORM_TEST_RUN);
    await this.authorize(context.actorId, PERMISSION.RECORD_CONSUMPTION);
    await this.requireMachine(request.machineId);
    const consumptions = normalizeTestConsumptions(request.consumptions);
    const performedAt = this.clock();
    const result = await this.repository.createTestRunWithConsumption({
      testRun: { machineId: request.machineId, operatorId: context.actorId, status: normalizeEnum(request.status, ['PASSED', 'FAILED'], 'status'), notes: optionalText(request.notes), results: request.results || undefined, performedAt },
      movements: consumptions.map((item, index) => ({ machineId: request.machineId, operatorId: context.actorId, movementType: 'CONSUMPTION', itemType: item.itemType, itemReference: item.itemReference, quantity: item.quantity, unit: item.unit, reason: 'machine_test_run', idempotencyKey: context.idempotencyKey ? `${context.idempotencyKey}:${index}` : null, occurredAt: performedAt })),
    });
    await this.audit('MachineOperations.TestRunPerformed', result.testRun.id, 'perform_test_run', context, { machine_id: request.machineId, inventory_movement_ids: result.inventoryMovements.map(({ id }) => id) });
    return result;
  }

  async recordConsumption(request, context = {}) {
    await this.authorize(context.actorId, PERMISSION.RECORD_CONSUMPTION); await this.requireMachine(request.machineId);
    const movement = await this.repository.createInventoryMovement({ machineId: request.machineId, operatorId: context.actorId, movementType: 'CONSUMPTION', itemType: normalizeEnum(request.itemType, Object.values(INVENTORY_ITEM_TYPE), 'item_type'), itemReference: optionalText(request.itemReference), quantity: positiveNumber(request.quantity, 'quantity'), unit: requiredText(request.unit, 'unit'), reason: requiredText(request.reason, 'reason'), idempotencyKey: context.idempotencyKey || null, occurredAt: this.clock() });
    await this.audit('MachineOperations.InventoryConsumed', movement.id, 'record_consumption', context, { machine_id: movement.machineId, item_type: movement.itemType, quantity: movement.quantity });
    return movement;
  }

  async submitServiceReport(request, context = {}) {
    await this.authorize(context.actorId, PERMISSION.SUBMIT_SERVICE_REPORT); await this.requireMachine(request.machineId);
    if (request.maintenanceTaskId) {
      const task = await this.requireTask(request.maintenanceTaskId);
      if (task.assignedToId !== context.actorId) throw forbidden('OPERATOR_TASK_SCOPE_DENIED');
    }
    const log = await this.repository.createServiceLog({ machineId: request.machineId, maintenanceTaskId: request.maintenanceTaskId || null, operatorId: context.actorId, status: 'SUBMITTED', summary: requiredText(request.summary, 'summary'), workPerformed: requiredObject(request.workPerformed, 'work_performed'), submittedAt: this.clock() });
    await this.audit('MachineOperations.ServiceReportSubmitted', log.id, 'submit_service_report', context, { machine_id: log.machineId }); return log;
  }

  async approveServiceReport(serviceLogId, request = {}, context = {}) {
    await this.authorize(context.actorId, PERMISSION.APPROVE_SERVICE_REPORT);
    const log = await this.repository.findServiceLog(serviceLogId); if (!log) throw notFound('Service report');
    if (log.status !== 'SUBMITTED') throw conflict('SERVICE_REPORT_NOT_SUBMITTED', 'Only submitted service reports can be approved.');
    const approved = await this.repository.updateServiceLog(serviceLogId, { status: 'APPROVED', approvedById: context.actorId, approvedAt: this.clock(), approvalNote: optionalText(request.approvalNote) });
    await this.audit('MachineOperations.ServiceReportApproved', serviceLogId, 'approve_service_report', context, { operator_id: log.operatorId }); return approved;
  }

  async attachPhotoEvidence(request, context = {}) {
    await this.authorize(context.actorId, PERMISSION.ATTACH_PHOTO_EVIDENCE);
    const refs = [request.maintenanceTaskId, request.serviceLogId, request.testRunId].filter(Boolean);
    if (refs.length !== 1) throw validation('evidence_reference', 'exactly one task, service log, or test run reference is required');
    const photo = await this.repository.createPhotoEvidence({ operatorId: context.actorId, maintenanceTaskId: request.maintenanceTaskId || null, serviceLogId: request.serviceLogId || null, testRunId: request.testRunId || null, storageKey: requiredText(request.storageKey, 'storage_key'), contentType: requiredText(request.contentType, 'content_type'), checksumSha256: sha256(request.checksumSha256), capturedAt: requiredDate(request.capturedAt, 'captured_at'), metadata: request.metadata || undefined });
    await this.audit('MachineOperations.PhotoEvidenceAttached', photo.id, 'attach_photo_evidence', context, { storage_key: photo.storageKey }); return photo;
  }

  async listOperatorActions(limit, context = {}) { await this.authorize(context.actorId, PERMISSION.VIEW_ALL_ACTIONS); return this.repository.listOperatorActions(Math.min(positiveInteger(limit || 100, 'limit'), 500)); }
  async manageMachineSetting(machineId, key, value, context = {}) { await this.authorize(context.actorId, PERMISSION.MANAGE_MACHINE_SETTINGS); await this.requireMachine(machineId); if (value === undefined) throw validation('value', 'is required'); const setting = await this.repository.upsertMachineSetting(machineId, requiredCode(key, 'key'), value, context.actorId); await this.audit('MachineOperations.MachineSettingUpdated', setting.id, 'manage_machine_setting', context, { machine_id: machineId, key }); return setting; }

  async authorize(operatorId, permission) { const operator = await this.requireOperator(operatorId); if (!new Operator(operator).hasPermission(permission)) throw forbidden('OPERATOR_PERMISSION_DENIED'); return operator; }
  async requireOperator(id) { if (!id) throw forbidden('OPERATOR_AUTHENTICATION_REQUIRED', 401); const record = await this.repository.findOperatorById(id); if (!record) throw forbidden('OPERATOR_AUTHENTICATION_REQUIRED', 401); return record; }
  async requireMachine(id) { const record = await this.repository.findMachine(id); if (!record) throw notFound('Machine'); return record; }
  async requireChecklist(id) { const record = await this.repository.findChecklist(id); if (!record) throw notFound('Maintenance checklist'); return record; }
  async requireTask(id) { const record = await this.repository.findTask(id); if (!record) throw notFound('Maintenance task'); return record; }
  audit(eventType, targetId, action, context, metadata) { return this.auditRepository.record({ eventType, subjectType: 'operator', subjectId: context.actorId, targetType: 'MachineOperations', targetId, action, decision: 'success', authMethod: context.authMethod, sourceChannel: context.sourceChannel, correlationId: context.correlationId, metadata }); }
}

function normalizeTestConsumptions(items) { if (!Array.isArray(items)) throw validation('consumptions', 'must be an array'); const normalized = items.map((item, index) => ({ itemType: normalizeEnum(item.itemType, Object.values(INVENTORY_ITEM_TYPE), `consumptions.${index}.item_type`), itemReference: optionalText(item.itemReference), quantity: positiveNumber(item.quantity, `consumptions.${index}.quantity`), unit: requiredText(item.unit, `consumptions.${index}.unit`) })); for (const type of REQUIRED_TEST_RUN_ITEMS) if (!normalized.some((item) => item.itemType === type)) throw validation('consumptions', `must include ${type}`); return normalized; }
function validateChecklistItems(items) { if (!Array.isArray(items) || !items.length) throw validation('items', 'must be a non-empty array'); const ids = new Set(); return items.map((item, index) => { const id = requiredCode(item.id, `items.${index}.id`); if (ids.has(id)) throw validation(`items.${index}.id`, 'must be unique'); ids.add(id); return { id, label: requiredText(item.label, `items.${index}.label`), required: item.required !== false }; }); }
function validateChecklistResults(items, results) { if (!results || typeof results !== 'object' || Array.isArray(results)) throw validation('checklist_results', 'must be an object'); for (const item of items) if (item.required !== false && !Object.prototype.hasOwnProperty.call(results, item.id)) throw validation(`checklist_results.${item.id}`, 'is required'); return results; }
function requiredObject(value, field) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw validation(field, 'must be an object'); return value; }
function requiredText(value, field) { if (typeof value !== 'string' || !value.trim()) throw validation(field, 'must be a non-empty string'); return value.trim(); }
function optionalText(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function requiredCode(value, field) { const code = requiredText(value, field); if (!/^[a-z][a-z0-9_]*$/.test(code)) throw validation(field, 'must be lower_snake_case'); return code; }
function positiveInteger(value, field) { const number = Number(value); if (!Number.isInteger(number) || number <= 0) throw validation(field, 'must be a positive integer'); return number; }
function positiveNumber(value, field) { const number = Number(value); if (!Number.isFinite(number) || number <= 0) throw validation(field, 'must be a positive number'); return number; }
function normalizeEnum(value, allowed, field) { const normalized = String(value || '').toUpperCase(); if (!allowed.includes(normalized)) throw validation(field, `must be one of ${allowed.join(', ')}`); return normalized; }
function optionalDate(value, field) { return value ? requiredDate(value, field) : null; }
function requiredDate(value, field) { const date = new Date(value); if (Number.isNaN(date.getTime())) throw validation(field, 'must be an ISO date-time'); return date; }
function sha256(value) { const normalized = requiredText(value, 'checksum_sha256').toLowerCase(); if (!/^[a-f0-9]{64}$/.test(normalized)) throw validation('checksum_sha256', 'must be a SHA-256 hex digest'); return normalized; }
function validation(field, issue) { return new ApiError({ statusCode: 400, code: 'VALIDATION_FAILED', message: 'Request validation failed.', details: [{ field, issue }], source: 'api' }); }
function forbidden(code, statusCode = 403) { return new ApiError({ statusCode, code, message: statusCode === 401 ? 'Operator authentication is required.' : 'Operator is not authorized for this action.', source: 'api' }); }
function notFound(resource) { return new ApiError({ statusCode: 404, code: 'RESOURCE_NOT_FOUND', message: `${resource} was not found.`, source: 'runtime' }); }
function conflict(code, message) { return new ApiError({ statusCode: 409, code, message, source: 'runtime' }); }

module.exports = { MachineOperationsService };
