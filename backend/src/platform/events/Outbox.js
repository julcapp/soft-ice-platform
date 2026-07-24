class Outbox { enqueue() { throw new Error('Outbox.enqueue must be implemented.'); } list() { throw new Error('Outbox.list must be implemented.'); } }
class InMemoryOutbox extends Outbox {
  constructor() { super(); this.records = []; }
  enqueue(event) { const record = Object.freeze({ event, status: 'RECORDED_IN_MEMORY', enqueuedAt: new Date() }); this.records.push(record); return record; }
  list() { return [...this.records]; }
}
module.exports = { Outbox, InMemoryOutbox };
