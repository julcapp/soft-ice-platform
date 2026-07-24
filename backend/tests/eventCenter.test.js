const test = require('node:test');
const assert = require('node:assert/strict');
const {
  EventCenterRepository, EventCenterRuntime, EventCenterService, EventIngestionService, EventQueryService,
  EventNormalizationService, EventRetentionService, DefaultEventPayloadSanitizer, BasicEventSchemaValidator,
  InMemoryEventRecordPublisher, EventMetricsAdapter, createEventTypeRegistry, EventRelation, EventEvidenceReference,
} = require('../src/modules/event_center');

function fixture() {
  const repository = new EventCenterRepository(); const registry = createEventTypeRegistry();
  const metrics = new EventMetricsAdapter(); const audit = { entries: [], record(value) { this.entries.push(value); return value; } };
  const normalization = new EventNormalizationService({ registry, sanitizer: new DefaultEventPayloadSanitizer() });
  const ingestion = new EventIngestionService({ repository, normalization, validator: new BasicEventSchemaValidator(), publisher: new InMemoryEventRecordPublisher(), metrics });
  const query = new EventQueryService(repository); const retention = new EventRetentionService({ repository, auditRepository: audit });
  const service = new EventCenterService({ repository, query, ingestion, retention, registry, auditRepository: audit });
  return { repository, registry, metrics, audit, service, runtime: new EventCenterRuntime({ service }) };
}
const admin = { role: 'PLATFORM_OWNER', actorId: 'owner', tenantId: 'default', machineIds: [], permissions: [] };
const event = (overrides = {}) => ({ eventId: 'evt_1', eventCode: 'MACHINE_DISCONNECTED', eventVersion: 1, occurredAt: '2026-07-24T10:00:00.000Z', sourceDomain: 'machine', subjectType: 'MACHINE', subjectId: 'machine_1', machineId: 'machine_1', correlationId: 'purchase_1', payload: { reason: 'timeout' }, ...overrides });

test('регистрирует неизменяемую нормализованную запись и значения реестра', async () => {
  const f = fixture(); const { record, duplicate } = await f.runtime.ingest(event());
  assert.equal(duplicate, false); assert.equal(record.category, 'MACHINE'); assert.equal(record.severity, 'WARNING');
  assert.equal(record.retentionUntil, '2027-01-20T10:00:00.000Z'); assert.equal(Object.isFrozen(record), true);
  record.title = 'Изменено'; assert.notEqual(record.title, 'Изменено');
  assert.equal(f.registry.get('PAYMENT_CONFIRMED', 1).id, 'PAYMENT_CONFIRMED.v1');
  assert.ok(f.registry.list().length > 60); assert.ok(f.registry.list().every((item) => item.emissionStatus === 'REGISTERED_NOT_EMITTED'));
});

test('повторная доставка идемпотентна по eventId и source identity', async () => {
  const f = fixture(); await f.runtime.ingest(event()); const second = await f.runtime.ingest(event());
  assert.equal(second.duplicate, true); assert.equal(f.repository.records.size, 1);
  const third = await f.runtime.ingest(event({ eventId: 'evt_2', sourceEventId: 'evt_1' }));
  assert.equal(third.duplicate, true); assert.equal(f.metrics.get('events_deduplicated_total'), 2);
});

test('sanitization рекурсивно исключает секреты и платёжные реквизиты', async () => {
  const f = fixture(); const { record } = await f.runtime.ingest(event({ payload: { password: 'x', token: 'y', cardNumber: '4111', ok: 1, nested: { rtspUrl: 'rtsp://secret', signal: 50 } } }));
  assert.deepEqual(record.payload, { ok: 1, nested: { signal: 50 } });
});

test('поиск, фильтры, cursor и correlation chain работают', async () => {
  const f = fixture();
  await f.runtime.ingest(event()); await f.runtime.ingest(event({ eventId: 'evt_2', sourceEventId: 'evt_2', eventCode: 'MACHINE_CONNECTED', occurredAt: '2026-07-24T11:00:00Z', causationId: 'evt_1' }));
  assert.equal(f.runtime.list({ machineId: 'machine_1', severity: 'WARNING' }, admin).items.length, 1);
  assert.equal(f.runtime.list({ category: 'MACHINE', dateFrom: '2026-07-24', dateTo: '2026-07-25' }, admin).items.length, 2);
  assert.equal(f.runtime.correlation('purchase_1', admin).items[0].eventId, 'evt_1');
  const page = f.runtime.list({ limit: 1 }, admin); assert.ok(page.nextCursor);
  assert.equal(f.runtime.list({ limit: 1, cursor: page.nextCursor }, admin).items.length, 1);
});

