const crypto = require('crypto');
const { ApiError } = require('../../platform/errors/ApiError');

const ROLES = Object.freeze({
  OPERATOR: ['workspace:read', 'workspace:execute'],
  ADMIN: ['workspace:read', 'workspace:execute', 'workspace:read_all'],
  PLATFORM_OWNER: ['workspace:read', 'workspace:execute', 'workspace:read_all'],
});

const TESTS = Object.freeze({
  CUP: { label: 'Выдача стаканчика', expenses: [{ itemId: 'cup_200_ml', quantity: 1, unit: 'шт.' }] },
  ICE_CREAM: { label: 'Выдача мороженого', expenses: [{ itemId: 'mix_vanilla', quantity: 80, unit: 'г' }] },
  SYRUP: { label: 'Выдача сиропов', expenses: [{ itemId: 'syrup_test', quantity: 10, unit: 'мл' }] },
});

class OperatorWorkspaceService {
  constructor({ repository, eventPublisher, inventoryRuntime, clock = () => new Date() }) {
    Object.assign(this, { repository, eventPublisher, inventoryRuntime, clock });
  }

  listMachines(context) {
    this.authorize(context, 'workspace:read');
    return this.repository.listMachines(context.actorId).map(machineView);
  }

  getMachine(machineId, context) {
    this.authorize(context, 'workspace:read');
    return machineView(this.assignedMachine(machineId, context));
  }

  openSession(machineId, request, context) {
    return this.command(`open:${machineId}`, request, context, async () => {
      const machine = this.assignedMachine(machineId, context);
      const now = this.clock().toISOString();
      const session = this.repository.saveSession({
        id: `operator_session_${crypto.randomUUID()}`, machineId, operatorId: context.actorId,
        status: 'IN_PROGRESS', startedAt: now, completedAt: null, summary: null,
        checklist: [
          item('cleaning', 'Очистить рабочие поверхности'),
          item('visual_inspection', 'Проверить узлы и соединения'),
          item('waste_removal', 'Удалить отходы и заменить пакет'),
          item('consumables_check', 'Проверить остатки расходных материалов'),
        ],
        photos: { before: [], after: [] }, tests: [], expenses: [], consumptions: [],
        availableTests: machine.syrupLines.length ? ['CUP', 'ICE_CREAM', 'SYRUP'] : ['CUP', 'ICE_CREAM'],
      });
      await this.record('OperatorWorkspace.SessionOpened', session, context, { machineCode: machine.code });
      return session;
    });
  }

  updateChecklist(sessionId, itemId, request, context) {
    return this.command(`checklist:${sessionId}:${itemId}`, request, context, async () => {
      const session = this.ownedSession(sessionId, context);
      this.mutable(session);
      const index = session.checklist.findIndex((entry) => entry.id === itemId);
      if (index < 0) throw notFound('Пункт чек-листа');
      const checklist = session.checklist.map((entry, position) => position === index ? {
        ...entry, status: enumValue(request.status, ['PASSED', 'FAILED', 'NOT_APPLICABLE'], 'status'),
        note: optionalText(request.note), completedAt: this.clock().toISOString(),
      } : entry);
      const updated = this.repository.saveSession({ ...session, checklist });
      await this.record('OperatorWorkspace.ChecklistUpdated', updated, context, { itemId });
      return updated;
    });
  }

  attachPhoto(sessionId, request, context) {
    return this.command(`photo:${sessionId}`, request, context, async () => {
      const session = this.ownedSession(sessionId, context);
      this.mutable(session);
      const stage = enumValue(request.stage, ['BEFORE', 'AFTER'], 'stage').toLowerCase();
      const photo = {
        id: `operator_photo_${crypto.randomUUID()}`, stage: stage.toUpperCase(),
        storageKey: text(request.storageKey, 'storage_key'), contentType: text(request.contentType, 'content_type'),
        checksumSha256: sha(request.checksumSha256), capturedAt: date(request.capturedAt, 'captured_at'),
      };
      const photos = { ...session.photos, [stage]: [...session.photos[stage], photo] };
      const updated = this.repository.saveSession({ ...session, photos });
      await this.record('OperatorWorkspace.PhotoAttached', updated, context, { photoId: photo.id, stage: photo.stage });
      return updated;
    });
  }

