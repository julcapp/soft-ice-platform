const { ApiError } = require('../../platform/errors/ApiError');
const { ComponentHealthService } = require('./ComponentHealthService');
const {
  COMPONENT_TYPE, FRESHNESS_STATUS, MACHINE_TWIN_STATUS, SOURCE_STATE,
  ComponentLifecycle, MachineTwin, MachineTwinComponent, MachineTwinEvent,
  MachineTwinSnapshot, MachineTwinState, TwinDataFreshness,
} = require('./MachineTwinModels');

const REQUIRED_ROLES = Object.freeze(['PLATFORM_OWNER', 'ADMIN']);
const SOURCE_NAMES = Object.freeze([
  'machineIdentity', 'telemetry', 'machineOperations', 'inventory', 'orders',
  'payments', 'productCatalog', 'advertising', 'simulator',
]);

class MachineTwinProjectionService {
  constructor({ sources = {}, repository, healthService = new ComponentHealthService(), clock = () => new Date(), dataMode = 'LIVE' }) {
    this.sources = sources; this.repository = repository; this.healthService = healthService;
    this.clock = clock; this.dataMode = dataMode;
  }

  authorize(context) {
    const roles = context?.roles || [];
    if (!roles.some((role) => REQUIRED_ROLES.includes(role))) {
      throw new ApiError({ statusCode: 403, code: 'MACHINE_TWIN_READ_FORBIDDEN', message: 'Machine Twin access requires ADMIN or PLATFORM_OWNER.', source: 'api' });
    }
  }

  async list(context) {
    this.authorize(context);
    const machines = await this.readSource('machineIdentity', 'listMachines', []);
    return Promise.all(machines.map((machine) => this.project(machine, context)));
  }

  async get(machineId, context) {
    this.authorize(context);
    const machine = await this.readSource('machineIdentity', 'getMachine', null, machineId);
    if (!machine) throw new ApiError({ statusCode: 404, code: 'MACHINE_TWIN_NOT_FOUND', message: 'Machine Twin was not found.', source: 'runtime' });
    return this.project(machine, context);
  }

  async project(machine, context) {
    this.authorize(context);
    const now = this.clock();
    const [telemetry, operations, inventory, orders, payments, catalog, advertising] = await Promise.all([
      this.readSource('telemetry', 'getTelemetry', null, machine.id),
      this.readSource('machineOperations', 'getSummary', null, machine.id),
      this.readSource('inventory', 'getSummary', null, machine.id),
      this.readSource('orders', 'getRecentSales', null, machine.id),
      this.readSource('payments', 'getActivePrice', null, machine.id),
      this.readSource('productCatalog', 'getCurrentMenu', null, machine.id),
      this.readSource('advertising', 'getActivePlacement', null, machine.id),
    ]);
    const sourceStatus = this.buildSourceStatus();
    const observedAt = telemetry?.observedAt || telemetry?.recordedAt || null;
    const freshness = calculateFreshness(observedAt, now, this.dataMode);
    const components = (telemetry?.components || defaultComponents(machine.id)).map((item) => this.toComponent(machine.id, item, freshness, operations, now));
    const operationalStatus = normalizeMachineStatus(machine.status, telemetry, operations);
    const twin = new MachineTwin({
      machineId: machine.id, externalMachineId: machine.machineCode || machine.externalMachineId || null,
      name: machine.name, model: machine.model || null, serialNumber: machine.serialNumber || null,
      location: machine.location || null, operationalStatus,
      connectivityStatus: freshness.status === FRESHNESS_STATUS.EXPIRED ? 'OFFLINE' : telemetry?.connectivityStatus || machine.status || 'UNKNOWN',
      lastHeartbeatAt: telemetry?.lastHeartbeatAt || observedAt, lastTelemetryAt: observedAt,
      lastUpdatedAt: now.toISOString(), freshness, currentMenu: catalog,
      activePrice: payments, activeAdvertisingPlacement: advertising,
      assignedOperator: operations?.assignedOperator || null,
      openServiceTasks: operations?.openServiceTasks || [],
      activeFaults: telemetry?.activeFaults || [],
      recentSalesSummary: orders || unavailableSummary('orders'),
      inventorySummary: inventory || unavailableSummary('inventory'),
      maintenanceSummary: operations?.maintenanceSummary || unavailableSummary('machineOperations'),
      recentTestRuns: operations?.recentTestRuns || [],
      predictionSummary: buildPrediction(inventory),
      sourceStatus, components, dataMode: this.dataMode,
      generatedAt: now.toISOString(), source: this.dataMode === 'DEMO' ? 'Machine Simulator' : 'Machine Twin Projection',
    });
    this.capture(twin, now);
    return twin;
  }

