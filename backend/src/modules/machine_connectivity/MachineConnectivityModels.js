const TARIFF_STATUSES = Object.freeze(['ACTIVE', 'SUSPENDED', 'BLOCKED', 'EXPIRED', 'UNKNOWN']);
const CONNECTIVITY_SOURCES = Object.freeze(['OFFICIAL_API', 'OPERATOR_PORTAL', 'MANUAL', 'IMPORT', 'UNKNOWN']);
const CONNECTIVITY_VERIFICATION = Object.freeze(['VERIFIED', 'MANUAL', 'STALE', 'UNAVAILABLE', 'UNKNOWN']);
class MachineConnectivityProfile { constructor(data) { Object.assign(this, data); } }
class MachineSimCard { constructor(data) { Object.assign(this, data); } }
class MachineMobilePlan { constructor(data) { Object.assign(this, data); } }
class MachineConnectivitySnapshot { constructor(data) { Object.assign(this, data); Object.freeze(this); } }
class MachineConnectivityEvent { constructor(data) { Object.assign(this, data); Object.freeze(this); } }
module.exports = { TARIFF_STATUSES, CONNECTIVITY_SOURCES, CONNECTIVITY_VERIFICATION, MachineConnectivityProfile, MachineSimCard, MachineMobilePlan, MachineConnectivitySnapshot, MachineConnectivityEvent };
