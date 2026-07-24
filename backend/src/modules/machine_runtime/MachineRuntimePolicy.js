const { MachineRuntimeState: S } = require('./MachineRuntimeState');
const PATH = [[S.UNKNOWN,S.OFFLINE],[S.OFFLINE,S.BOOTING],[S.BOOTING,S.IDLE],[S.IDLE,S.READY],[S.READY,S.CUSTOMER_SESSION],[S.CUSTOMER_SESSION,S.ORDER_PENDING],[S.ORDER_PENDING,S.PAYMENT_PENDING],[S.PAYMENT_PENDING,S.PAYMENT_CONFIRMED],[S.PAYMENT_CONFIRMED,S.DISPENSE_AUTHORIZED],[S.DISPENSE_AUTHORIZED,S.CUP_DISPENSING],[S.CUP_DISPENSING,S.PRODUCT_DISPENSING],[S.PRODUCT_DISPENSING,S.TOPPING_DISPENSING],[S.TOPPING_DISPENSING,S.COMPLETING],[S.COMPLETING,S.COMPLETED],[S.COMPLETED,S.READY]];
const INTERRUPTS = [S.ERROR,S.MAINTENANCE,S.TEST_MODE,S.OUT_OF_SERVICE,S.OFFLINE];
const RECOVERY = [[S.ERROR,S.RECOVERING],[S.RECOVERING,S.READY],[S.RECOVERING,S.MAINTENANCE],[S.TEST_MODE,S.READY],[S.MAINTENANCE,S.READY],[S.CLEANING,S.READY],[S.IDLE,S.CLEANING],[S.IDLE,S.MAINTENANCE],[S.IDLE,S.TEST_MODE],[S.READY,S.SHUTTING_DOWN],[S.SHUTTING_DOWN,S.OFFLINE]];
class MachineRuntimePolicy {
  constructor(config = {}) {
    this.config = Object.freeze({
      transitionTimeoutsMs: { default: 60000, PAYMENT_PENDING: 300000, ...config.transitionTimeoutsMs },
      retryCounts: { eventDelivery: 3, recovery: 2, ...config.retryCounts },
      recoveryLimit: config.recoveryLimit ?? 2, eventDeliveryAttempts: config.eventDeliveryAttempts ?? 3,
      deadLetterThreshold: config.deadLetterThreshold ?? 3,
      sessionConflictRules: { allowConcurrent: false, permittedPairs: [], ...config.sessionConflictRules },
    });
    this.transitions = new Set([...PATH, ...RECOVERY].map(([a,b]) => `${a}:${b}`));
    Object.values(S).forEach((state) => INTERRUPTS.forEach((target) => { if (state !== target && ![S.COMPLETED].includes(state)) this.transitions.add(`${state}:${target}`); }));
  }
  canTransition(from, to) { return this.transitions.has(`${from}:${to}`); }
  assertSessionAllowed(active, requestedType) {
    if (!active) return;
    const pair = `${active.sessionType}:${requestedType}`;
    if (!this.config.sessionConflictRules.allowConcurrent && !this.config.sessionConflictRules.permittedPairs.includes(pair)) {
      throw Object.assign(new Error(`Machine already has active ${active.sessionType} session.`), { code: 'MACHINE_RUNTIME_SESSION_CONFLICT', statusCode: 409 });
    }
  }
}
module.exports = { MachineRuntimePolicy, TRANSITION_PATH: PATH };
