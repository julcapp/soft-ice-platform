class TelemetryStore {
  constructor({ limit = 100, clock = () => new Date() } = {}) { this.limit = limit; this.clock = clock; this.samples = []; }
  record(sample) { const normalized = { machineId: sample.machineId || null, recordedAt: sample.timestamp || this.clock().toISOString(), receivedAt: this.clock().toISOString(), values: { ...(sample.values || {}) } }; this.samples.unshift(normalized); this.samples.length = Math.min(this.samples.length, this.limit); return normalized; }
  snapshot() { return this.samples.map((sample) => ({ ...sample, values: { ...sample.values } })); }
}
module.exports = { TelemetryStore };
