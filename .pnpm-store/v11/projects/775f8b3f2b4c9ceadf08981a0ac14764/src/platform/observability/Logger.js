const { AsyncLocalStorage } = require('async_hooks');
const contextStorage = new AsyncLocalStorage();
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

class StructuredLogger {
  constructor({ level = 'info', destination = process.stdout, clock = () => new Date() } = {}) {
    this.level = LEVELS[level] ? level : 'info'; this.destination = destination; this.clock = clock;
  }
  log(level, event, fields = {}) {
    if (LEVELS[level] < LEVELS[this.level]) return;
    const record = { timestamp: this.clock().toISOString(), level, event, ...contextStorage.getStore(), ...fields };
    if (fields.error instanceof Error) record.error = { name: fields.error.name, message: fields.error.message, code: fields.error.code || null, ...(level === 'error' ? { stack: fields.error.stack } : {}) };
    this.destination.write(`${JSON.stringify(record)}\n`);
  }
  debug(event, fields) { this.log('debug', event, fields); }
  info(event, fields) { this.log('info', event, fields); }
  warn(event, fields) { this.log('warn', event, fields); }
  error(event, fields) { this.log('error', event, fields); }
  domainEvent(value) { this.info('domain_event', { domain_event_name: value.canonicalName || value.name, aggregate_type: value.aggregateType, aggregate_id: value.aggregateId }); }
  payment(event, fields = {}) { this.info(`payment.${event}`, fields); }
  machine(event, fields = {}) { this.info(`machine.${event}`, fields); }
  async flush() { if (typeof this.destination.flush === 'function') await this.destination.flush(); }
}

function requestContext(logger) {
  return (req, res, next) => contextStorage.run({ request_id: req.requestId, correlation_id: req.correlationId }, () => {
    const startedAt = process.hrtime.bigint();
    res.on('finish', () => logger.info('http.request.completed', { method: req.method, path: req.originalUrl, status_code: res.statusCode, duration_ms: Number(process.hrtime.bigint() - startedAt) / 1e6 }));
    next();
  });
}
module.exports = { StructuredLogger, requestContext };
