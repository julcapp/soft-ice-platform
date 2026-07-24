class MaintenanceProjection {
  constructor({ clock = () => new Date() } = {}) { this.clock = clock; this.sessions = new Map(); this.processed = new Set(); }
  subscriber() {
    return { subscriberId: 'maintenance-admin-projection-v1', order: 80, handler: async (event) => {
      if (this.processed.has(event.eventId)) return; this.processed.add(event.eventId);
      if (event.aggregateType !== 'MAINTENANCE') return;
      const prior = this.sessions.get(event.aggregateId) || {};
      this.sessions.set(event.aggregateId, { ...prior, ...event.payload, sessionId: event.aggregateId, lastEventType: event.eventType, updatedAt: event.occurredAt });
    } };
  }
  list() { return [...this.sessions.values()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))); }
  async getSummary(machineId) {
    const rows = this.list().filter((session) => session.machineId === machineId);
    return {
      openServiceTasks: rows.filter((session) => ['OPEN', 'IN_PROGRESS', 'SUBMITTED'].includes(session.status)),
      maintenanceSummary: { status: rows.some((session) => session.status === 'SUBMITTED') ? 'APPROVAL_PENDING' : rows.some((session) => ['OPEN', 'IN_PROGRESS'].includes(session.status)) ? 'IN_PROGRESS' : 'CURRENT', latestSession: rows[0] || null },
      recentTestRuns: rows.filter((session) => session.testDispense).map((session) => session.testDispense),
    };
  }
  kpis() {
    const rows = this.list(), approved = rows.filter((x) => x.status === 'APPROVED'), submitted = rows.filter((x) => x.status === 'SUBMITTED');
    const durations = approved.map((x) => x.startedAt && x.approvedAt ? new Date(x.approvedAt) - new Date(x.startedAt) : null).filter(Number.isFinite);
    return {
      totalSessions: rows.length, openSessions: rows.filter((x) => ['OPEN', 'IN_PROGRESS', 'SUBMITTED'].includes(x.status)).length,
      pendingApprovals: submitted.length, approvedSessions: approved.length,
      approvalRate: rows.length ? approved.length / rows.length : 0,
      meanTimeToApproveMinutes: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60000) : null,
      firstTimePassRate: rows.length ? rows.filter((x) => x.testDispense?.status === 'PASSED').length / rows.length : 0,
      generatedAt: this.clock().toISOString(),
    };
  }
}
module.exports = { MaintenanceProjection };
