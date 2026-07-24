class MachineRuntimeTransition { constructor(value) { Object.assign(this, { causationId: null, metadata: {}, ...value }); Object.freeze(this.metadata); Object.freeze(this); } }
module.exports = { MachineRuntimeTransition };
