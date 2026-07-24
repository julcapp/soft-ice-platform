class DeadLetterStore { record() { throw new Error('DeadLetterStore.record must be implemented.'); } list() { throw new Error('DeadLetterStore.list must be implemented.'); } }
class InMemoryDeadLetterStore extends DeadLetterStore {
  constructor() { super(); this.records = []; }
  record(value) { const record = Object.freeze({ ...value, deadLetteredAt: value.deadLetteredAt || new Date() }); this.records.push(record); return record; }
  list() { return [...this.records].reverse(); }
}
module.exports = { DeadLetterStore, InMemoryDeadLetterStore };
