class MachineConnectivityRepository {
  constructor() { this.simCards = new Map(); this.plans = new Map(); this.events = []; }
  getSim(machineId) { return this.simCards.get(machineId) || null; }
  getPlan(machineId) { return this.plans.get(machineId) || null; }
  saveSim(value) { this.simCards.set(value.machineId, value); return value; }
  savePlan(value) { this.plans.set(value.machineId, value); return value; }
  appendEvent(value) { this.events.push(value); return value; }
  history(machineId) { return this.events.filter((x) => x.machineId === machineId).sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)); }
}
module.exports = { MachineConnectivityRepository };