test('relations, evidence, acknowledgement, comments, tags and soft delete stay separate', async () => {
  const f = fixture(); await f.runtime.ingest(event());
  const relation = f.repository.addRelation(new EventRelation({ eventRecordId: 'evt_1', relationType: 'CAUSED_BY', targetType: 'MACHINE', targetId: 'machine_1' }));
  const evidence = f.repository.addEvidence(new EventEvidenceReference({ eventRecordId: 'evt_1', evidenceType: 'TELEMETRY_SNAPSHOT', sourceType: 'RUNTIME', sourceId: 'snapshot_1', title: 'Снимок телеметрии' }));
  await f.service.acknowledge('evt_1', { comment: 'Принято' }, admin); const comment = f.service.addComment('evt_1', 'Проверяем связь', admin);
  f.service.addTag('evt_1', 'связь', admin); f.repository.deleteComment('evt_1', comment.id);
  assert.equal(relation.relationType, 'CAUSED_BY'); assert.equal(evidence.evidenceType, 'TELEMETRY_SNAPSHOT');
  assert.equal(f.repository.states.get('evt_1').status, 'ACKNOWLEDGED'); assert.ok(comment.deletedAt);
  assert.deepEqual(f.repository.decorate(f.repository.get('evt_1')).tags, ['связь']);
});

test('legal hold blocks retention and deletion is idempotent', async () => {
  const f = fixture(); await f.runtime.ingest(event({ occurredAt: '2020-01-01T00:00:00Z' }));
  await f.service.setLegalHold('evt_1', true, 'Расследование', admin); assert.equal((await f.service.retention.run(new Date('2030-01-01'))).length, 0);
  await f.service.setLegalHold('evt_1', false, 'Завершено', admin); assert.equal((await f.service.retention.run(new Date('2030-01-01'))).length, 1);
  assert.equal(f.repository.deleteExpired('evt_1').deletionResult, 'ALREADY_DELETED');
});

test('permissions mask payload and enforce operator machine scope and security access', async () => {
  const f = fixture(); await f.runtime.ingest(event());
  const operator = { role: 'OPERATOR', actorId: 'op', tenantId: 'default', machineIds: ['machine_1'], permissions: [] };
  assert.equal(f.runtime.get('evt_1', operator).payload, undefined);
  assert.throws(() => f.runtime.list({ machineId: 'machine_2' }, operator), /не закреплён/i);
  await f.runtime.ingest(event({ eventId: 'sec_1', sourceEventId: 'sec_1', eventCode: 'SUSPICIOUS_ACTIVITY_DETECTED', subjectType: 'SYSTEM', subjectId: 'platform' }));
  assert.throws(() => f.runtime.get('sec_1', { ...admin, role: 'ADMIN' }), /безопасности/i);
  assert.equal(f.runtime.get('sec_1', { ...admin, role: 'SECURITY_OFFICER' }).eventId, 'sec_1');
});

test('export masks payload and audits; statistics are available', async () => {
  const f = fixture(); await f.runtime.ingest(event({ payload: { safe: 'value' } }));
  const output = f.service.export({}, 'CSV', admin);
  assert.ok(output.content.includes('MACHINE_DISCONNECTED')); assert.ok(!output.content.includes('value'));
  assert.ok(f.audit.entries.some((entry) => entry.action === 'Export'));
  assert.equal(f.runtime.statistics({}, admin).total, 1);
});

test('unknown type, invalid schema, unavailable repository and degraded health are explicit', async () => {
  const f = fixture();
  await assert.rejects(() => f.runtime.ingest(event({ eventCode: 'UNKNOWN' })), { code: 'EVENT_TYPE_UNKNOWN' });
  await assert.rejects(() => f.runtime.ingest(event({ eventId: null })), { code: 'EVENT_SCHEMA_INVALID' });
  assert.equal(f.service.health().status, 'DEGRADED');
  f.repository.available = false; assert.equal(f.service.health().status, 'UNAVAILABLE');
  assert.throws(() => f.runtime.list({}, admin), { code: 'EVENT_CENTER_REPOSITORY_UNAVAILABLE' });
});
