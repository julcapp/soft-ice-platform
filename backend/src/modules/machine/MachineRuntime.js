class MachineRuntime {
  constructor({ machineService }) {
    this.machineService = machineService;
  }

  async registerMachine(request, context) {
    return this.machineService.registerMachine(request, context);
  }

  async getMachine(machineId) {
    return this.machineService.getMachine(machineId);
  }

  async getOwnOrderDispense(customerId, orderId) {
    return this.machineService.getOwnOrderDispense(customerId, orderId);
  }

  async requestDispenseForPaidOrder(order, context) {
    throw legacyDisabled();
  }

  async receiveDispenseCommand(dispenseRequestId, context) {
    throw legacyDisabled();
  }

  async completeDispense(dispenseRequestId, context) {
    throw legacyDisabled();
  }

  async failDispense(dispenseRequestId, reasonCode, context) {
    throw legacyDisabled();
  }
}

function legacyDisabled() {
  return Object.assign(new Error('Legacy DispenseRequest доступен только для чтения; физической выдачей владеет MachineDispenseService.'), { code: 'LEGACY_DISPENSE_RUNTIME_DISABLED', statusCode: 410 });
}

module.exports = {
  MachineRuntime,
};
