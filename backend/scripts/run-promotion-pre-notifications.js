'use strict';

const { getPrismaClient } = require('../src/common/database');
const {
  ActivePromotionResolver,
  PromotionAwarenessService,
  createPromotionDispatchersFromEnv,
} = require('../src/modules/promotion_engine');

async function main() {
  const prisma = getPrismaClient();
  const service = new PromotionAwarenessService({
    prisma,
    resolver: new ActivePromotionResolver({ prisma }),
    dispatchers: createPromotionDispatchersFromEnv(process.env),
  });
  const results = await service.dispatchDueNotifications({
    machineId: process.env.PROMOTION_NOTIFICATION_MACHINE_ID || null,
    withinSeconds: Number(process.env.PROMOTION_NOTIFICATION_TOLERANCE_SECONDS || 75),
  });
  process.stdout.write(`${JSON.stringify({ checked_at: new Date().toISOString(), results })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ level: 'error', code: error.code || 'PROMOTION_NOTIFICATION_WORKER_FAILED', message: error.message })}\n`);
  process.exitCode = 1;
});
