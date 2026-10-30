'use strict';

const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const test = require('node:test');
const { PrismaClient } = require('@prisma/client');
const { CatalogRepository, CatalogService } = require('../src/modules/catalog');
const { PricingEngineService } = require('../src/modules/promotion_engine/PricingEngineService');
const { PricingRepository } = require('../src/modules/promotion_engine/PricingRepository');

const enabled = Boolean(process.env.DATABASE_URL);
const postgresTest = enabled ? test : test.skip;
const prisma = enabled ? new PrismaClient() : null;

test.after(async () => {
  if (prisma) await prisma.$disconnect();
});

postgresTest('catalog price edits affect new quotes but never historical pricing snapshots', async () => {
  const suffix = crypto.randomUUID();
  const machineId = `catalog-machine-${suffix}`;
  let flavorId;
  let noToppingId;
  const quoteIds = [];
  const snapshotIds = [];

  await prisma.machine.create({ data: { id: machineId, machineCode: `CAT-${suffix}`, name: 'Catalog pricing test machine' } });
  const catalog = new CatalogService({ repository: new CatalogRepository(prisma) });
  const pricing = new PricingEngineService({
    repository: new PricingRepository(prisma),
    promotionResolver: { resolve: async () => null },
  });

  try {
    flavorId = (await catalog.createItem({ sku: `flavor_${suffix}`, category: 'ICE_CREAM', nameRu: 'Тестовый вкус', basePrice: 150, currency: 'RUB' }, { actorId: 'catalog-test' })).id;
    noToppingId = (await catalog.createItem({ sku: `topping_none_${suffix}`, category: 'TOPPING', nameRu: 'Без топпинга', basePrice: 0, currency: 'RUB', systemItem: true }, { actorId: 'catalog-test' })).id;
    await catalog.setCurrentFlavor(machineId, flavorId, { actorId: 'catalog-test' });
    await catalog.setAvailability(machineId, noToppingId, true, { actorId: 'catalog-test' });

    const firstItems = await catalog.resolvePricedItems(machineId, [
      { productId: `flavor_${suffix}` },
      { productId: `topping_none_${suffix}` },
    ]);
    const firstQuote = await pricing.createQuote({ machineId, channel: 'TERMINAL', items: firstItems });
    quoteIds.push(firstQuote.id);
    snapshotIds.push(firstQuote.snapshotId);
    assert.equal(Number(firstQuote.finalAmount), 150);
    assert.deepEqual(firstQuote.items.map((item) => Number(item.baseAmount)), [150, 0]);

    await catalog.updatePrice(flavorId, { basePrice: 180, currency: 'RUB' }, { actorId: 'catalog-test' });
    const historical = await prisma.pricingSnapshot.findUnique({ where: { id: firstQuote.snapshotId }, include: { items: true } });
    assert.equal(Number(historical.finalAmount), 150);
    assert.deepEqual(historical.items.map((item) => Number(item.baseAmount)), [150, 0]);

    const secondItems = await catalog.resolvePricedItems(machineId, [{ productId: `flavor_${suffix}` }]);
    const secondQuote = await pricing.createQuote({ machineId, channel: 'TERMINAL', items: secondItems });
    quoteIds.push(secondQuote.id);
    snapshotIds.push(secondQuote.snapshotId);
    assert.equal(Number(secondQuote.finalAmount), 180);
  } finally {
    await prisma.pricingSnapshotItem.deleteMany({ where: { pricingSnapshotId: { in: snapshotIds } } });
    await prisma.pricingSnapshot.deleteMany({ where: { id: { in: snapshotIds } } });
    await prisma.pricingQuote.deleteMany({ where: { id: { in: quoteIds } } });
    await prisma.auditEvent.deleteMany({ where: { targetId: { in: [flavorId, noToppingId].filter(Boolean) } } });
    await prisma.machineCatalogItem.deleteMany({ where: { machineId } });
    await prisma.catalogItem.deleteMany({ where: { id: { in: [flavorId, noToppingId].filter(Boolean) } } });
    await prisma.machine.deleteMany({ where: { id: machineId } });
  }
});
