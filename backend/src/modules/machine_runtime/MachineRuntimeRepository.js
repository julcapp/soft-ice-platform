class MachineRuntimeRepository {
  findMachine() { throw new Error('findMachine must be implemented.'); } saveMachine() { throw new Error('saveMachine must be implemented.'); }
  findActiveSession() { throw new Error('findActiveSession must be implemented.'); } saveSession() { throw new Error('saveSession must be implemented.'); }
}
class InMemoryMachineRuntimeRepository extends MachineRuntimeRepository {
  constructor() { super(); this.machines = new Map(); this.sessions = new Map(); this.transitions = []; this.signals = new Map(); }
  findMachine(machineId) { return this.machines.get(machineId) || null; }
  saveMachine(machine) { this.machines.set(machine.machineId, machine); return machine; }
  findActiveSession(machineId) { return [...this.sessions.values()].find((s) => s.machineId === machineId && s.status === 'ACTIVE') || null; }
  findSession(sessionId) { return this.sessions.get(sessionId) || null; }
  saveSession(session) { this.sessions.set(session.sessionId, session); return session; }
  appendTransition(transition) { this.transitions.push(transition); return transition; }
  listTransitions(machineId) { return this.transitions.filter((t) => !machineId || t.machineId === machineId).reverse(); }
  listMachines() { return [...this.machines.values()]; }
  appendSignal(machineId, signal) { const list = this.signals.get(machineId) || []; list.push(Object.freeze({ ...signal })); this.signals.set(machineId, list.slice(-50)); }
  listSignals(machineId) { return [...(this.signals.get(machineId) || [])].reverse(); }
}
module.exports = { MachineRuntimeRepository, InMemoryMachineRuntimeRepository };
