class OperatorWorkspaceRuntime {
  constructor({ service }) { this.service = service; }
}

for (const method of ['listMachines', 'getMachine', 'openSession', 'updateChecklist', 'attachPhoto', 'performTest', 'recordConsumption', 'completeSession', 'getSession', 'listActions', 'getTwinSummary']) {
  OperatorWorkspaceRuntime.prototype[method] = function (...args) { return this.service[method](...args); };
}

module.exports = { OperatorWorkspaceRuntime };
