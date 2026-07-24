class MaintenanceRuntime {
  constructor({ service }) { this.service = service; }
}
for (const method of ['createPlan','identifyMachine','openSession','completeChecklistItem','attachPhoto','replaceConsumable','recordTestDispense','submit','approve','reject','listSessions','getSession','getProjection']) {
  MaintenanceRuntime.prototype[method] = function (...args) { return this.service[method](...args); };
}
module.exports = { MaintenanceRuntime };
