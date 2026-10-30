'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { TEST_MACHINE, TEST_CATALOG } = require('../scripts/test-machine-catalog/fixture');

const bySku = Object.fromEntries(TEST_CATALOG.map((item) => [item.sku, item]));

test('TEST-MACHINE-001 fixture has one current creamy flavor at 95 RUB', () => {
  assert.equal(TEST_MACHINE.machineCode, 'TEST-MACHINE-001');
  const current = TEST_CATALOG.filter((item) => item.category === 'ICE_CREAM' && item.isCurrentFlavor);
  assert.equal(current.length, 1);
  assert.equal(current[0].sku, 'icecream_creamy');
  assert.equal(current[0].nameRu, 'Сливочный вкус');
  assert.equal(current[0].basePrice, 95);
  assert.equal(current[0].currency, 'RUB');
});

test('TEST-MACHINE-001 temporary addon prices match product-owner fixture', () => {
  assert.equal(bySku.topping_chocolate.basePrice, 25);
  assert.equal(bySku.topping_strawberry.basePrice, 15);
  assert.equal(bySku.topping_caramel.basePrice, 15);
  assert.equal(bySku.topping_none.basePrice, 0);
  assert.equal(bySku.sprinkle_nuts.basePrice, 25);
  assert.equal(bySku.sprinkle_confetti.basePrice, 25);
  assert.equal(bySku.sprinkle_wafer.basePrice, 25);
  assert.equal(bySku.sprinkle_none.basePrice, 0);
});

test('fixture supports server-priced product assembly examples', () => {
  const total = (...skus) => skus.reduce((sum, sku) => sum + bySku[sku].basePrice, 0);
  assert.equal(total('icecream_creamy', 'topping_none', 'sprinkle_none'), 95);
  assert.equal(total('icecream_creamy', 'topping_strawberry', 'sprinkle_confetti'), 135);
  assert.equal(total('icecream_creamy', 'topping_chocolate', 'sprinkle_nuts'), 145);
});
