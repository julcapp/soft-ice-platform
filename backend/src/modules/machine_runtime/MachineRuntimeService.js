const crypto = require('crypto');
const { MachineRuntimeState: S } = require('./MachineRuntimeState');
const { MachineRuntimeSession, MachineRuntimeSessionStatus } = require('./MachineRuntimeSession');
const { MachineRuntimeTransition } = require('./MachineRuntimeTransition');

class MachineRuntimeService {
  constructor({ repository, policy, eventPublisher, eventMapper, clock = () => new Date(), idFactory = (prefix) => `${prefix}_${crypto.randomUUID()}` }) {
    this.repository = repository; this.policy = policy; this.eventPublisher = eventPublisher; this.eventMapper = eventMapper; this.clock = clock; this.idFactory = idFactory;
  }
  get(machineId) { return this.repository.findMachine(machineId) || { machineId, currentState: S.UNKNOWN, currentSessionId: null, updatedAt: null, dataMode: 'IN_MEMORY_FOUNDATION' }; }
  list() { return this.repository.listMachines(); }
  activeSession(machineId) { return this.repository.findActiveSession(machineId); }
  transitions(machineId) { return this.repository.listTransitions(machineId); }
  signals(machineId) { return this.repository.listSignals(machineId); }
  async startSession(command) {
    const active = this.activeSession(command.machineId); this.policy.assertSessionAllowed(active, command.sessionType);
    const now = this.clock();
    const session = new MachineRuntimeSession({
      sessionId: command.sessionId || this.idFactory('mrs'), machineId: command.machineId, sessionType: command.sessionType,
      status: MachineRuntimeSessionStatus.ACTIVE, startedAt: now, initiatedBy: command.initiatedBy,
      orderId: command.orderId, paymentId: command.paymentId, operatorId: command.operatorId, testRunId: command.testRunId,
      currentState: this.get(command.machineId).currentState, correlationId: command.correlationId,
    });
    this.repository.saveSession(session);
    await this.publish('MACHINE_RUNTIME_SESSION_STARTED', session, command);
    return session;
  }
  async transition(command) {
    const machine = this.get(command.machineId); const session = command.sessionId ? this.repository.findSession(command.sessionId) : this.activeSession(command.machineId);
    const fromState = machine.currentState; const occurredAt = command.occurredAt || this.clock();
    if (!this.policy.canTransition(fromState, command.toState)) {
      await this.publish('MACHINE_RUNTIME_ILLEGAL_TRANSITION_REJECTED', { machineId: command.machineId, sessionId: session?.sessionId, fromState, toState: command.toState, reason: command.reason }, command);
      throw Object.assign(new Error(`Illegal machine runtime transition ${fromState} -> ${command.toState}.`), { code: 'MACHINE_RUNTIME_ILLEGAL_TRANSITION', statusCode: 409, fromState, toState: command.toState });
    }
    const transition = new MachineRuntimeTransition({
      transitionId: command.transitionId || this.idFactory('mrt'), machineId: command.machineId, sessionId: session?.sessionId || command.sessionId || null,
      fromState, toState: command.toState, reason: command.reason, actorType: command.actorType, actorId: command.actorId,
      occurredAt, correlationId: command.correlationId, causationId: command.causationId, source: command.source, metadata: command.metadata || {},
    });
    this.repository.appendTransition(transition);
    this.repository.saveMachine({ machineId: command.machineId, currentState: command.toState, currentSessionId: session?.sessionId || null, latestTransition: transition, updatedAt: occurredAt, dataMode: command.dataMode || 'IN_MEMORY_FOUNDATION' });
    if (session) { session.currentState = command.toState; session.transitionHistory.push(transition.transitionId); this.repository.saveSession(session); }
    for (const event of this.eventMapper.transitionEvents(transition)) await this.eventPublisher.publish(event);
    return transition;
  }
  async completeSession(sessionId, command = {}) {
    const session = this.repository.findSession(sessionId); if (!session) throw Object.assign(new Error('Runtime session was not found.'), { code: 'MACHINE_RUNTIME_SESSION_NOT_FOUND', statusCode: 404 });
    session.status = command.failed ? MachineRuntimeSessionStatus.FAILED : MachineRuntimeSessionStatus.COMPLETED;
    session.completedAt = this.clock(); session.failureReason = command.failureReason || null; this.repository.saveSession(session);
    await this.publish(command.failed ? 'MACHINE_RUNTIME_SESSION_FAILED' : 'MACHINE_RUNTIME_SESSION_COMPLETED', session, { ...command, correlationId: command.correlationId || session.correlationId });
    return session;
  }
  async acceptSignal(signal) {
    this.repository.appendSignal(signal.machineId, signal);
    const target = { MACHINE_CONNECTED: S.BOOTING, MACHINE_DISCONNECTED: S.OFFLINE, CUP_SENSOR_CONFIRMED: S.PRODUCT_DISPENSING, CUP_SENSOR_FAILED: S.ERROR, PRODUCT_FLOW_CONFIRMED: S.TOPPING_DISPENSING, PRODUCT_FLOW_FAILED: S.ERROR, TOPPING_FLOW_CONFIRMED: S.COMPLETING, TOPPING_FLOW_FAILED: S.ERROR, DEVICE_ERROR: S.ERROR, DEVICE_RECOVERED: S.RECOVERING }[signal.signalType];
    return target ? this.transition({ ...signal, toState: target, reason: signal.reason || signal.signalType, actorType: signal.actorType || 'MACHINE', actorId: signal.actorId || signal.machineId, source: signal.source || 'MACHINE_GATEWAY' }) : null;
  }
  publish(eventType, aggregate, command) {
    const payload = typeof structuredClone === 'function' ? structuredClone(aggregate) : JSON.parse(JSON.stringify(aggregate));
    return this.eventPublisher.publish({ eventType, eventVersion: 1, occurredAt: this.clock(), aggregateType: 'MACHINE_RUNTIME', aggregateId: aggregate.machineId, actorType: command.actorType || aggregate.initiatedBy?.actorType || 'SYSTEM', actorId: command.actorId || aggregate.initiatedBy?.actorId || 'machine-runtime', sourceChannel: command.source || 'MACHINE_RUNTIME', correlationId: command.correlationId || aggregate.correlationId, causationId: command.causationId || null, payload, metadata: {} });
  }
}
module.exports = { MachineRuntimeService };
