const { PrismaClient } = require('@prisma/client');
const { ServiceSpecialistDirectoryService } = require('../src/modules/admin_dashboard/ServiceSpecialistDirectoryService');
const { AdminOperationsEscalationDeliveryService } = require('../src/modules/admin_dashboard/AdminOperationsEscalationDeliveryService');

async function main() {
  const prisma = new PrismaClient();
  try {
    const specialistDirectory = new ServiceSpecialistDirectoryService({ prisma });
    const service = new AdminOperationsEscalationDeliveryService({ prisma, specialistDirectory });
    const result = await service.run({ limit: 200 });
    console.log(JSON.stringify(result, null, 2));
    if (result.failed > 0 || result.blocked > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
