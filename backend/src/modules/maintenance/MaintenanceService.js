const { ApiError } = require('../../platform/errors/ApiError');
const { CHECK_STATUS, MAINTENANCE_TYPE, PERMISSION, ROLE_PERMISSIONS, SESSION_STATUS, TEST_STATUS } = require('./MaintenanceModels');

class MaintenanceService {
  constructor({ repository, eventPublisher, inventoryRuntime, machineRuntimeService, machineTwinService, projection, clock = () => new Date() }) {
    Object.assign(this, { repository, eventPublisher, inventoryRuntime, machineRuntimeService, machineTwinService, projection, clock });
  }
  createPlan(request, context) {
    return this.command('create-plan', request, context, PERMISSION.PLAN_MANAGE, async () => {
      const checklist = checklistTemplate(request.checklist);
      const plan = this.repository.savePlan({
        code: code(request.code, 'code'), name: text(request.name, 'name'), type: enumeration(request.type, MAINTENANCE_TYPE, 'type'),
        machineIds: uniqueIds(request.machineIds, 'machine_ids'), intervalDays: request.intervalDays == null ? null : positive(request.intervalDays, 'interval_days'),
        checklist, requiredPhotoCount: nonNegative(request.requiredPhotoCount || 0, 'required_photo_count'),
        requireTestDispense: request.requireTestDispense !== false, active: request.active !== false,
        version: positive(request.version || 1, 'version'), createdAt: this.clock().toISOString(), createdBy: context.actorId,
      });
      await this.fact('Maintenance.PlanCreated', plan.id, context, plan); return plan;
    });
  }
  identifyMachine(request, context) {
    this.authorize(context, PERMISSION.SESSION_EXECUTE);
    const machine = this.repository.identifyMachine(text(request.qrCode, 'qr_code'));
    if (!machine) throw notFound('Machine QR identity');
    return { ...machine, identifiedAt: this.clock().toISOString(), identifiedBy: context.actorId };
  }
  openSession(request, context) {
    return this.command('open-session', request, context, PERMISSION.SESSION_EXECUTE, async () => {
      const machine = this.repository.identifyMachine(text(request.qrCode, 'qr_code')); if (!machine) throw notFound('Machine QR identity');
      const plan = request.planId ? this.repository.findPlan(request.planId) : null;
      const type = enumeration(request.type || plan?.type, MAINTENANCE_TYPE, 'type');
      if (plan && !plan.machineIds.includes(machine.machineId)) validation('plan_id', 'does not apply to the identified machine');
      if (this.repository.listSessions({ machineId: machine.machineId }).some((s) => ['OPEN','IN_PROGRESS','SUBMITTED'].includes(s.status))) throw conflict('MAINTENANCE_SESSION_CONFLICT', 'Machine already has an active maintenance session.');
      const now = this.clock().toISOString(), id = this.repository.id('maintenance_session');
      const runtimeSession = await this.machineRuntimeService?.startSession?.({ machineId: machine.machineId, sessionType: 'MAINTENANCE', initiatedBy: { actorType: 'OPERATOR', actorId: context.actorId }, operatorId: context.actorId, correlationId: context.correlationId });
      const session = this.repository.saveSession({
        id, machineId: machine.machineId, machineCode: machine.machineCode, planId: plan?.id || null, type, status: 'IN_PROGRESS',
        operatorId: context.actorId, issue: request.issue ? text(request.issue, 'issue') : null,
        checklist: (plan?.checklist || checklistTemplate(request.checklist)).map((item) => ({ ...item, status: CHECK_STATUS.PENDING, note: null, completedAt: null })),
        requiredPhotoCount: plan?.requiredPhotoCount ?? nonNegative(request.requiredPhotoCount || 0, 'required_photo_count'),
        requireTestDispense: plan ? plan.requireTestDispense !== false : request.requireTestDispense !== false,
        photos: [], replacements: [], testDispense: null, runtimeSessionId: runtimeSession?.sessionId || null,
        startedAt: now, submittedAt: null, approvedAt: null, rejectedAt: null, createdAt: now,
      });
      await this.fact('Maintenance.SessionOpened', id, context, session); return session;
    });
  }
  completeChecklistItem(sessionId, itemId, request, context) {
    return this.mutate('check-item', sessionId, { itemId, ...request }, context, async (session) => {
      const index = session.checklist.findIndex((item) => item.id === itemId); if (index < 0) throw notFound('Checklist item');
      const checklist = session.checklist.map((item, i) => i === index ? { ...item, status: enumeration(request.status, CHECK_STATUS, 'status'), note: request.note || null, completedAt: this.clock().toISOString() } : item);
      return this.changed(session, { checklist }, 'Maintenance.ChecklistItemCompleted', context);
    });
  }
  attachPhoto(sessionId, request, context) {
    return this.mutate('attach-photo', sessionId, request, context, async (session) => {
      const photo = Object.freeze({ id: this.repository.id('maintenance_photo'), storageKey: text(request.storageKey, 'storage_key'), checksumSha256: sha(request.checksumSha256), contentType: text(request.contentType, 'content_type'), capturedAt: date(request.capturedAt, 'captured_at'), attachedAt: this.clock().toISOString(), operatorId: context.actorId });
      return this.changed(session, { photos: [...session.photos, photo] }, 'Maintenance.PhotoEvidenceAttached', context);
    });
  }
  replaceConsumable(sessionId, request, context) {
    return this.mutate('replace-consumable', sessionId, request, context, async (session) => {
      const replacement = { id: this.repository.id('maintenance_replacement'), itemId: code(request.itemId, 'item_id'), locationId: code(request.locationId, 'location_id'), quantity: positive(request.quantity, 'quantity'), reason: text(request.reason, 'reason'), lotReference: request.lotReference || null, replacedAt: this.clock().toISOString() };
      const inventory = await this.inventoryRuntime?.recordMovement?.({ itemId: replacement.itemId, locationId: replacement.locationId, movementType: 'MAINTENANCE', quantity: replacement.quantity, reason: replacement.reason, sourceType: 'MAINTENANCE_SESSION', sourceId: session.id, metadata: { machineId: session.machineId, lotReference: replacement.lotReference } }, { actorType: 'OPERATOR', actorId: context.actorId, correlationId: context.correlationId, idempotencyKey: `${context.idempotencyKey}:inventory` });
      replacement.inventoryMovementId = inventory?.movement?.id || null;
      return this.changed(session, { replacements: [...session.replacements, replacement] }, 'Maintenance.ConsumableReplaced', context);
    });
  }
  recordTestDispense(sessionId, request, context) {
    return this.mutate('test-dispense', sessionId, request, context, async (session) => {
      const testDispense = { id: this.repository.id('maintenance_test'), status: enumeration(request.status, TEST_STATUS, 'status'), dispenseReference: text(request.dispenseReference, 'dispense_reference'), notes: request.notes || null, performedAt: this.clock().toISOString() };
      await this.fact('Maintenance.TestDispenseRecorded', session.id, context, { ...session, testDispense });
      return this.repository.saveSession({ ...session, testDispense });
    });
  }
  submit(sessionId, request, context) {
    return this.mutate('submit', sessionId, request, context, async (session) => {
      const pending = session.checklist.filter((item) => item.required && item.status === CHECK_STATUS.PENDING);
      if (pending.length) throw conflict('MAINTENANCE_CHECKLIST_INCOMPLETE', 'Required checklist items are incomplete.');
      if (session.photos.length < session.requiredPhotoCount) throw conflict('MAINTENANCE_PHOTO_EVIDENCE_REQUIRED', 'Required photo evidence is incomplete.');
      if (session.requireTestDispense && !session.testDispense) throw conflict('MAINTENANCE_TEST_DISPENSE_REQUIRED', 'A test dispense is required.');
      return this.changed(session, { status: SESSION_STATUS.SUBMITTED, summary: text(request.summary, 'summary'), submittedAt: this.clock().toISOString() }, 'Maintenance.SessionSubmitted', context);
    });
  }
  approve(sessionId, request, context) {
    return this.mutate('approve', sessionId, request, context, async (session) => {
      this.authorize(context, PERMISSION.SESSION_APPROVE);
      if (session.status !== SESSION_STATUS.SUBMITTED) throw conflict('MAINTENANCE_SESSION_NOT_SUBMITTED', 'Only submitted sessions can be approved.');
      const now = this.clock().toISOString(), result = await this.changed(session, { status: SESSION_STATUS.APPROVED, approvalNote: request.approvalNote || null, approvedBy: context.actorId, approvedAt: now }, 'Maintenance.SessionApproved', context);
      if (session.runtimeSessionId) await this.machineRuntimeService?.completeSession?.(session.runtimeSessionId, { correlationId: context.correlationId });
      return result;
    }, PERMISSION.SESSION_APPROVE);
  }
  reject(sessionId, request, context) {
    return this.mutate('reject', sessionId, request, context, async (session) => {
      if (session.status !== SESSION_STATUS.SUBMITTED) throw conflict('MAINTENANCE_SESSION_NOT_SUBMITTED', 'Only submitted sessions can be rejected.');
      return this.changed(session, { status: SESSION_STATUS.REJECTED, rejectionReason: text(request.reason, 'reason'), rejectedBy: context.actorId, rejectedAt: this.clock().toISOString() }, 'Maintenance.SessionRejected', context);
    }, PERMISSION.SESSION_APPROVE);
  }
  listSessions(filters, context) { this.authorize(context, PERMISSION.PROJECTION_READ); return this.repository.listSessions(filters); }
  getSession(id, context) { this.authorize(context, PERMISSION.PROJECTION_READ); const row = this.repository.findSession(id); if (!row) throw notFound('Maintenance session'); return { ...row, auditHistory: this.repository.listAudit(id) }; }
  getProjection(context) { this.authorize(context, PERMISSION.PROJECTION_READ); return { sessions: this.projection.list(), kpis: this.projection.kpis(), dataMode: 'IN_MEMORY_FOUNDATION' }; }
  async mutate(scope, sessionId, request, context, callback, permission = PERMISSION.SESSION_EXECUTE) {
    return this.command(`${scope}:${sessionId}`, request, context, permission, async () => {
      const session = this.repository.findSession(sessionId); if (!session) throw notFound('Maintenance session');
      if (permission === PERMISSION.SESSION_EXECUTE && session.operatorId !== context.actorId) throw forbidden('MAINTENANCE_SESSION_SCOPE_DENIED');
      if (['APPROVED','CANCELLED'].includes(session.status)) throw conflict('MAINTENANCE_SESSION_IMMUTABLE', 'Approved and cancelled sessions are immutable.');
      return callback(session);
    });
  }
  command(scope, request, context, permission, callback) { this.authorize(context, permission); return this.repository.idempotent(scope, required(context?.idempotencyKey, 'idempotency_key'), request, callback); }
  authorize(context, permission) { const allowed = (context?.roles || []).flatMap((role) => ROLE_PERMISSIONS[role] || []); if (!allowed.includes(permission)) throw forbidden('MAINTENANCE_PERMISSION_DENIED', context?.actorId ? 403 : 401); }
  async changed(session, patch, eventType, context) { const updated = this.repository.saveSession({ ...session, ...patch }); await this.fact(eventType, session.id, context, updated); return updated; }
  async fact(eventType, aggregateId, context, payload) {
    const occurredAt = this.clock().toISOString();
    this.repository.appendAudit({ sessionId: payload.id?.startsWith('maintenance_session') ? payload.id : null, eventType, actorId: context.actorId, roles: context.roles, correlationId: context.correlationId, idempotencyKey: context.idempotencyKey, occurredAt, payload });
    await this.eventPublisher?.publish?.({ eventType, eventVersion: 1, aggregateType: 'MAINTENANCE', aggregateId, actorType: context.roles?.includes('OPERATOR') ? 'OPERATOR' : 'ADMINISTRATOR', actorId: context.actorId, sourceChannel: context.sourceChannel || 'MAINTENANCE_RUNTIME', correlationId: context.correlationId, occurredAt, payload, metadata: { idempotencyKey: context.idempotencyKey } });
  }
}

