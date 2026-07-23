const crypto = require('crypto');

class InMemoryDomainEventPublisher {
  constructor({ clock = () => new Date(), logger, metrics } = {}) {
    this.clock = clock;
    this.events = [];
    this.logger = logger;
    this.metrics = metrics;
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
    if (this.logger) {
      this.logger.domainEvent(publishedEvent);
      const category = String(publishedEvent.aggregateType || '').toLowerCase();
      if (category === 'machine') this.logger.machine('domain_event', { domain_event_name: publishedEvent.canonicalName, machine_id: publishedEvent.aggregateId });
      if (category === 'payment') this.logger.payment('domain_event', { domain_event_name: publishedEvent.canonicalName, payment_id: publishedEvent.aggregateId });
    }
    if (this.metrics) {
      const category = String(publishedEvent.aggregateType || '').toLowerCase();
      if (category === 'order') this.metrics.increment('soft_ice_orders_total', 1, { event: publishedEvent.name });
      if (category === 'machine') this.metrics.increment('soft_ice_machine_status', 1, { event: publishedEvent.name });
      if (category === 'payment') this.metrics.increment('soft_ice_payments_total', 1, { event: publishedEvent.name });
    }

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
