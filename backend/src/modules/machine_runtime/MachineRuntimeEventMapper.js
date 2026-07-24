const EVENT_BY_STATE = Object.freeze({
  CUSTOMER_SESSION: 'CUSTOMER_SESSION_STARTED', PAYMENT_PENDING: 'PAYMENT_WAIT_STARTED',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED_FOR_MACHINE', DISPENSE_AUTHORIZED: 'DISPENSE_AUTHORIZED',
  CUP_DISPENSING: 'CUP_DISPENSE_STARTED', PRODUCT_DISPENSING: 'PRODUCT_DISPENSE_STARTED',
  TOPPING_DISPENSING: 'TOPPING_DISPENSE_STARTED', COMPLETED: 'MACHINE_CYCLE_COMPLETED',
  ERROR: 'MACHINE_RUNTIME_ERROR_ENTERED', RECOVERING: 'MACHINE_RUNTIME_RECOVERY_STARTED',
  TEST_MODE: 'MACHINE_TEST_MODE_ENTERED', MAINTENANCE: 'MACHINE_MAINTENANCE_STARTED',
});
class MachineRuntimeEventMapper {
  transitionEvents(transition) {
    const common = { aggregateType: 'MACHINE_RUNTIME', aggregateId: transition.machineId, actorType: transition.actorType, actorId: transition.actorId, sourceChannel: transition.source, correlationId: transition.correlationId, causationId: transition.causationId, payload: { transitionId: transition.transitionId, sessionId: transition.sessionId, fromState: transition.fromState, toState: transition.toState, reason: transition.reason, ...transition.metadata }, metadata: {} };
    const events = [{ ...common, eventType: 'MACHINE_RUNTIME_STATE_CHANGED', eventVersion: 1, occurredAt: transition.occurredAt }];
    if (EVENT_BY_STATE[transition.toState]) events.push({ ...common, eventType: EVENT_BY_STATE[transition.toState], eventVersion: 1, occurredAt: transition.occurredAt });
    const completedStep = {
      'CUP_DISPENSING:PRODUCT_DISPENSING': 'CUP_DISPENSE_COMPLETED',
      'PRODUCT_DISPENSING:TOPPING_DISPENSING': 'PRODUCT_DISPENSE_COMPLETED',
      'TOPPING_DISPENSING:COMPLETING': 'TOPPING_DISPENSE_COMPLETED',
    }[`${transition.fromState}:${transition.toState}`];
    if (completedStep) events.push({ ...common, eventType: completedStep, eventVersion: 1, occurredAt: transition.occurredAt });
    if (transition.fromState === 'ERROR' && transition.toState === 'RECOVERING') events.push({ ...common, eventType: 'MACHINE_RUNTIME_RECOVERY_STARTED', eventVersion: 1 });
    if (transition.fromState === 'RECOVERING' && transition.toState === 'READY') events.push({ ...common, eventType: 'MACHINE_RUNTIME_RECOVERED', eventVersion: 1 });
    if (transition.fromState === 'TEST_MODE' && transition.toState === 'READY') events.push({ ...common, eventType: 'MACHINE_TEST_MODE_EXITED', eventVersion: 1 });
    if (transition.fromState === 'MAINTENANCE' && transition.toState === 'READY') events.push({ ...common, eventType: 'MACHINE_MAINTENANCE_COMPLETED', eventVersion: 1 });
    return events;
  }
}
module.exports = { MachineRuntimeEventMapper };