  performTest(sessionId, request, context) {
    return this.command(`test:${sessionId}`, request, context, async () => {
      const session = this.ownedSession(sessionId, context);
      this.mutable(session);
      const type = enumValue(request.type, Object.keys(TESTS), 'type');
      if (!session.availableTests.includes(type)) throw conflict('OPERATOR_TEST_NOT_AVAILABLE', 'Этот тест недоступен для выбранного автомата.');
      const definition = TESTS[type];
      const occurredAt = this.clock().toISOString();
      const test = { id: `operator_test_${crypto.randomUUID()}`, type, name: definition.label, status: enumValue(request.status, ['PASSED', 'FAILED'], 'status'), note: optionalText(request.note), occurredAt };
      const expenses = definition.expenses.map((expense) => ({
        id: `test_expense_${crypto.randomUUID()}`, ...expense, category: 'TEST_CONSUMPTION',
        commercialSale: false, testId: test.id, occurredAt,
      }));
      for (const [index, expense] of expenses.entries()) {
        await this.inventoryRuntime?.recordMovement?.({
          itemId: expense.itemId, locationId: `location_${session.machineId}`, movementType: 'TEST_CONSUMPTION',
          quantity: expense.quantity, reason: `Тестовая операция: ${definition.label}`,
          sourceType: 'OPERATOR_WORKSPACE_TEST', sourceId: test.id,
          metadata: { machineId: session.machineId, commercialSale: false },
        }, { actorType: 'OPERATOR', actorId: context.actorId, correlationId: context.correlationId, idempotencyKey: `${context.idempotencyKey}:expense:${index}` });
      }
      const updated = this.repository.saveSession({ ...session, tests: [...session.tests, test], expenses: [...session.expenses, ...expenses] });
      await this.record('OperatorWorkspace.TestPerformed', updated, context, { test, expenses });
      return updated;
    });
  }

  recordConsumption(sessionId, request, context) {
    return this.command(`consumption:${sessionId}`, request, context, async () => {
      const session = this.ownedSession(sessionId, context);
      this.mutable(session);
      const consumption = {
        id: `service_consumption_${crypto.randomUUID()}`, itemId: code(request.itemId, 'item_id'),
        name: text(request.name, 'name'), quantity: positive(request.quantity, 'quantity'),
        unit: text(request.unit, 'unit'), reason: text(request.reason, 'reason'),
        category: 'MAINTENANCE', commercialSale: false, occurredAt: this.clock().toISOString(),
      };
      await this.inventoryRuntime?.recordMovement?.({
        itemId: consumption.itemId, locationId: `location_${session.machineId}`, movementType: 'MAINTENANCE',
        quantity: consumption.quantity, reason: consumption.reason,
        sourceType: 'OPERATOR_WORKSPACE_SESSION', sourceId: session.id,
        metadata: { machineId: session.machineId, commercialSale: false },
      }, { actorType: 'OPERATOR', actorId: context.actorId, correlationId: context.correlationId, idempotencyKey: `${context.idempotencyKey}:inventory` });
      const updated = this.repository.saveSession({ ...session, consumptions: [...session.consumptions, consumption] });
      await this.record('OperatorWorkspace.ConsumableWrittenOff', updated, context, consumption);
      return updated;
    });
  }

  completeSession(sessionId, request, context) {
    return this.command(`complete:${sessionId}`, request, context, async () => {
      const session = this.ownedSession(sessionId, context);
      this.mutable(session);
      if (session.checklist.some((entry) => entry.status === 'PENDING')) throw conflict('OPERATOR_CHECKLIST_INCOMPLETE', 'Завершите все пункты чек-листа.');
      if (!session.photos.before.length || !session.photos.after.length) throw conflict('OPERATOR_PHOTOS_REQUIRED', 'Обязательны фотографии до и после обслуживания.');
      for (const type of session.availableTests) if (!session.tests.some((test) => test.type === type)) throw conflict('OPERATOR_TESTS_INCOMPLETE', 'Выполните все доступные тестовые операции.');
      const updated = this.repository.saveSession({ ...session, status: 'COMPLETED', summary: text(request.summary, 'summary'), completedAt: this.clock().toISOString() });
      await this.record('OperatorWorkspace.SessionCompleted', updated, context, { summary: updated.summary });
      return updated;
    });
  }

  getSession(sessionId, context) { this.authorize(context, 'workspace:read'); return this.ownedSession(sessionId, context); }

  listActions(filters, context) {
    this.authorize(context, 'workspace:read');
    const readAll = (context.roles || []).some((role) => ROLES[role]?.includes('workspace:read_all'));
    return this.repository.listActions({ operatorId: readAll ? filters.operatorId : context.actorId, machineId: filters.machineId, limit: Math.min(Number(filters.limit) || 100, 500) });
  }

  getTwinSummary(machineId) {
    const sessions = [...this.repository.sessions.values()].filter((session) => session.machineId === machineId);
    const active = sessions.find((session) => session.status === 'IN_PROGRESS');
    const completed = sessions.filter((session) => session.status === 'COMPLETED');
    return {
      assignedOperator: active?.operatorId || null,
      openServiceTasks: active ? [{ id: active.id, status: active.status, operatorId: active.operatorId }] : [],
      maintenanceSummary: { completedSessions: completed.length, lastServiceAt: completed.at(-1)?.completedAt || null },
      recentTestRuns: sessions.flatMap((session) => session.tests).slice(-10),
    };
  }

