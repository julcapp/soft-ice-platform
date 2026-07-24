const { PlatformEvent } = require('./PlatformEvent');
const { EventDelivery, EventDeliveryStatus } = require('./EventDelivery');

class EventBus {
  constructor({ registry, eventStore, outbox, deadLetterStore, maxDeliveryAttempts = 3, logger } = {}) {
    this.registry = registry; this.eventStore = eventStore; this.outbox = outbox;
    this.deadLetterStore = deadLetterStore; this.maxDeliveryAttempts = maxDeliveryAttempts;
    this.logger = logger; this.deliveries = []; this.processed = new Set();
  }
  async publish(value) {
    const event = value instanceof PlatformEvent ? value : new PlatformEvent(value);
    this.eventStore.append(event); this.outbox.enqueue(event);
    for (const subscriber of this.registry.get(event.eventType)) {
      const key = `${subscriber.subscriberId}:${event.eventId}`;
      if (this.processed.has(key)) { this.record(event, subscriber, 0, EventDeliveryStatus.DUPLICATE_SKIPPED); continue; }
      let error;
      for (let attempt = 1; attempt <= this.maxDeliveryAttempts; attempt += 1) {
        try {
          await subscriber.handler(event, { subscriberId: subscriber.subscriberId, idempotencyKey: key, attempt });
          this.processed.add(key); this.record(event, subscriber, attempt, EventDeliveryStatus.DELIVERED); error = null; break;
        } catch (caught) { error = caught; this.record(event, subscriber, attempt, EventDeliveryStatus.FAILED, caught); }
      }
      if (error) {
        this.deadLetterStore.record({ event, subscriberId: subscriber.subscriberId, attempts: this.maxDeliveryAttempts, error: { name: error.name, message: error.message } });
        this.record(event, subscriber, this.maxDeliveryAttempts, EventDeliveryStatus.DEAD_LETTERED, error);
        if (subscriber.critical) throw error;
        this.logger?.error?.('platform_event_handler_failed', { event_id: event.eventId, subscriber_id: subscriber.subscriberId, error: error.message });
      }
    }
    return event;
  }
  record(event, subscriber, attempts, status, error) {
    this.deliveries.push(new EventDelivery({ deliveryId: `${event.eventId}:${subscriber.subscriberId}:${this.deliveries.length + 1}`, eventId: event.eventId, subscriberId: subscriber.subscriberId, idempotencyKey: `${subscriber.subscriberId}:${event.eventId}`, attempts, status, error: error ? error.message : null, recordedAt: new Date() }));
  }
  listDeliveries(eventId) { return this.deliveries.filter((delivery) => !eventId || delivery.eventId === eventId); }
}
class EventPublisher { constructor(eventBus) { this.eventBus = eventBus; } publish(event) { return this.eventBus.publish(event); } }
class EventSubscriber { constructor(value) { Object.assign(this, value); } }
module.exports = { EventBus, EventPublisher, EventSubscriber };
