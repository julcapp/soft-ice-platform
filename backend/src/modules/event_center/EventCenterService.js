const { EventRecord, RETENTION_DAYS, PROCESSING_STATUSES, iso } = require('./EventCenterModels');

const PERMISSIONS = {
  PLATFORM_OWNER: ['event_center.*'], ADMIN: ['event_center.view', 'event_center.view_business', 'event_center.acknowledge', 'event_center.comment', 'event_center.manage_tags', 'event_center.manage_retention', 'event_center.export'],
  SECURITY_OFFICER: ['event_center.view', 'event_center.view_security', 'event_center.acknowledge', 'event_center.comment'],
  OPERATOR: ['event_center.view'], MAINTENANCE_ENGINEER: ['event_center.view', 'event_center.acknowledge', 'event_center.comment'],
  CUSTOMER_SUPPORT: ['event_center.view', 'event_center.view_business', 'event_center.comment'],
};
function hasPermission(context, permission) { const values = [...(PERMISSIONS[context.role] || []), ...(context.permissions || [])]; return values.includes('event_center.*') || values.includes(permission); }
function requirePermission(context, permission) { if (!hasPermission(context, permission)) throw Object.assign(new Error('Недостаточно прав для операции.'), { code: 'EVENT_CENTER_FORBIDDEN', statusCode: 403 }); }

