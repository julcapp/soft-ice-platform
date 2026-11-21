const { backendConfig } = require('./config');
const { disconnectDatabase } = require('./common/database');
const { createApp } = require('./main');
const { createRuntimeDependencies } = require('./runtimeDependencies');
const { StructuredLogger } = require('./platform/observability/Logger');
const { MetricsRegistry } = require('./platform/observability/MetricsRegistry');

function startMiniAppGateway() {
  const logger = new StructuredLogger({ level: backendConfig.logging.level });
  const metrics = new MetricsRegistry();
  const dependencies = createRuntimeDependencies({
    logger,
    metrics,
    config: backendConfig,
    sideEffectsEnabled: false,
  });

  const app = createApp({
    config: backendConfig,
    logger,
    metrics,
    dependencies,
    botWebhooksEnabled: process.env.BOT_WEBHOOKS_ENABLED === 'true',
  });

  const server = app.listen(backendConfig.http.port, backendConfig.http.host, () => {
    logger.info('miniapp.gateway.started', {
      host: backendConfig.http.host,
      port: backendConfig.http.port,
      botWebhooksEnabled: process.env.BOT_WEBHOOKS_ENABLED === 'true',
      backgroundWorkers: false,
      saleFlowRecovery: false,
    });
  });

  const shutdown = async (signal) => {
    logger.info('miniapp.gateway.shutdown.started', { signal });
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await disconnectDatabase();
    await logger.flush();
  };

  process.on('SIGINT', () => shutdown('SIGINT').then(() => process.exit(0)).catch(() => process.exit(1)));
  process.on('SIGTERM', () => shutdown('SIGTERM').then(() => process.exit(0)).catch(() => process.exit(1)));

  return { app, server, dependencies };
}

if (require.main === module) startMiniAppGateway();

module.exports = { startMiniAppGateway };