function checklistTemplate(items) { if (!Array.isArray(items) || !items.length) validation('checklist', 'must be a non-empty array'); const seen = new Set(); return items.map((item, i) => { const id = code(item.id, `checklist.${i}.id`); if (seen.has(id)) validation(`checklist.${i}.id`, 'must be unique'); seen.add(id); return { id, label: text(item.label, `checklist.${i}.label`), required: item.required !== false, evidenceRequired: item.evidenceRequired === true }; }); }
function uniqueIds(value, field) { if (!Array.isArray(value) || !value.length) validation(field, 'must be a non-empty array'); return [...new Set(value.map((x) => code(x, field)))]; }
function required(value, field) { if (!value) throw new ApiError({ statusCode: 400, code: field === 'idempotency_key' ? 'IDEMPOTENCY_KEY_REQUIRED' : 'VALIDATION_FAILED', message: `${field} is required.` }); return value; }
function text(value, field) { if (typeof value !== 'string' || !value.trim()) validation(field, 'must be a non-empty string'); return value.trim(); }
function code(value, field) { const v = text(value, field); if (!/^[a-z][a-z0-9_-]*$/.test(v)) validation(field, 'must be a stable semantic ID'); return v; }
function positive(v, f) { const n = Number(v); if (!Number.isFinite(n) || n <= 0) validation(f, 'must be positive'); return n; }
function nonNegative(v, f) { const n = Number(v); if (!Number.isInteger(n) || n < 0) validation(f, 'must be a non-negative integer'); return n; }
function enumeration(v, values, f) { const n = String(v || '').toUpperCase(); if (!Object.values(values).includes(n)) validation(f, `must be one of ${Object.values(values).join(', ')}`); return n; }
function sha(v) { const n = text(v, 'checksum_sha256').toLowerCase(); if (!/^[a-f0-9]{64}$/.test(n)) validation('checksum_sha256', 'must be a SHA-256 digest'); return n; }
function date(v, f) { const d = new Date(v); if (Number.isNaN(d.getTime())) validation(f, 'must be a date-time'); return d.toISOString(); }
function validation(field, issue) { throw new ApiError({ statusCode: 400, code: 'VALIDATION_FAILED', message: 'Request validation failed.', details: [{ field, issue }] }); }
function forbidden(code, statusCode = 403) { return new ApiError({ statusCode, code, message: 'Maintenance action is not authorized.' }); }
function notFound(resource) { return new ApiError({ statusCode: 404, code: 'RESOURCE_NOT_FOUND', message: `${resource} was not found.` }); }
function conflict(code, message) { return new ApiError({ statusCode: 409, code, message }); }
module.exports = { MaintenanceService };
