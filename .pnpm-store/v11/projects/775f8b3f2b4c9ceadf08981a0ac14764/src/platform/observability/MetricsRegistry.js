class MetricsRegistry {
  constructor() { this.values = new Map(); }
  increment(name, value = 1, labels = {}) { return this.set(name, this.get(name, labels) + value, labels); }
  gauge(name, value, labels = {}) { return this.set(name, value, labels); }
  set(name, value, labels) { this.values.set(key(name, labels), { name, value, labels }); return value; }
  get(name, labels = {}) { return this.values.get(key(name, labels))?.value || 0; }
  snapshot() { return [...this.values.values()].map((entry) => ({ ...entry, labels: { ...entry.labels } })); }
}
function key(name, labels) { return `${name}:${JSON.stringify(Object.entries(labels).sort())}`; }
const METRICS = Object.freeze({ ORDERS: 'soft_ice_orders_total', PAYMENTS: 'soft_ice_payments_total', MACHINE_STATUS: 'soft_ice_machine_status', INVENTORY: 'soft_ice_inventory_units', TELEGRAM_SESSIONS: 'soft_ice_telegram_sessions_total', HTTP_REQUESTS: 'soft_ice_http_requests_total' });
module.exports = { METRICS, MetricsRegistry };
