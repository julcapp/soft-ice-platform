const SENSITIVE = /(password|token|secret|authorization|cookie|api.?key|rtsp.?url|card.?number|cvv|biometric)/i;
class EventPayloadSanitizer { sanitize() { throw new Error('Not implemented'); } }
class DefaultEventPayloadSanitizer extends EventPayloadSanitizer {
  constructor({ allowlist = null, denylist = [] } = {}) { super(); this.allowlist = allowlist; this.denylist = denylist; }
  sanitize(value) {
    const visit = (input) => {
      if (Array.isArray(input)) return input.map(visit);
      if (!input || typeof input !== 'object') return input;
      return Object.fromEntries(Object.entries(input).filter(([key]) => (!this.allowlist || this.allowlist.includes(key)) && !SENSITIVE.test(key) && !this.denylist.includes(key)).map(([key, item]) => [key, visit(item)]));
    };
    return visit(value || {});
  }
}
class EventSchemaValidator { validate() { throw new Error('Not implemented'); } }
class BasicEventSchemaValidator extends EventSchemaValidator {
  validate(event, definition) {
    if (!definition) throw Object.assign(new Error('Неизвестный код события.'), { code: 'EVENT_TYPE_UNKNOWN' });
    for (const field of ['eventId', 'eventCode', 'occurredAt']) if (!event[field]) throw Object.assign(new Error(`Отсутствует ${field}.`), { code: 'EVENT_SCHEMA_INVALID' });
    return true;
  }
}
class EventDeduplicationService { isDuplicate() { throw new Error('Not implemented'); } }
class InMemoryEventDeduplicationService extends EventDeduplicationService { constructor() { super(); this.keys = new Set(); } isDuplicate(key) { if (this.keys.has(key)) return true; this.keys.add(key); return false; } }
class EventRecordPublisher { publish() { throw new Error('Not implemented'); } }
class InMemoryEventRecordPublisher extends EventRecordPublisher { constructor() { super(); this.records = []; } publish(record) { this.records.push(record); return record; } }
class EventBusSubscriber { subscriber() { throw new Error('Not implemented'); } }
class ExistingEventBusSubscriber extends EventBusSubscriber { constructor(ingestion) { super(); this.ingestion = ingestion; } subscriber() { return { subscriberId: 'event-center-v1', critical: false, handler: async (event) => { try { return await this.ingestion.ingestPlatformEvent(event); } catch (error) { if (error.code === 'EVENT_TYPE_UNKNOWN') return { status: 'REGISTERED_NOT_EMITTED_OR_UNMAPPED' }; throw error; } } }; } }
class ExternalEventBrokerAdapter {}
class MockExternalEventBrokerAdapter extends ExternalEventBrokerAdapter { constructor() { super(); this.status = 'FOUNDATION_ONLY'; } }
class EventNotificationPublisher {}
class MockEventNotificationPublisher extends EventNotificationPublisher { publish() { return { status: 'FOUNDATION_ONLY' }; } }
class EventMetricsAdapter { constructor() { this.values = new Map(); } increment(name) { this.values.set(name, (this.values.get(name) || 0) + 1); } observe() {} get(name) { return this.values.get(name) || 0; } }
class EventPatternDetector {} class EventAnomalyDetector {} class EventSummaryProvider {} class EventInsight {} class EventInsightRepository {}
module.exports = { EventPayloadSanitizer, DefaultEventPayloadSanitizer, EventSchemaValidator, BasicEventSchemaValidator, EventDeduplicationService, InMemoryEventDeduplicationService, EventRecordPublisher, InMemoryEventRecordPublisher, EventBusSubscriber, ExistingEventBusSubscriber, ExternalEventBrokerAdapter, MockExternalEventBrokerAdapter, EventNotificationPublisher, MockEventNotificationPublisher, EventMetricsAdapter, EventPatternDetector, EventAnomalyDetector, EventSummaryProvider, EventInsight, EventInsightRepository };
