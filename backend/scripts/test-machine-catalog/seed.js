'use strict';

const { PrismaClient } = require('@prisma/client');
const { TEST_MACHINE, TEST_CATALOG } = require('./fixture');

async function upsertTestMachineCatalog(prisma) {
  const machine = await prisma.machine.upsert({
    where: { machineCode: TEST_MACHINE.machineCode },
    update: {},
    create: TEST_MACHINE,
  });

  const resolved = [];
  for (const item of TEST_CATALOG) {
    const catalogItem = await prisma.catalogItem.upsert({
      where: { sku: item.sku },
      update: {
        category: item.category,
        nameRu: item.nameRu,
        basePrice: item.basePrice,
        currency: item.currency,
        active: true,
        systemItem: item.systemItem,
        freeItem: item.freeItem,
        sortOrder: item.sortOrder,
      },
      create: {
        sku: item.sku,
        category: item.category,
        nameRu: item.nameRu,
        basePrice: item.basePrice,
        currency: item.currency,
        active: true,
        systemItem: item.systemItem,
        freeItem: item.freeItem,
        sortOrder: item.sortOrder,
      },
    });
    resolved.push({ fixture: item, catalogItem });
  }

  await prisma.$transaction(async (tx) => {
    await tx.machineCatalogItem.updateMany({
      where: { machineId: machine.id, isCurrentFlavor: true },
      data: { isCurrentFlavor: false },
    });

    for (const { fixture, catalogItem } of resolved) {
      await tx.machineCatalogItem.upsert({
        where: {
          machineId_catalogItemId: {
            machineId: machine.id,
            catalogItemId: catalogItem.id,
          },
        },
        update: {
          available: fixture.available,
          isCurrentFlavor: fixture.isCurrentFlavor,
        },
        create: {
          machineId: machine.id,
          catalogItemId: catalogItem.id,
          available: fixture.available,
          isCurrentFlavor: fixture.isCurrentFlavor,
        },
      });
    }
  });

  return { machine, items: resolved.map(({ catalogItem }) => catalogItem) };
}

async function main() {
  if (process.env.ALLOW_TEST_MACHINE_SEED !== 'true') {
    throw new Error('Test seed blocked. Set ALLOW_TEST_MACHINE_SEED=true explicitly.');
  }

  const prisma = new PrismaClient();
  try {
    const result = await upsertTestMachineCatalog(prisma);
    console.log(`TEST-MACHINE-001 ready: ${result.items.length} catalog items`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { upsertTestMachineCatalog };
