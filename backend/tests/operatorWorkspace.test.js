const test = require('node:test');
const assert = require('node:assert/strict');
const { InMemoryOperatorWorkspaceRepository, OperatorWorkspaceService } = require('../src/modules/operator_workspace');

function fixture(role = 'OPERATOR', actorId = 'operator_demo') {
  const events = [];
  const inventoryMovements = [];
  const repository = new InMemoryOperatorWorkspaceRepository();
  const service = new OperatorWorkspaceService({
    repository,
    eventPublisher: { publish: async (event) => events.push(event) },
    inventoryRuntime: { recordMovement: async (request) => { inventoryMovements.push(request); return { movement: { id: `movement_${inventoryMovements.length}` } }; } },
    clock: () => new Date('2026-07-24T10:00:00.000Z'),
  });
  let sequence = 0;
  const context = () => ({ actorId, roles: [role], correlationId: 'correlation_operator_workspace', idempotencyKey: `key_${++sequence}` });
  return { service, repository, events, inventoryMovements, context };
}

test('оператор видит только назначенные автоматы и сиропный тест зависит от комплектации', () => {
  const { service, context } = fixture();
  const machines = service.listMachines(context());
  assert.equal(machines.length, 2);
  assert.equal(machines[0].capabilities.syrupTest, true);
  assert.equal(machines[1].capabilities.syrupTest, false);
});

test('полный цикл требует фото до и после, чек-лист и все доступные тесты', async () => {
  const { service, events, inventoryMovements, context } = fixture();
  let session = await service.openSession('machine_demo_1', {}, context());
  for (const item of session.checklist) session = await service.updateChecklist(session.id, item.id, { status: 'PASSED' }, context());
  for (const stage of ['BEFORE', 'AFTER']) session = await service.attachPhoto(session.id, {
    stage, storageKey: `${stage.toLowerCase()}.jpg`, contentType: 'image/jpeg',
    checksumSha256: 'a'.repeat(64), capturedAt: '2026-07-24T09:55:00.000Z',
  }, context());
  for (const type of session.availableTests) session = await service.performTest(session.id, { type, status: 'PASSED' }, context());
  session = await service.completeSession(session.id, { summary: 'Автомат очищен и проверен' }, context());
  assert.equal(session.status, 'COMPLETED');
  assert.equal(session.expenses.every((expense) => expense.category === 'TEST_CONSUMPTION' && expense.commercialSale === false), true);
  assert.equal(inventoryMovements.every((movement) => movement.movementType === 'TEST_CONSUMPTION'), true);
  assert.equal(events.some((event) => event.eventType === 'OperatorWorkspace.SessionCompleted'), true);
});

test('завершение без обязательной фотофиксации отклоняется', async () => {
  const { service, context } = fixture();
  let session = await service.openSession('machine_demo_2', {}, context());
  for (const item of session.checklist) session = await service.updateChecklist(session.id, item.id, { status: 'PASSED' }, context());
  for (const type of session.availableTests) session = await service.performTest(session.id, { type, status: 'PASSED' }, context());
  await assert.rejects(() => service.completeSession(session.id, { summary: 'Готово' }, context()), (error) => error.code === 'OPERATOR_PHOTOS_REQUIRED');
});

test('оператор не получает доступ к чужому автомату, администратор может читать журнал', () => {
  const denied = fixture('OPERATOR', 'operator_other');
  assert.throws(() => denied.service.getMachine('machine_demo_1', denied.context()), (error) => error.code === 'OPERATOR_MACHINE_SCOPE_DENIED');
  const admin = fixture('ADMIN', 'admin_demo');
  assert.doesNotThrow(() => admin.service.getMachine('machine_demo_1', admin.context()));
  assert.deepEqual(admin.service.listActions({}, admin.context()), []);
});
