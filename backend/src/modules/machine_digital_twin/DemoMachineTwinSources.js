const { SOURCE_STATE } = require('./MachineTwinModels');

function createDemoMachineTwinSources(clock = () => new Date()) {
  const machine = {
    id: 'machine_demo_001', machineCode: 'SIM-001', name: 'Томск · Ленина 1',
    model: 'Simulator v1', serialNumber: 'DEMO-SN-001', location: 'Томск, пр. Ленина, 1', status: 'ONLINE',
  };
  const available = { status: SOURCE_STATE.DEMO, label: 'Machine Simulator' };
  return {
    machineIdentity: { ...available, listMachines: async () => [machine], getMachine: async (id) => id === machine.id ? machine : null },
    telemetry: { ...available, getTelemetry: async () => {
      const observedAt = clock().toISOString();
      return {
        observedAt, lastHeartbeatAt: observedAt, connectivityStatus: 'ONLINE', activeFaults: [],
        components: [
          { componentId: 'component_cup', componentType: 'CUP_DISPENSER', displayName: 'Cup dispenser', status: 'HEALTHY', operatingHours: 428, usageCounter: 1840, activeFaults: [], telemetrySummary: { cupsRemaining: 76 } },
          { componentId: 'component_cooling', componentType: 'COOLING_SYSTEM', displayName: 'Cooling system', status: 'HEALTHY', operatingHours: 610, activeFaults: [], telemetrySummary: { temperatureC: -5.2 } },
          { componentId: 'component_payment', componentType: 'PAYMENT_TERMINAL', displayName: 'Payment terminal', status: 'HEALTHY', activeFaults: [], telemetrySummary: { connectivity: 'ONLINE' } },
        ],
      };
    } },
    machineOperations: { ...available, getSummary: async () => ({ assignedOperator: { id: 'operator_demo', name: 'Demo Operator' }, openServiceTasks: [], maintenanceSummary: { status: 'CURRENT', nextServiceAt: null }, recentTestRuns: [{ id: 'test_demo', status: 'PASSED', performedAt: clock().toISOString() }] }) },
    inventory: { ...available, getSummary: async () => ({ status: 'AVAILABLE', items: [{ item: 'cups', quantity: 76, unit: 'pcs' }, { item: 'mix', quantity: 8.4, unit: 'l' }] }) },
    orders: { ...available, getRecentSales: async () => ({ count24h: 24, revenue24h: 3120, currency: 'RUB' }) },
    payments: { ...available, getActivePrice: async () => ({ amount: 130, currency: 'RUB', source: 'Payment Platform demo projection' }) },
    productCatalog: { ...available, getCurrentMenu: async () => ({ id: 'menu_demo', name: 'Soft ice cream', items: 1 }) },
    advertising: { status: SOURCE_STATE.FOUNDATION_ONLY, label: 'Advertising placement foundation', getActivePlacement: async () => null },
    simulator: available,
  };
}
module.exports = { createDemoMachineTwinSources };