class EventNormalizationService {
  constructor({ registry, sanitizer }) { this.registry = registry; this.sanitizer = sanitizer; }
  normalize(input) {
    const eventCode = input.eventCode || input.eventType;
    const eventVersion = Number(input.eventVersion || 1);
    const definition = this.registry.get(eventCode, eventVersion);
    if (!definition) throw Object.assign(new Error(`Тип ${eventCode}.v${eventVersion} не зарегистрирован.`), { code: 'EVENT_TYPE_UNKNOWN' });
    const subjectType = input.subjectType || input.aggregateType || definition.subjectType;
    const subjectId = input.subjectId || input.aggregateId;
    const retentionDays = definition.retentionDays ?? RETENTION_DAYS[definition.defaultSeverity];
    const occurredAt = new Date(input.occurredAt);
    const retentionUntil = new Date(occurredAt); retentionUntil.setUTCDate(retentionUntil.getUTCDate() + retentionDays);
    return new EventRecord({
      ...input, eventCode, eventVersion, category: definition.category, severity: input.severity || definition.defaultSeverity,
      sourceDomain: input.sourceDomain || definition.sourceDomain, sourceService: input.sourceService || input.sourceChannel,
      subjectType, subjectId, title: input.title || definition.titleTemplate, summary: input.summary || definition.summaryTemplate,
      acknowledgementRequired: input.acknowledgementRequired ?? definition.acknowledgementRequired,
      payload: this.sanitizer.sanitize(input.payload), retentionUntil: retentionUntil.toISOString(),
      machineId: input.machineId || (subjectType === 'MACHINE' ? subjectId : input.payload?.machineId),
      customerId: input.customerId || (subjectType === 'CUSTOMER' ? subjectId : input.payload?.customerId),
    });
  }
}
class EventIngestionService {
  constructor({ repository, normalization, validator, publisher, metrics }) { Object.assign(this, { repository, normalization, validator, publisher, metrics }); this.rejected = 0; }
  async ingest(input) {
    this.metrics?.increment('events_received_total');
    try {
      const definition = this.normalization.registry.get(input.eventCode || input.eventType, Number(input.eventVersion || 1));
      this.validator.validate({ ...input, eventCode: input.eventCode || input.eventType }, definition);
      const record = this.normalization.normalize(input); const result = this.repository.create(record);
      if (result.duplicate) this.metrics?.increment('events_deduplicated_total'); else { this.metrics?.increment('events_recorded_total'); await this.publisher.publish(record); }
      return result;
    } catch (error) { this.rejected += 1; this.metrics?.increment('events_rejected_total'); throw error; }
  }
  ingestPlatformEvent(event) { return this.ingest({ ...event, eventCode: event.eventType, sourceDomain: event.metadata?.sourceDomain || event.aggregateType?.toLowerCase(), sourceEventId: event.eventId, subjectType: event.aggregateType, subjectId: event.aggregateId }); }
}
class EventQueryService {
  constructor(repository) { this.repository = repository; }
  scopedFilters(filters, context) {
    requirePermission(context, 'event_center.view');
    const next = { ...filters, tenantId: context.tenantId || 'default' };
    if (context.role === 'OPERATOR') { if (!context.machineIds?.length) throw Object.assign(new Error('Автоматы не закреплены.'), { code: 'EVENT_CENTER_FORBIDDEN', statusCode: 403 }); if (next.machineId && !context.machineIds.includes(next.machineId)) throw Object.assign(new Error('Автомат не закреплён.'), { code: 'EVENT_CENTER_FORBIDDEN', statusCode: 403 }); next.machineId ||= context.machineIds[0]; }
    return next;
  }
  list(filters, context) { return this.repository.list(this.scopedFilters(filters, context)); }
  get(eventId, context) {
    requirePermission(context, 'event_center.view'); const record = this.repository.get(eventId);
    if (!record) return null;
    if (context.role === 'OPERATOR' && (!context.machineIds?.includes(record.machineId) || record.category === 'SECURITY')) throw Object.assign(new Error('Событие недоступно.'), { code: 'EVENT_CENTER_FORBIDDEN', statusCode: 403 });
    if (record.category === 'SECURITY' && !hasPermission(context, 'event_center.view_security')) throw Object.assign(new Error('Событие безопасности недоступно.'), { code: 'EVENT_CENTER_FORBIDDEN', statusCode: 403 });
    return this.repository.decorate(record, hasPermission(context, 'event_center.view_payload'));
  }
  correlation(correlationId, context) { return this.list({ correlationId, sort: 'occurredAt:asc', limit: 200 }, context); }
}
class EventRetentionService {
  constructor({ repository, auditRepository }) { this.repository = repository; this.auditRepository = auditRepository; }
  async run(now = new Date()) { const results = []; for (const record of this.repository.retentionCandidates(now)) { if (['PAYMENT', 'SECURITY', 'AUDIT'].includes(record.category)) continue; results.push(this.repository.deleteExpired(record.eventId)); } return results; }
}
class EventCenterService {
  constructor({ repository, query, ingestion, retention, registry, auditRepository }) { Object.assign(this, { repository, query, ingestion, retention, registry, auditRepository }); }
  audit(action, context, eventId, metadata = {}) { return this.auditRepository?.record?.({ eventType: `EventCenter.${action}`, subjectType: 'ADMIN', subjectId: context.actorId, targetType: 'EVENT_RECORD', targetId: eventId, action, decision: 'ALLOW', correlationId: context.correlationId || eventId || 'event-center', metadata }); }
  acknowledge(eventId, body, context) { requirePermission(context, 'event_center.acknowledge'); const result = this.repository.acknowledge({ eventRecordId: eventId, userId: context.actorId, comment: body.comment, resolutionCode: body.resolutionCode }); this.audit('Acknowledge', context, eventId); return result; }
  setState(eventId, status, context) { if (!PROCESSING_STATUSES.includes(status)) throw Object.assign(new Error('Недопустимый статус.'), { code: 'EVENT_STATE_INVALID' }); requirePermission(context, 'event_center.acknowledge'); const result = this.repository.setState(eventId, status, context.actorId); this.audit('ProcessingStateChanged', context, eventId, { status }); return result; }
  addComment(eventId, body, context) { requirePermission(context, 'event_center.comment'); return this.repository.addComment({ eventRecordId: eventId, authorId: context.actorId, body }); }
  addTag(eventId, value, context) { requirePermission(context, 'event_center.manage_tags'); return this.repository.addTag({ eventRecordId: eventId, value, authorId: context.actorId }); }
  setLegalHold(eventId, enabled, reason, context) { requirePermission(context, 'event_center.manage_legal_hold'); const result = this.repository.setLegalHold(eventId, enabled, reason, context.actorId); this.audit(enabled ? 'LegalHoldApplied' : 'LegalHoldReleased', context, eventId, { reason }); return result; }
  export(filters, format, context) {
    requirePermission(context, 'event_center.export'); const items = this.query.list({ ...filters, limit: 1000 }, context).items.map(({ payload, ...item }) => item); this.audit('Export', context, null, { format, count: items.length });
    if (format === 'CSV') { const keys = ['eventId', 'occurredAt', 'eventCode', 'severity', 'category', 'title', 'subjectId']; return { format, content: [keys.join(','), ...items.map((item) => keys.map((key) => JSON.stringify(item[key] ?? '')).join(','))].join('\n') }; }
    return { format: 'JSON', content: JSON.stringify(items) };
  }
  health() { const storage = this.repository.health(); return { status: !storage.available ? 'UNAVAILABLE' : (this.ingestion.rejected > 0 ? 'DEGRADED' : 'HEALTHY'), repository: storage, rejectedEvents: this.ingestion.rejected, checkedAt: iso() }; }
}
module.exports = { PERMISSIONS, hasPermission, requirePermission, EventNormalizationService, EventIngestionService, EventQueryService, EventRetentionService, EventCenterService };