  command(scope, request, context, callback) {
    this.authorize(context, 'workspace:execute');
    if (!context.idempotencyKey) throw validation('idempotency_key', 'обязателен');
    return this.repository.idempotent(scope, context.idempotencyKey, request, callback);
  }

  authorize(context, permission) {
    const allowed = (context?.roles || []).flatMap((role) => ROLES[role] || []);
    if (!context?.actorId || !allowed.includes(permission)) throw new ApiError({ statusCode: context?.actorId ? 403 : 401, code: 'OPERATOR_WORKSPACE_ACCESS_DENIED', message: 'Недостаточно прав для рабочего места оператора.' });
  }

  assignedMachine(machineId, context) {
    const machine = this.repository.findMachine(machineId);
    if (!machine) throw notFound('Автомат');
    const readAll = (context.roles || []).some((role) => ROLES[role]?.includes('workspace:read_all'));
    if (!readAll && !machine.assignedOperatorIds.includes(context.actorId)) throw new ApiError({ statusCode: 403, code: 'OPERATOR_MACHINE_SCOPE_DENIED', message: 'Автомат не назначен текущему оператору.' });
    return machine;
  }

  ownedSession(sessionId, context) {
    const session = this.repository.findSession(sessionId);
    if (!session) throw notFound('Сессия обслуживания');
    const readAll = (context.roles || []).some((role) => ROLES[role]?.includes('workspace:read_all'));
    if (!readAll && session.operatorId !== context.actorId) throw new ApiError({ statusCode: 403, code: 'OPERATOR_SESSION_SCOPE_DENIED', message: 'Сессия принадлежит другому оператору.' });
    return session;
  }

  mutable(session) { if (session.status === 'COMPLETED') throw conflict('OPERATOR_SESSION_COMPLETED', 'Завершённая сессия неизменяема.'); }

  async record(eventType, session, context, payload) {
    const action = this.repository.appendAction({
      id: `operator_action_${crypto.randomUUID()}`, eventType, operatorId: context.actorId,
      machineId: session.machineId, sessionId: session.id, payload, occurredAt: this.clock().toISOString(),
    });
    await this.eventPublisher?.publish?.({
      eventType, eventVersion: 1, aggregateType: 'OPERATOR_SERVICE_SESSION', aggregateId: session.id,
      actorType: 'OPERATOR', actorId: context.actorId, sourceChannel: 'OPERATOR_WORKSPACE',
      correlationId: context.correlationId, occurredAt: action.occurredAt, payload: { machineId: session.machineId, sessionId: session.id, ...payload },
      metadata: { idempotencyKey: context.idempotencyKey },
    });
  }
}

function item(id, label) { return { id, label, required: true, status: 'PENDING', note: null, completedAt: null }; }
function machineView(machine) { return { ...machine, capabilities: { syrupTest: machine.syrupLines.length > 0 } }; }
function text(value, field) { if (typeof value !== 'string' || !value.trim()) throw validation(field, 'должно быть непустой строкой'); return value.trim(); }
function optionalText(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function code(value, field) { const result = text(value, field); if (!/^[a-z][a-z0-9_-]*$/.test(result)) throw validation(field, 'должно быть стабильным техническим идентификатором'); return result; }
function positive(value, field) { const result = Number(value); if (!Number.isFinite(result) || result <= 0) throw validation(field, 'должно быть положительным числом'); return result; }
function enumValue(value, allowed, field) { const result = String(value || '').toUpperCase(); if (!allowed.includes(result)) throw validation(field, `допустимые значения: ${allowed.join(', ')}`); return result; }
function date(value, field) { const result = new Date(value); if (Number.isNaN(result.getTime())) throw validation(field, 'должно быть датой и временем'); return result.toISOString(); }
function sha(value) { const result = text(value, 'checksum_sha256').toLowerCase(); if (!/^[a-f0-9]{64}$/.test(result)) throw validation('checksum_sha256', 'должно быть SHA-256'); return result; }
function validation(field, issue) { return new ApiError({ statusCode: 400, code: 'VALIDATION_FAILED', message: 'Ошибка проверки запроса.', details: [{ field, issue }] }); }
function notFound(resource) { return new ApiError({ statusCode: 404, code: 'RESOURCE_NOT_FOUND', message: `${resource} не найден.` }); }
function conflict(codeName, message) { return new ApiError({ statusCode: 409, code: codeName, message }); }

module.exports = { OperatorWorkspaceService, ROLES, TESTS };