  toComponent(machineId, item, freshness, operations, now) {
    const expectedServiceAt = item.expectedServiceAt || null;
    const health = this.healthService.calculate({
      activeCriticalFault: item.activeFaults?.some((fault) => fault.severity === 'CRITICAL'),
      activeWarningFault: item.activeFaults?.some((fault) => fault.severity === 'WARNING'),
      staleTelemetry: [FRESHNESS_STATUS.STALE, FRESHNESS_STATUS.EXPIRED, FRESHNESS_STATUS.UNAVAILABLE].includes(freshness.status),
      offline: item.status === 'OFFLINE', overdueMaintenance: expectedServiceAt && new Date(expectedServiceAt) < now,
      recentFailedTest: operations?.recentTestRuns?.some((run) => run.componentId === item.componentId && run.status === 'FAILED'),
    });
    return new MachineTwinComponent({
      componentId: item.componentId, machineId, componentType: COMPONENT_TYPE[item.componentType] || COMPONENT_TYPE.OTHER,
      displayName: item.displayName || item.componentType, vendorReference: item.vendorReference || null,
      status: health.status, healthScore: health.score, healthFactors: health.factors,
      installedAt: item.installedAt || null, lastServiceAt: item.lastServiceAt || null, expectedServiceAt,
      operatingHours: item.operatingHours ?? null, usageCounter: item.usageCounter ?? null,
      lifecycleState: item.lifecycleState || 'UNKNOWN', lifecycle: new ComponentLifecycle({
        state: item.lifecycleState, installedAt: item.installedAt, lastServiceAt: item.lastServiceAt, expectedServiceAt,
      }),
      activeFaults: item.activeFaults || [], telemetrySummary: item.telemetrySummary || {},
      maintenanceHistorySummary: item.maintenanceHistorySummary || null,
      recentEvents: item.recentEvents || [], metadata: item.metadata || {},
    });
  }

  capture(twin, now) {
    if (!this.repository) return;
    const timestamp = now.toISOString();
    const snapshot = new MachineTwinSnapshot({
      snapshotId: `twin_snapshot_${twin.machineId}_${now.getTime()}`, machineId: twin.machineId,
      generatedAt: timestamp, sourceFreshness: twin.freshness,
      machineState: new MachineTwinState({ operationalStatus: twin.operationalStatus, connectivityStatus: twin.connectivityStatus }),
      componentStates: twin.components, inventorySummary: twin.inventorySummary,
      operationalSummary: { assignedOperator: twin.assignedOperator, openServiceTasks: twin.openServiceTasks },
      faultSummary: { active: twin.activeFaults }, maintenanceSummary: twin.maintenanceSummary,
      metadata: { dataMode: twin.dataMode, projectionVersion: 1 },
    });
    this.repository.appendSnapshot(snapshot);
    this.repository.appendEvent(new MachineTwinEvent({
      eventId: `twin_event_${twin.machineId}_${now.getTime()}`, eventType: 'TWIN_SNAPSHOT_CREATED',
      eventVersion: 1, canonicalName: 'MachineTwin.SnapshotCreated', category: 'projection',
      machineId: twin.machineId, occurredAt: timestamp, payload: { snapshotId: snapshot.snapshotId },
      metadata: { source: 'machine_digital_twin', dataMode: twin.dataMode },
    }));
  }

