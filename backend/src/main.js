const express = require('express');

const { createApiCompatibilityRouter } = require('./api/compatibilityRoutes');
const { createApiV1Router } = require('./api/v1');
const { createHealthRouter } = require('./common/http/healthRouter');
const { disconnectDatabase } = require('./common/database');
const { backendConfig } = require('./config');
const { moduleManifests } = require('./modules');
const { createRuntimeDependencies } = require('./runtimeDependencies');
const { attachCorrelationId, sendError } = require('./platform/http/apiResponse');
const { StructuredLogger, requestContext } = require('./platform/observability/Logger');
const { METRICS, MetricsRegistry } = require('./platform/observability/MetricsRegistry');

function createApp(options = {}) {
  const app = express();
  const config = options.config || backendConfig;
  const logger = options.logger || new StructuredLogger({ level: config.logging.level });
  const metrics = options.metrics || new MetricsRegistry();
  const dependencies = options.dependencies || createRuntimeDependencies({ logger, metrics, config });
  dependencies.featureFlags = dependencies.featureFlags || config.features;

  app.use(express.json({ verify: (req, _res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
  app.use(attachCorrelationId);
  app.use(requestContext(logger));
  app.use((req, res, next) => {
    res.on('finish', () => metrics.increment(METRICS.HTTP_REQUESTS, 1, { method: req.method, status: String(res.statusCode) }));
    next();
  });

  app.get('/', (req, res) => {
    res.json({
      project: 'soft-ice-platform',
      service: 'backend',
      status: 'online',
      architecture: 'modular-monolith',
      modules: moduleManifests.map(({ name, status }) => ({ name, status })),
      serverTime: new Date().toISOString(),
    });
  });

  app.use('/health', createHealthRouter(options.health));
  app.use('/api/v1', createApiV1Router(dependencies, { logger }));
  app.use('/api', createApiCompatibilityRouter(dependencies, { logger }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    return sendError(res, req, error, logger);
  });

  app.locals.platform = { config, dependencies, logger, metrics };

  return app;
}

let app;

let server;
let paymentInboxTimer;
let machineCommandTimer;
let machineRecoveryTimer;

function startServer() {
  if (server) {
    return server;
  }

  server = getApp().listen(backendConfig.http.port, backendConfig.http.host, () => {
    getApp().locals.platform.logger.info('application.started', { host: backendConfig.http.host, port: backendConfig.http.port, environment: backendConfig.environment });
  });
  const paymentInboxWorker = getApp().locals.platform.dependencies.paymentInboxWorker;
  if (paymentInboxWorker && !paymentInboxTimer) {
    paymentInboxTimer = setInterval(() => paymentInboxWorker.runOnce().catch((error) => getApp().locals.platform.logger.error('payment.inbox.worker.failed', { code: error.code || 'PAYMENT_INBOX_WORKER_FAILED' })), 5000);
    paymentInboxTimer.unref();
  }
  const { machineCommandWorker, machineRecoveryWorker } = getApp().locals.platform.dependencies;
  if (machineCommandWorker && !machineCommandTimer) {
    machineCommandTimer = setInterval(() => machineCommandWorker.runOnce().catch((error) => getApp().locals.platform.logger.error('machine.command.worker.failed', { code: error.code || 'MACHINE_COMMAND_WORKER_FAILED' })), 5000);
    machineCommandTimer.unref();
  }
  if (machineRecoveryWorker && !machineRecoveryTimer) {
    machineRecoveryTimer = setInterval(() => machineRecoveryWorker.runOnce().catch((error) => getApp().locals.platform.logger.error('machine.recovery.worker.failed', { code: error.code || 'MACHINE_RECOVERY_WORKER_FAILED' })), 15000);
    machineRecoveryTimer.unref();
  }

  return server;
}

function getApp() {
  if (!app) {
    app = createApp();
  }

  return app;
}

async function shutdown(signal, options = {}) {
  const logger = app?.locals.platform.logger || new StructuredLogger();
  logger.info('application.shutdown.started', { signal });
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    server = undefined;
  }
  if (paymentInboxTimer) { clearInterval(paymentInboxTimer); paymentInboxTimer = undefined; }
  if (machineCommandTimer) { clearInterval(machineCommandTimer); machineCommandTimer = undefined; }
  if (machineRecoveryTimer) { clearInterval(machineRecoveryTimer); machineRecoveryTimer = undefined; }
  for (const release of options.releaseResources || []) await release();
  await disconnectDatabase();
  await logger.flush();
}

if (require.main === module) {
  startServer();

  process.on('SIGINT', () => {
    shutdown('SIGINT').then(() => process.exit(0)).catch(() => process.exit(1));
  });

  process.on('SIGTERM', () => {
    shutdown('SIGTERM').then(() => process.exit(0)).catch(() => process.exit(1));
  });
}

module.exports = {
  get app() {
    return getApp();
  },
  createApp,
  startServer,
  shutdown,
};
