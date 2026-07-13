const crypto = require('crypto');

class InMemoryDomainEventPublisher {
  constructor({ clock = () => new Date() } = {}) {
    this.clock = clock;
    this.events = [];
  }

  async publish(event) {
    const now = this.clock();
    const publishedEvent = {
      id: event.id || `evt_${crypto.randomUUID()}`,
      name: event.name,
      canonicalName: event.canonicalName || event.name,
      version: event.version || 1,
      category: event.category || 'domain',
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      occurredAt: event.occurredAt || now,
      publishedAt: now,
      correlationId: event.correlationId || null,
      causationId: event.causationId || null,
      idempotencyKey: event.idempotencyKey || null,
      actorContext: event.actorContext || null,
      payload: event.payload || {},
      metadata: event.metadata || {},
    };

    this.events.push(publishedEvent);

    return publishedEvent;
  }

  getPublishedEvents(filter = {}) {
    return this.events.filter((event) => {
      if (filter.name && event.name !== filter.name) {
        return false;
      }

      if (filter.aggregateId && event.aggregateId !== filter.aggregateId) {
        return false;
      }

      return true;
    });
  }

  clear() {
    this.events = [];
  }
}

module.exports = {
  InMemoryDomainEventPublisher,
};
