class EventStore {
  append() { throw new Error('EventStore.append must be implemented.'); }
  list() { throw new Error('EventStore.list must be implemented.'); }
  findById() { throw new Error('EventStore.findById must be implemented.'); }
}
class InMemoryEventStore extends EventStore {
  constructor() { super(); this.events = []; }
  append(event) { if (!this.events.some(({ eventId }) => eventId === event.eventId)) this.events.push(event); return event; }
  list({ eventType, aggregateId, limit = 200 } = {}) { return this.events.filter((e) => (!eventType || e.eventType === eventType) && (!aggregateId || e.aggregateId === aggregateId)).slice(-limit).reverse(); }
  findById(eventId) { return this.events.find((event) => event.eventId === eventId) || null; }
}
module.exports = { EventStore, InMemoryEventStore };
