const MACHINE_TWIN_STATUS = Object.freeze({
  ONLINE: 'ONLINE', OFFLINE: 'OFFLINE', DEGRADED: 'DEGRADED', MAINTENANCE: 'MAINTENANCE',
  TEST_MODE: 'TEST_MODE', ERROR: 'ERROR', UNKNOWN: 'UNKNOWN',
});
const COMPONENT_STATUS = Object.freeze({
  HEALTHY: 'HEALTHY', WARNING: 'WARNING', CRITICAL: 'CRITICAL',
  OFFLINE: 'OFFLINE', MAINTENANCE: 'MAINTENANCE', UNKNOWN: 'UNKNOWN',
});
const FRESHNESS_STATUS = Object.freeze({
  LIVE: 'LIVE', FRESH: 'FRESH', STALE: 'STALE', EXPIRED: 'EXPIRED',
  UNAVAILABLE: 'UNAVAILABLE', DEMO: 'DEMO',
});
const COMPONENT_TYPE = Object.freeze(Object.fromEntries([
  'CUP_DISPENSER', 'MIX_TANK', 'MIXER', 'PUMP', 'COOLING_SYSTEM', 'COMPRESSOR',
  'SYRUP_MODULE', 'TOPPING_MODULE', 'PAYMENT_TERMINAL', 'TOUCH_SCREEN',
  'DISPENSE_ZONE', 'SERVICE_DOOR', 'NETWORK_MODULE', 'LIGHTING', 'CAMERA',
  'CONTROLLER', 'OTHER',
].map((value) => [value, value])));
const LIFECYCLE_STATE = Object.freeze({
  INSTALLED: 'INSTALLED', ACTIVE: 'ACTIVE', SERVICE_DUE: 'SERVICE_DUE',
  RETIRED: 'RETIRED', UNKNOWN: 'UNKNOWN',
});
const SOURCE_STATE = Object.freeze({
  AVAILABLE: 'AVAILABLE', FOUNDATION_ONLY: 'FOUNDATION_ONLY',
  BLOCKED_EXTERNAL: 'BLOCKED_EXTERNAL', UNAVAILABLE: 'UNAVAILABLE', DEMO: 'DEMO',
});

function immutable(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(immutable);
  return Object.freeze(value);
}

class TwinDataFreshness {
  constructor({ status, observedAt = null, ageSeconds = null, explanation, dataMode = 'LIVE' }) {
    this.status = status; this.observedAt = observedAt; this.ageSeconds = ageSeconds;
    this.explanation = explanation; this.dataMode = dataMode;
    immutable(this);
  }
}

class ComponentHealth {
  constructor({ score, status, factors }) {
    this.score = score; this.status = status; this.factors = factors;
    immutable(this);
  }
}

class ComponentLifecycle {
  constructor({ state = LIFECYCLE_STATE.UNKNOWN, installedAt = null, lastServiceAt = null, expectedServiceAt = null }) {
    this.state = state; this.installedAt = installedAt; this.lastServiceAt = lastServiceAt;
    this.expectedServiceAt = expectedServiceAt;
    immutable(this);
  }
}

class MachineTwinComponent {
  constructor(value) { Object.assign(this, value); immutable(this); }
}
class MachineTwinState {
  constructor(value) { Object.assign(this, value); immutable(this); }
}
class MachineTwin {
  constructor(value) { Object.assign(this, value); immutable(this); }
}
class MachineTwinSnapshot {
  constructor(value) { Object.assign(this, value); immutable(this); }
}
class MachineTwinEvent {
  constructor(value) { Object.assign(this, value); immutable(this); }
}

module.exports = {
  COMPONENT_STATUS, COMPONENT_TYPE, FRESHNESS_STATUS, LIFECYCLE_STATE,
  MACHINE_TWIN_STATUS, SOURCE_STATE, ComponentHealth, ComponentLifecycle,
  MachineTwin, MachineTwinComponent, MachineTwinEvent, MachineTwinSnapshot,
  MachineTwinState, TwinDataFreshness, immutable,
};
