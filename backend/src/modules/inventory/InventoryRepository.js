const crypto = require('crypto');

class InMemoryInventoryRepository {
  constructor() {
    this.items = new Map(); this.locations = new Map(); this.movements = [];
    this.reservations = new Map(); this.idempotency = new Map();
  }
  async executeIdempotent(key, fingerprint, operation) {
    const existing = this.idempotency.get(key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw conflict('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was reused with a different request.');
      return { ...existing.result, idempotentReplay: true };
    }
    const result = await operation();
    this.idempotency.set(key, { fingerprint, result });
    return result;
  }
  async createItem(data) { const row = stamp({ id: data.id || `inv_item_${crypto.randomUUID()}`, active: true, ...data }); this.items.set(row.id, row); return row; }
  async findItem(id) { return this.items.get(id) || null; }
  async listItems() { return [...this.items.values()]; }
  async createLocation(data) { const row = stamp({ id: data.id || `inv_location_${crypto.randomUUID()}`, active: true, ...data }); this.locations.set(row.id, row); return row; }
  async findLocation(id) { return this.locations.get(id) || null; }
  async listLocations() { return [...this.locations.values()]; }
  async appendMovement(data) { const row = { id: `inv_movement_${crypto.randomUUID()}`, ...data, recordedAt: new Date() }; this.movements.push(row); return row; }
  async listMovements(filters = {}) { return this.movements.filter((row) => match(row, filters)).sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)); }
  async createReservation(data) { const row = stamp({ id: `inv_reservation_${crypto.randomUUID()}`, ...data }); this.reservations.set(row.id, row); return row; }
  async findReservation(id) { return this.reservations.get(id) || null; }
  async updateReservation(id, data) { const row = { ...this.reservations.get(id), ...data, updatedAt: new Date() }; this.reservations.set(id, row); return row; }
  async listReservations(filters = {}) { return [...this.reservations.values()].filter((row) => match(row, filters)); }
}

function match(row, filters) { return Object.entries(filters).every(([key, value]) => value === undefined || value === null || row[key] === value); }
function stamp(row) { const now = new Date(); return { ...row, createdAt: now, updatedAt: now }; }
function conflict(code, message) { const error = new Error(message); error.code = code; error.statusCode = 409; return error; }

module.exports = { InMemoryInventoryRepository };
