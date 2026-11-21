const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ServerProductPricingResolver } = require('../src/modules/promotion_engine/ServerProductPricingResolver');

test('server product pricing ignores client price and returns authoritative rule', async () => {
  const resolver = new ServerProductPricingResolver({ catalogService: { resolvePricedItems: async (machineId, items) => [{ ...items[0], sku: items[0].productId, unitPrice: 175, serverProductType: 'ICE_CREAM', machineId }] } });
  const [item] = await resolver.resolveItems([{ id: 'ice-1', productId: 'product_soft_ice_vanilla_cup', quantity: 1, unitPrice: 1 }], { machineId: 'machine-a' });
  assert.equal(item.unitPrice, 175);
  assert.equal(item.serverProductType, 'ICE_CREAM');
  assert.equal(item.sku, 'product_soft_ice_vanilla_cup');
  assert.equal(item.machineId, 'machine-a');
});

test('unknown product cannot receive arbitrary client pricing', async () => {
  const resolver = new ServerProductPricingResolver({ catalogService: { resolvePricedItems: async () => { throw Object.assign(new Error('not saleable'), { code: 'SERVER_PRODUCT_NOT_SALEABLE' }); } } });
  await assert.rejects(
    () => resolver.resolveItems([{ productId: 'fake-product', quantity: 1, unitPrice: 1 }], { machineId: 'machine-a' }),
    (error) => error.code === 'SERVER_PRODUCT_NOT_SALEABLE',
  );
});
