class MachineOperationsRuntime {
  constructor({ service }) { this.service = service; }
}

for (const method of ['createOperator','configureChecklist','createMaintenanceTask','executeMaintenanceTask','performTestRun','recordConsumption','submitServiceReport','approveServiceReport','attachPhotoEvidence','listOperatorActions','manageMachineSetting']) {
  MachineOperationsRuntime.prototype[method] = function (...args) { return this.service[method](...args); };
}

module.exports = { MachineOperationsRuntime };
