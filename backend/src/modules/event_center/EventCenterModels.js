const crypto = require('crypto');
const { deepFreeze } = require('../../platform/events/PlatformEvent');

const EVENT_CATEGORIES = ['SYSTEM', 'BUSINESS', 'MACHINE', 'CUSTOMER', 'PAYMENT', 'INVENTORY', 'MAINTENANCE', 'CONNECTIVITY', 'VIDEO_SURVEILLANCE', 'SECURITY', 'OPERATOR', 'ORGANIZATION', 'NOTIFICATION', 'AUDIT', 'OTHER'];
const EVENT_SEVERITIES = ['INFO', 'BUSINESS', 'WARNING', 'INCIDENT', 'CRITICAL', 'EMERGENCY'];
const PROCESSING_STATUSES = ['NEW', 'SEEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'IGNORED', 'ARCHIVED'];
const SUBJECT_TYPES = ['MACHINE', 'CUSTOMER', 'ORGANIZATION', 'EMPLOYEE', 'OPERATOR', 'ORDER', 'PAYMENT', 'INVENTORY_ITEM', 'INVENTORY_OPERATION', 'MAINTENANCE_REQUEST', 'CAMERA', 'VIDEO_INCIDENT', 'DOCUMENT', 'ROUTE', 'WAREHOUSE', 'SYSTEM', 'OTHER'];
const RELATION_TYPES = ['CAUSED_BY', 'RELATED_TO', 'GENERATED_BY', 'AFFECTS', 'EVIDENCE_FOR', 'PART_OF', 'PRECEDED_BY', 'FOLLOWED_BY', 'RESOLVED_BY', 'OTHER'];
const EVIDENCE_TYPES = ['VIDEO', 'IMAGE', 'DOCUMENT', 'PAYMENT_RECEIPT', 'RUNTIME_LOG', 'TELEMETRY_SNAPSHOT', 'NETWORK_CHECK', 'SENSOR_READING', 'MAINTENANCE_REPORT', 'OTHER'];
const RETENTION_DAYS = { INFO: 30, BUSINESS: 365, WARNING: 180, INCIDENT: 365, CRITICAL: 1095, EMERGENCY: 1825 };

function id(prefix) { return `${prefix}_${crypto.randomUUID()}`; }
function iso(value = new Date()) { return new Date(value).toISOString(); }

class EventRecord {
  constructor(value) {
    const required = ['eventId', 'eventCode', 'eventVersion', 'category', 'severity', 'sourceDomain', 'subjectType', 'subjectId', 'title', 'summary', 'occurredAt'];
    const missing = required.filter((field) => value[field] === undefined || value[field] === null || value[field] === '');
    if (missing.length) throw Object.assign(new Error(`Не заполнены поля события: ${missing.join(', ')}.`), { code: 'EVENT_RECORD_INVALID' });
    const now = iso();
    Object.assign(this, {
      id: value.id || id('event_record'), tenantId: value.tenantId || 'default', organizationId: value.organizationId || null,
      eventId: value.eventId, eventCode: value.eventCode, eventVersion: value.eventVersion, category: value.category,
      severity: value.severity, sourceDomain: value.sourceDomain, sourceService: value.sourceService || null,
      sourceEventId: value.sourceEventId || value.eventId, subjectType: value.subjectType, subjectId: value.subjectId,
      subjectDisplayName: value.subjectDisplayName || value.subjectId, actorType: value.actorType || 'SYSTEM',
      actorId: value.actorId || 'system', actorDisplayName: value.actorDisplayName || null,
      machineId: value.machineId || null, customerId: value.customerId || null, orderId: value.orderId || null,
      paymentId: value.paymentId || null, maintenanceRequestId: value.maintenanceRequestId || null,
      inventoryOperationId: value.inventoryOperationId || null, cameraId: value.cameraId || null,
      videoIncidentId: value.videoIncidentId || null, correlationId: value.correlationId || value.eventId,
      causationId: value.causationId || null, traceId: value.traceId || null, title: value.title, summary: value.summary,
      occurredAt: iso(value.occurredAt), receivedAt: iso(value.receivedAt || now), recordedAt: iso(value.recordedAt || now),
      acknowledgementRequired: Boolean(value.acknowledgementRequired), payload: value.payload || {}, metadata: value.metadata || {},
      expiresAt: value.retentionUntil || value.expiresAt || null, retentionUntil: value.retentionUntil || value.expiresAt || null,
      retentionReason: value.retentionReason || 'DEFAULT_SEVERITY_POLICY', legalHold: Boolean(value.legalHold), createdAt: iso(value.createdAt || now),
    });
    deepFreeze(this);
  }
}

class EventTypeDefinition {
  constructor(value) {
    Object.assign(this, {
      id: value.id || `${value.eventCode}.v${value.version}`, eventCode: value.eventCode, version: value.version,
      titleTemplate: value.titleTemplate, summaryTemplate: value.summaryTemplate, category: value.category,
      defaultSeverity: value.defaultSeverity, subjectType: value.subjectType, acknowledgementRequired: Boolean(value.acknowledgementRequired),
      retentionDays: value.retentionDays ?? RETENTION_DAYS[value.defaultSeverity], enabled: value.enabled !== false,
      emissionStatus: value.emissionStatus || 'REGISTERED_NOT_EMITTED', schemaReference: value.schemaReference || null,
      sourceDomain: value.sourceDomain, documentationReference: value.documentationReference || null, metadata: value.metadata || {},
    });
    deepFreeze(this);
  }
}

class EventSubject { constructor(value) { Object.assign(this, value); deepFreeze(this); } }
class EventRelation { constructor(value) { Object.assign(this, { id: value.id || id('relation'), metadata: {}, ...value }); deepFreeze(this); } }
class EventEvidenceReference { constructor(value) { Object.assign(this, { id: value.id || id('evidence'), createdAt: iso(), legalHold: false, metadata: {}, ...value }); deepFreeze(this); } }
class EventAcknowledgement { constructor(value) { Object.assign(this, { id: value.id || id('ack'), acknowledgedAt: iso(), metadata: {}, ...value }); deepFreeze(this); } }
class EventComment { constructor(value) { Object.assign(this, { id: value.id || id('comment'), createdAt: iso(), editedAt: null, deletedAt: null, ...value }); } }
class EventTag { constructor(value) { Object.assign(this, { id: value.id || id('tag'), createdAt: iso(), ...value }); deepFreeze(this); } }

module.exports = { EVENT_CATEGORIES, EVENT_SEVERITIES, PROCESSING_STATUSES, SUBJECT_TYPES, RELATION_TYPES, EVIDENCE_TYPES, RETENTION_DAYS, EventRecord, EventTypeDefinition, EventSubject, EventRelation, EventEvidenceReference, EventAcknowledgement, EventComment, EventTag, id, iso };
