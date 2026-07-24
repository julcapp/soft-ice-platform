const { COMPONENT_STATUS, ComponentHealth } = require('./MachineTwinModels');

class ComponentHealthService {
  calculate(signals = {}) {
    const factors = [];
    let score = 100;
    const deduct = (code, points, explanation) => {
      score -= points; factors.push({ code, impact: -points, explanation });
    };
    if (signals.activeCriticalFault) deduct('ACTIVE_CRITICAL_FAULT', 60, 'An active critical fault is present.');
    if (signals.activeWarningFault) deduct('ACTIVE_WARNING_FAULT', 20, 'An active warning fault is present.');
    if (signals.staleTelemetry) deduct('STALE_TELEMETRY', 15, 'Component telemetry is stale.');
    if (signals.offline) deduct('OFFLINE', 40, 'The component is offline.');
    if (signals.overdueMaintenance) deduct('OVERDUE_MAINTENANCE', 15, 'Expected service date has passed.');
    if (signals.recentFailedTest) deduct('RECENT_FAILED_TEST', 25, 'The most recent linked test failed.');
    if (!factors.length) factors.push({ code: 'NORMAL_OPERATION', impact: 0, explanation: 'No adverse explicit signal is available.' });
    score = Math.max(0, Math.min(100, score));
    const status = signals.offline ? COMPONENT_STATUS.OFFLINE
      : score < 40 ? COMPONENT_STATUS.CRITICAL : score < 80 ? COMPONENT_STATUS.WARNING : COMPONENT_STATUS.HEALTHY;
    return new ComponentHealth({ score, status, factors });
  }
}

module.exports = { ComponentHealthService };
