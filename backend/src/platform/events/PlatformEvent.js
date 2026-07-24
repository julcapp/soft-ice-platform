const crypto = require('crypto');

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

class PlatformEvent {
  constructor(value, { clock = () => new Date(), idFactory = () => `evt_${crypto.randomUUID()}` } = {}) {
    const now = clock();
    const event = {
      eventId: value.eventId || idFactory(),
      eventType: value.eventType,
      eventVersion: value.eventVersion ?? 1,
      occurredAt: value.occurredAt || now,
      recordedAt: value.recordedAt || now,
      aggregateType: value.aggregateType,
      aggregateId: value.aggregateId,
      actorType: value.actorType,
      actorId: value.actorId,
      sourceChannel: value.sourceChannel,
      correlationId: value.correlationId,
      causationId: value.causationId || null,
      payload: value.payload || {},
      metadata: value.metadata || {},
    };
    PlatformEvent.validate(event);
    Object.assign(this, event);
    deepFreeze(this);
  }

  static validate(event) {
    const required = ['eventId', 'eventType', 'occurredAt', 'recordedAt', 'aggregateType', 'aggregateId', 'actorType', 'actorId', 'sourceChannel', 'correlationId'];
    const missing = required.filter((field) => event[field] === undefined || event[field] === null || event[field] === '');
    if (missing.length) throw Object.assign(new Error(`Platform event is missing: ${missing.join(', ')}.`), { code: 'PLATFORM_EVENT_INVALID' });
    if (!Number.isInteger(event.eventVersion) || event.eventVersion < 1) throw Object.assign(new Error('eventVersion must be a positive integer.'), { code: 'PLATFORM_EVENT_VERSION_INVALID' });
    for (const field of ['occurredAt', 'recordedAt']) if (Number.isNaN(new Date(event[field]).getTime())) throw Object.assign(new Error(`${field} must be a valid date.`), { code: 'PLATFORM_EVENT_INVALID' });
    if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) throw Object.assign(new Error('payload must be an object.'), { code: 'PLATFORM_EVENT_INVALID' });
  }
}

module.exports = { PlatformEvent, EventEnvelope: PlatformEvent, deepFreeze };
