class PaymentAdapter { pay() { throw new Error('PaymentAdapter.pay не реализован.'); } }
class SimulatorPaymentAdapter extends PaymentAdapter {
  constructor({ outcome = 'PAID' } = {}) { super(); this.outcome = outcome; }
  async pay(request) {
    const status = request.simulatedOutcome || this.outcome;
    if (!['PAID', 'DECLINED', 'TIMEOUT', 'CANCELLED'].includes(status)) throw new TypeError('Неизвестный результат симулятора оплаты.');
    return { paymentId: `sim_payment_${request.orderId}`, provider: 'SIMULATOR', status, confirmedAt: status === 'PAID' ? new Date() : null };
  }
}
class MachineAdapter { dispense() { throw new Error('MachineAdapter.dispense не реализован.'); } }
class SimulatorMachineAdapter extends MachineAdapter {
  constructor({ outcome = 'DISPENSED' } = {}) { super(); this.outcome = outcome; }
  async dispense(request) {
    const status = request.simulatedOutcome || this.outcome;
    if (!['ACCEPTED', 'DISPENSING', 'DISPENSED', 'FAILED', 'TIMEOUT', 'OFFLINE', 'UNAVAILABLE', 'BUSY'].includes(status)) throw new TypeError('Неизвестный результат симулятора аппарата.');
    return { commandId: `sim_dispense_${request.orderId}`, status };
  }
}
module.exports = { PaymentAdapter, SimulatorPaymentAdapter, MachineAdapter, SimulatorMachineAdapter };
