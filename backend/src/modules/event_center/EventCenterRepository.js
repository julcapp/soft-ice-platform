const { EventComment, EventTag, EventAcknowledgement, EventRelation, EventEvidenceReference, iso } = require('./EventCenterModels');

class EventCenterRepository {
  constructor() {
    this.records = new Map(); this.eventIds = new Map(); this.sourceKeys = new Map();
    this.states = new Map(); this.relations = []; this.evidence = []; this.acknowledgements = [];
    this.comments = []; this.tags = []; this.deletionAudits = []; this.available = true;
  }
  assertAvailable() { if (!this.available) throw Object.assign(new Error('Хранилище Центра событий недоступно.'), { code: 'EVENT_CENTER_REPOSITORY_UNAVAILABLE' }); }
  create(record) {
    this.assertAvailable();
    const sourceKey = `${record.sourceDomain}:${record.sourceEventId}:${record.eventCode}:v${record.eventVersion}`;
    const existingId = this.eventIds.get(record.eventId) || this.sourceKeys.get(sourceKey);
    if (existingId) return { record: this.records.get(existingId), duplicate: true };
    this.records.set(record.eventId, record); this.eventIds.set(record.eventId, record.eventId); this.sourceKeys.set(sourceKey, record.eventId);
    this.states.set(record.eventId, { eventRecordId: record.eventId, status: 'NEW', seenAt: null, updatedAt: record.createdAt, updatedBy: 'system' });
    return { record, duplicate: false };
  }
  get(eventId) { this.assertAvailable(); return this.records.get(eventId) || null; }
  list(filters = {}) {
    this.assertAvailable();
    let values = [...this.records.values()];
    const eq = ['tenantId', 'organizationId', 'category', 'severity', 'eventCode', 'sourceDomain', 'subjectType', 'subjectId', 'machineId', 'customerId', 'correlationId'];
    for (const field of eq) if (filters[field]) values = values.filter((item) => item[field] === filters[field]);
    if (filters.status) values = values.filter((item) => this.states.get(item.eventId)?.status === filters.status);
    if (filters.acknowledgementRequired !== undefined) values = values.filter((item) => item.acknowledgementRequired === filters.acknowledgementRequired);
    if (filters.acknowledged !== undefined) values = values.filter((item) => this.acknowledgements.some((ack) => ack.eventRecordId === item.eventId) === filters.acknowledged);
    if (filters.tag) values = values.filter((item) => this.tags.some((tag) => tag.eventRecordId === item.eventId && tag.value === filters.tag));
    if (filters.dateFrom) values = values.filter((item) => item.occurredAt >= iso(filters.dateFrom));
    if (filters.dateTo) values = values.filter((item) => item.occurredAt <= iso(filters.dateTo));
    if (filters.text) { const needle = filters.text.toLowerCase(); values = values.filter((item) => `${item.title} ${item.summary} ${item.subjectDisplayName}`.toLowerCase().includes(needle)); }
    const direction = filters.sort === 'occurredAt:asc' ? 1 : -1;
    const sortField = filters.sort?.startsWith('receivedAt') ? 'receivedAt' : 'occurredAt';
    values.sort((a, b) => direction * a[sortField].localeCompare(b[sortField]));
    if (filters.cursor) { const index = values.findIndex((item) => item.eventId === filters.cursor); if (index >= 0) values = values.slice(index + 1); }
    const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
    return { items: values.slice(0, limit).map((item) => this.decorate(item)), nextCursor: values.length > limit ? values[limit - 1].eventId : null };
  }
  decorate(record, includePayload = false) {
    if (!record) return null;
    const result = { ...record, processingState: this.states.get(record.eventId), acknowledged: this.acknowledgements.some((a) => a.eventRecordId === record.eventId), tags: this.tags.filter((t) => t.eventRecordId === record.eventId).map((t) => t.value), evidenceCount: this.evidence.filter((e) => e.eventRecordId === record.eventId).length };
    if (!includePayload) delete result.payload;
    return result;
  }
  setState(eventId, status, actorId) { this.assertAvailable(); const state = { ...this.states.get(eventId), status, updatedAt: iso(), updatedBy: actorId }; this.states.set(eventId, state); return state; }
  acknowledge(value) { const entity = new EventAcknowledgement(value); this.acknowledgements.push(entity); this.setState(value.eventRecordId, 'ACKNOWLEDGED', value.userId); return entity; }
  addComment(value) { const entity = new EventComment(value); this.comments.push(entity); return entity; }
  deleteComment(eventId, commentId) { const item = this.comments.find((value) => value.eventRecordId === eventId && value.id === commentId); if (item && !item.deletedAt) item.deletedAt = iso(); return item || null; }
  addTag(value) { if (this.tags.some((tag) => tag.eventRecordId === value.eventRecordId && tag.value === value.value)) return null; const entity = new EventTag(value); this.tags.push(entity); return entity; }
  removeTag(eventId, value) { const before = this.tags.length; this.tags = this.tags.filter((tag) => tag.eventRecordId !== eventId || tag.value !== value); return before !== this.tags.length; }
  addRelation(value) { const entity = new EventRelation(value); this.relations.push(entity); return entity; }
  addEvidence(value) { const entity = new EventEvidenceReference(value); this.evidence.push(entity); return entity; }
  setLegalHold(eventId, enabled, reason, actorId) { const item = this.get(eventId); if (!item) return null; const state = this.states.get(eventId); this.states.set(eventId, { ...state, legalHold: enabled, legalHoldReason: reason, legalHoldChangedAt: iso(), legalHoldChangedBy: actorId }); return this.states.get(eventId); }
  retentionCandidates(now = new Date()) { return [...this.records.values()].filter((item) => item.retentionUntil && item.retentionUntil <= iso(now) && !item.legalHold && !this.states.get(item.eventId)?.legalHold); }
  deleteExpired(eventId, reason = 'RETENTION_EXPIRED') { if (!this.records.has(eventId)) return { deletionResult: 'ALREADY_DELETED' }; this.records.delete(eventId); const audit = { id: `deletion_${eventId}`, eventId, retentionReason: reason, deletionResult: 'DELETED', deletedAt: iso() }; this.deletionAudits.push(audit); return audit; }
  statistics(filters = {}) {
    const items = this.list({ ...filters, limit: 200 }).items;
    const count = (field) => items.reduce((acc, item) => ({ ...acc, [item[field]]: (acc[item[field]] || 0) + 1 }), {});
    const byDay = items.reduce((acc, item) => ({ ...acc, [item.occurredAt.slice(0, 10)]: (acc[item.occurredAt.slice(0, 10)] || 0) + 1 }), {});
    return { total: items.length, byCategory: count('category'), bySeverity: count('severity'), byEventCode: count('eventCode'), byOrganization: count('organizationId'), byMachine: count('machineId'), unacknowledged: items.filter((i) => i.acknowledgementRequired && !i.acknowledged).length, criticalAndEmergency: items.filter((i) => ['CRITICAL', 'EMERGENCY'].includes(i.severity)).length, byDay };
  }
  health() { return { available: this.available, writable: this.available }; }
}
class PostgreSQLEventCenterRepository { constructor(prisma) { this.prisma = prisma; this.status = 'FOUNDATION_ONLY'; } }
module.exports = { EventCenterRepository, PostgreSQLEventCenterRepository };
