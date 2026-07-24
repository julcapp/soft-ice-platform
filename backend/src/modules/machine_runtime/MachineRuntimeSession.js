const MachineRuntimeSessionType = Object.freeze(Object.fromEntries(['CUSTOMER_PURCHASE','OPERATOR_TEST','MAINTENANCE','CLEANING','CALIBRATION','RECOVERY'].map((v) => [v, v])));
const MachineRuntimeSessionStatus = Object.freeze({ ACTIVE: 'ACTIVE', COMPLETED: 'COMPLETED', FAILED: 'FAILED' });
class MachineRuntimeSession {
  constructor(value) {
    Object.assign(this, {
      completedAt: null, orderId: null, paymentId: null, operatorId: null, testRunId: null,
      transitionHistory: [], failureReason: null, ...value,
    });
  }
}
module.exports = { MachineRuntimeSession, MachineRuntimeSessionType, MachineRuntimeSessionStatus };
