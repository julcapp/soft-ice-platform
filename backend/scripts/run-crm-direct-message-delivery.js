const { PrismaClient } = require('@prisma/client');
const { CrmDirectMessageSender } = require('../src/modules/crm/CrmDirectMessageSender');

async function main() {
  const prisma = new PrismaClient();
  try {
    const sender = new CrmDirectMessageSender({ prisma });
    const result = await sender.run({ limit: Number(process.env.CRM_DIRECT_DELIVERY_BATCH_SIZE || 100) });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.failed > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
