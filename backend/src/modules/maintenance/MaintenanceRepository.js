const crypto = require('crypto');

class InMemoryMaintenanceRepository {
  constructor() {
    this.plans = new Map(); this.sessions = new Map(); this.machineQr = new Map();
    this.audit = []; this.idempotency = new Map(); this.sequence = 0;
  }
  id(prefix) { this.sequence += 1; return `${prefix}_${this.sequence}`; }
  savePlan(value) { const row = Object.freeze({ ...value, id: value.id || this.id('maintenance_plan') }); this.plans.set(row.id, row); return row; }
  findPlan(id) { return this.plans.get(id) || null; }
  listPlans(filters = {}) { return [...this.plans.values()].filter((p) => !filters.machineId || p.machineIds.includes(filters.machineId)); }
  saveSession(value) { const row = Object.freeze(structuredClone(value)); this.sessions.set(row.id, row); return row; }
  findSession(id) { return this.sessions.get(id) || null; }
  listSessions(filters = {}) {
    return [...this.sessions.values()].filter((s) => (!filters.machineId || s.machineId === filters.machineId) && (!filters.status || s.status === filters.status));
  }
  registerMachine(machine) { this.machineQr.set(machine.qrCode, Object.freeze({ ...machine })); return machine; }
  identifyMachine(qrCode) { return this.machineQr.get(qrCode) || null; }
  appendAudit(entry) { const row = Object.freeze({ ...structuredClone(entry), id: entry.id || this.id('maintenance_audit') }); this.audit.push(row); return row; }
  listAudit(sessionId) { return this.audit.filter((row) => !sessionId || row.sessionId === sessionId); }
  async idempotent(scope, key, input, callback) {
    const fingerprint = crypto.createHash('sha256').update(stable(input)).digest('hex');
    const composite = `${scope}:${key}`; const prior = this.idempotency.get(composite);
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw conflict('MAINTENANCE_IDEMPOTENCY_CONFLICT', 'Idempotency key was reused with different input.');
      return prior.result;
    }
    const result = await callback(); this.idempotency.set(composite, { fingerprint, result }); return result;
  }
}
function stable(value) { if (Array.isArray(value)) return `[${value.map(stable)}]`; if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((k) => `${k}:${stable(value[k])}`).join(',')}}`; return JSON.stringify(value); }
function conflict(code, message) { return Object.assign(new Error(message), { code, statusCode: 409 }); }
module.exports = { InMemoryMaintenanceRepository };
