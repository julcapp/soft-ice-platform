class EventHandlerRegistry {
  constructor() { this.handlers = new Map(); this.sequence = 0; }
  register(eventType, subscriber) {
    if (!subscriber?.subscriberId || typeof subscriber.handler !== 'function') throw new Error('Subscriber requires subscriberId and handler.');
    const records = this.handlers.get(eventType) || [];
    if (records.some(({ subscriberId }) => subscriberId === subscriber.subscriberId)) throw Object.assign(new Error('Subscriber is already registered.'), { code: 'SUBSCRIBER_ALREADY_REGISTERED' });
    records.push({ ...subscriber, critical: subscriber.critical === true, order: subscriber.order ?? 100, registrationOrder: this.sequence++ });
    this.handlers.set(eventType, records); return subscriber;
  }
  get(eventType) { return [...(this.handlers.get(eventType) || []), ...(this.handlers.get('*') || [])].sort((a, b) => a.order - b.order || a.registrationOrder - b.registrationOrder); }
}
module.exports = { EventHandlerRegistry };
