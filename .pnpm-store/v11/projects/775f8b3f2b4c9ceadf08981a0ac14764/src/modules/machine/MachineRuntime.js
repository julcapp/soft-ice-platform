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
    return this.machineService.requestDispenseForPaidOrder(order, context);
  }

  async receiveDispenseCommand(dispenseRequestId, context) {
    return this.machineService.receiveDispenseCommand(dispenseRequestId, context);
  }

  async completeDispense(dispenseRequestId, context) {
    return this.machineService.completeDispense(dispenseRequestId, context);
  }

  async failDispense(dispenseRequestId, reasonCode, context) {
    return this.machineService.failDispense(dispenseRequestId, reasonCode, context);
  }
}

module.exports = {
  MachineRuntime,
};
