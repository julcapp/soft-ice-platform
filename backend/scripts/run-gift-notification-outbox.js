'use strict';

const { disconnectDatabase } = require('../src/common/database');
const { backendConfig } = require('../src/config');
const { createBotClientsFromEnv } = require('../src/modules/bot_core/createBotClientsFromEnv');
const { StructuredLogger } = require('../src/platform/observability/Logger');
const { MetricsRegistry } = require('../src/platform/observability/MetricsRegistry');
const { createRuntimeDependencies } = require('../src/runtimeDependencies');

async function main() {
  if (!backendConfig.botNotifications.outbox.workerEnabled) {
    process.stdout.write('Gift notification outbox worker is disabled.\n');
    return;
  }

  const logger = new StructuredLogger({ level: backendConfig.logging.level });
  const dependencies = createRuntimeDependencies({
    logger,
    metrics: new MetricsRegistry(),
    config: backendConfig,
    botClients: createBotClientsFromEnv(process.env),
  });
  const rows = await dependencies.giftNotificationOutboxWorker.runOnce();
  const summary = rows.reduce((result, row) => {
    result[row.status] = (result[row.status] || 0) + 1;
    return result;
  }, {});
  process.stdout.write(`${JSON.stringify({ processed: rows.length, statuses: summary })}\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${error.code || 'GIFT_NOTIFICATION_OUTBOX_FAILED'}\n`);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
