class MachineRuntimeProjectionAdapter {
  constructor({ twinRepository, clock = () => new Date() } = {}) { this.twinRepository = twinRepository; this.clock = clock; this.projections = new Map(); }
  subscriber() {
    return { subscriberId: 'digital-twin.machine-runtime-projection.v1', order: 200, handler: async (event) => {
      const current = this.projections.get(event.aggregateId) || { machineId: event.aggregateId, recentEvents: [], activeFaults: [] };
      const projection = { ...current, operationalStatus: normalize(event.payload.toState), currentRuntimeState: event.payload.toState || current.currentRuntimeState, currentSession: event.payload.sessionId || current.currentSession, recentEvents: [event, ...current.recentEvents].slice(0, 50), lastUpdatedAt: this.clock(), freshness: 'LIVE' };
      if (event.eventType === 'MACHINE_RUNTIME_ERROR_ENTERED') projection.activeFaults = [{ code: event.payload.reason || 'RUNTIME_ERROR', occurredAt: event.occurredAt }, ...projection.activeFaults];
      if (event.eventType === 'MACHINE_RUNTIME_RECOVERED') projection.activeFaults = [];
      this.projections.set(event.aggregateId, Object.freeze(projection));
    } };
  }
  get(machineId) { return this.projections.get(machineId) || null; }
}
function normalize(state) { return state === 'ERROR' ? 'ERROR' : state === 'OFFLINE' ? 'OFFLINE' : ['MAINTENANCE','TEST_MODE'].includes(state) ? state : 'ONLINE'; }
module.exports = { MachineRuntimeProjectionAdapter };
