const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ServerProductPricingResolver } = require('../src/modules/promotion_engine/ServerProductPricingResolver');

test('server product pricing ignores client price and returns authoritative rule', async () => {
  const resolver = new ServerProductPricingResolver();
  const [item] = await resolver.resolveItems([{ id: 'ice-1', productId: 'product_soft_ice_vanilla_cup', quantity: 1, unitPrice: 1 }]);
  assert.equal(item.unitPrice, 130);
  assert.equal(item.serverProductType, 'ICE_CREAM');
  assert.equal(item.sku, 'product_soft_ice_vanilla_cup');
});

test('unknown product cannot receive arbitrary client pricing', async () => {
  const resolver = new ServerProductPricingResolver();
  await assert.rejects(
    () => resolver.resolveItems([{ productId: 'fake-product', quantity: 1, unitPrice: 1 }]),
    (error) => error.code === 'SERVER_PRODUCT_NOT_SALEABLE',
  );
});
