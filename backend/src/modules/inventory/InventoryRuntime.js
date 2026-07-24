class InventoryRuntime {
  constructor({ service }) { this.service = service; }
  createItem(...args) { return this.service.createItem(...args); }
  createLocation(...args) { return this.service.createLocation(...args); }
  recordMovement(...args) { return this.service.recordMovement(...args); }
  reserve(...args) { return this.service.reserve(...args); }
  consumeReservation(...args) { return this.service.changeReservation(args[0], 'consume', args[1] || {}, args[2] || {}); }
  releaseReservation(...args) { return this.service.changeReservation(args[0], 'release', args[1] || {}, args[2] || {}); }
  listBalances(...args) { return this.service.listBalances(...args); }
  listMovements(...args) { return this.service.listMovements(...args); }
  listReservations(...args) { return this.service.listReservations(...args); }
  listItems(...args) { return this.service.listItems(...args); }
  listLocations(...args) { return this.service.listLocations(...args); }
}
module.exports = { InventoryRuntime };