  components(machineId, context) { return this.get(machineId, context).then((twin) => twin.components); }
  events(machineId, context) { this.authorize(context); return Promise.resolve(this.repository?.listEvents(machineId) || []); }
  snapshots(machineId, context) { this.authorize(context); return Promise.resolve(this.repository?.listSnapshots(machineId) || []); }
  health(machineId, context) {
    return this.get(machineId, context).then((twin) => ({
      machineId, status: twin.operationalStatus,
      score: twin.components.length ? Math.round(twin.components.reduce((sum, item) => sum + item.healthScore, 0) / twin.components.length) : null,
      components: twin.components.map(({ componentId, displayName, status, healthScore, healthFactors }) => ({ componentId, displayName, status, healthScore, factors: healthFactors })),
      freshness: twin.freshness, generatedAt: twin.generatedAt, dataMode: twin.dataMode,
    }));
  }

  async readSource(name, method, fallback, ...args) {
    const adapter = this.sources[name];
    if (!adapter || typeof adapter[method] !== 'function') return fallback;
    return adapter[method](...args);
  }

  buildSourceStatus() {
    return Object.fromEntries(SOURCE_NAMES.map((name) => {
      const adapter = this.sources[name];
      return [name, {
        status: this.dataMode === 'DEMO' && name === 'simulator' ? SOURCE_STATE.DEMO
          : adapter?.status || (adapter ? SOURCE_STATE.AVAILABLE : SOURCE_STATE.FOUNDATION_ONLY),
        authoritative: false, label: adapter?.label || name,
      }];
    }));
  }
}

function calculateFreshness(observedAt, now, dataMode) {
  if (dataMode === 'DEMO') return new TwinDataFreshness({ status: FRESHNESS_STATUS.DEMO, observedAt, explanation: 'Visible simulator data; not a production fact.', dataMode });
  if (!observedAt) return new TwinDataFreshness({ status: FRESHNESS_STATUS.UNAVAILABLE, explanation: 'No telemetry timestamp is available.', dataMode });
  const ageSeconds = Math.max(0, Math.floor((now - new Date(observedAt)) / 1000));
  const status = ageSeconds <= 30 ? FRESHNESS_STATUS.LIVE : ageSeconds <= 300 ? FRESHNESS_STATUS.FRESH : ageSeconds <= 1800 ? FRESHNESS_STATUS.STALE : FRESHNESS_STATUS.EXPIRED;
  return new TwinDataFreshness({ status, observedAt, ageSeconds, explanation: `Latest trusted telemetry is ${ageSeconds} seconds old.`, dataMode });
}
function normalizeMachineStatus(status, telemetry, operations) {
  if (operations?.testMode) return MACHINE_TWIN_STATUS.TEST_MODE;
  if (telemetry?.activeFaults?.some(({ severity }) => severity === 'CRITICAL')) return MACHINE_TWIN_STATUS.ERROR;
  const normalized = String(status || telemetry?.status || 'UNKNOWN').toUpperCase();
  return MACHINE_TWIN_STATUS[normalized] || MACHINE_TWIN_STATUS.UNKNOWN;
}
function unavailableSummary(source) { return { status: SOURCE_STATE.FOUNDATION_ONLY, source, items: [] }; }
function buildPrediction(inventory) {
  return {
    status: inventory?.predictedRefillAt ? 'DETERMINISTIC' : SOURCE_STATE.FOUNDATION_ONLY,
    predictedRefillAt: inventory?.predictedRefillAt || null, predictedServiceAt: null,
    predictedFailureRisk: null, confidence: inventory?.predictionConfidence || null,
    explanation: inventory?.predictedRefillAt ? 'Estimated from explicit stock and consumption facts.' : 'Failure prediction is not implemented in v1.',
    modelVersion: 'deterministic-v1',
  };
}
function defaultComponents(machineId) {
  return [{ componentId: `${machineId}_controller`, componentType: 'CONTROLLER', displayName: 'Machine controller', status: 'UNKNOWN' }];
}

module.exports = { MachineTwinProjectionService, REQUIRED_ROLES, calculateFreshness };
