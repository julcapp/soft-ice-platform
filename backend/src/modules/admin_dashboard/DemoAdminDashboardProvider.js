class DemoAdminDashboardProvider {
  constructor({ clock = () => new Date() } = {}) { this.clock = clock; }
  async getDashboard() {
    const generatedAt = this.clock().toISOString();
    return {
      generatedAt,
      freshness: { status: 'DEMO', source: 'DEMO_READ_MODEL', generatedAt, isDemo: true, message: 'Live reporting integrations are not connected. Values are demonstration data.' },
      summary: {
        revenueToday: { value: 128450, currency: 'RUB' }, salesToday: 486,
        machinesOnline: 42, machinesTotal: 48, machinesRequiringAttention: 6,
        criticalAlerts: 2, lowCupStock: 3, lowIngredientStock: 5,
      },
      machineStatus: { distribution: [{ status: 'ONLINE', count: 42 }, { status: 'ATTENTION', count: 4 }, { status: 'OFFLINE', count: 2 }] },
      inventoryAlerts: [
        { id: 'inventory_demo_1', machine: 'TM-014', item: 'Cups 200 ml', level: 12, severity: 'CRITICAL' },
        { id: 'inventory_demo_2', machine: 'TM-027', item: 'Vanilla mix', level: 18, severity: 'WARNING' },
      ],
      operatorSummary: { active: 9, pendingServiceApprovals: 4 },
      maintenanceSummary: [
        { id: 'maintenance_demo_1', machine: 'TM-008', activity: 'Scheduled cleaning', status: 'COMPLETED', occurredAt: generatedAt },
        { id: 'maintenance_demo_2', machine: 'TM-021', activity: 'Cooling inspection', status: 'IN_REVIEW', occurredAt: generatedAt },
      ],
      paymentSummary: {
        recent: [
          { id: 'payment_demo_1', machine: 'TM-004', amount: 290, currency: 'RUB', status: 'PAID', occurredAt: generatedAt },
          { id: 'payment_demo_2', machine: 'TM-019', amount: 340, currency: 'RUB', status: 'PAID', occurredAt: generatedAt },
        ],
        salesTrend: [52, 61, 58, 73, 68, 84, 90],
        revenueTrend: [13200, 15800, 14900, 18800, 17600, 21900, 26300],
      },
      recentEvents: [
        { id: 'event_demo_1', type: 'Machine.AttentionRequired', description: 'TM-014 cup stock is critical', severity: 'CRITICAL', occurredAt: generatedAt },
        { id: 'event_demo_2', type: 'Maintenance.ReportSubmitted', description: 'TM-021 service report awaits review', severity: 'INFO', occurredAt: generatedAt },
      ],
    };
  }
}
module.exports = { DemoAdminDashboardProvider };
