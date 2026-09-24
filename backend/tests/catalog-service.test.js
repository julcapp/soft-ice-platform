const assert = require('node:assert/strict');
const { test } = require('node:test');
const { CatalogService } = require('../src/modules/catalog');

function item(overrides = {}) {
  return { id: 'ice-a', sku: 'ice-a', category: 'ICE_CREAM', nameRu: 'Пломбир', basePrice: 150, currency: 'RUB', active: true, systemItem: false, freeItem: false, sortOrder: 1, updatedAt: new Date('2026-09-23T00:00:00Z'), ...overrides };
}

function fixture(items = [item()]) {
  const saved = new Map(items.map((value) => [value.id, value]));
  const assignments = items.map((value) => ({ available: true, isCurrentFlavor: value.category === 'ICE_CREAM', catalogItem: value }));
  const calls = [];
  const repository = {
    listAll: async () => [...saved.values()],
    listMachines: async () => [{ id: 'a', machineCode: 'A-01', name: 'Томск' }],
    getItem: async (id) => saved.get(id) || null,
    hasCurrentFlavorAssignments: async (id) => assignments.some((row) => row.catalogItem.id === id && row.isCurrentFlavor),
    listMachineCatalog: async (machineId) => ({ machine: { id: machineId, name: machineId }, assignments }),
    createItem: async (value) => ({ id: 'created', updatedAt: new Date(), ...value }),
    updateItem: async (id, value, context, action) => { calls.push({ id, value, context, action }); return { ...saved.get(id), ...value }; },
    updatePrices: async (changes, context) => changes.map((change) => { calls.push({ ...change, context, action: 'CATALOG_PRICE_UPDATED' }); return { ...saved.get(change.id), ...change }; }),
    setAvailability: async (value) => value,
    setCurrentFlavor: async (value) => value,
  };
  return { service: new CatalogService({ repository }), calls };
}

test('machine-specific catalogs may expose different current flavors', async () => {
  const vanilla = item({ id: 'vanilla', sku: 'vanilla', nameRu: 'Ваниль' });
  const chocolate = item({ id: 'chocolate', sku: 'chocolate', nameRu: 'Шоколад' });
  const repository = { listMachineCatalog: async (machineId) => ({ machine: { id: machineId }, assignments: [{ available: true, isCurrentFlavor: true, catalogItem: machineId === 'a' ? vanilla : chocolate }] }) };
  const service = new CatalogService({ repository });
  assert.equal((await service.getMachineCatalog('a')).currentFlavor.sku, 'vanilla');
  assert.equal((await service.getMachineCatalog('b')).currentFlavor.sku, 'chocolate');
});

test('paid active item without price fails closed', async () => {
  const broken = item({ basePrice: null });
  const { service } = fixture([broken]);
  await assert.rejects(() => service.getMachineCatalog('a'), (error) => error.code === 'CATALOG_PRICE_INVALID');
  assert.throws(() => service.createItem({ ...broken, id: undefined }), (error) => error.code === 'CATALOG_PRICE_REQUIRED');
});

test('zero price requires system/no-option or deliberate free marker', async () => {
  const { service } = fixture();
  assert.throws(() => service.createItem({ ...item(), basePrice: 0 }), (error) => error.code === 'CATALOG_ZERO_PRICE_REQUIRES_REASON');
  assert.throws(() => service.createItem({ ...item(), sku: 'none-null', nameRu: 'Без топпинга', category: 'TOPPING', basePrice: null, systemItem: true }), (error) => error.code === 'CATALOG_PRICE_REQUIRED');
  assert.throws(() => service.createItem({ ...item(), sku: 'none-paid', nameRu: 'Без топпинга', category: 'TOPPING', basePrice: 1, systemItem: true }), (error) => error.code === 'CATALOG_SYSTEM_PRICE_INVALID');
  const none = await service.createItem({ ...item(), sku: 'none', nameRu: 'Без топпинга', category: 'TOPPING', basePrice: 0, systemItem: true });
  assert.equal(none.basePrice, 0);
});

test('system no-option cannot be unmarked, deactivated, or removed from machine', async () => {
  const system = item({ id: 'none', sku: 'none', category: 'TOPPING', basePrice: 0, systemItem: true });
  const { service } = fixture([system]);
  await assert.rejects(() => service.updateItem('none', { systemItem: false }), (error) => error.code === 'CATALOG_SYSTEM_ITEM_PROTECTED');
  await assert.rejects(() => service.updateItem('none', { active: false }), (error) => error.code === 'CATALOG_SYSTEM_ITEM_PROTECTED');
  await assert.rejects(() => service.updateItem('none', { sku: 'renamed-none' }), (error) => error.code === 'CATALOG_SYSTEM_ITEM_PROTECTED');
  await assert.rejects(() => service.updateItem('none', { category: 'SPRINKLE' }), (error) => error.code === 'CATALOG_SYSTEM_ITEM_PROTECTED');
  await assert.rejects(() => service.updatePrice('none', { basePrice: 0, currency: 'USD' }), (error) => error.code === 'CATALOG_SYSTEM_PRICE_INVALID');
  await assert.rejects(() => service.setAvailability('a', 'none', false), (error) => error.code === 'CATALOG_SYSTEM_ITEM_PROTECTED');
});

test('new catalog price changes future resolution without mutating snapshots', async () => {
  const { service, calls } = fixture();
  await service.updatePrice('ice-a', { basePrice: 180, currency: 'RUB' }, { actorId: 'admin' });
  assert.deepEqual(calls[0].value, { basePrice: 180, currency: 'RUB' });
  assert.equal(calls[0].action, 'CATALOG_PRICE_UPDATED');
});

test('bulk prices validate first and update in one repository operation', async () => {
  const topping = item({ id: 'top', sku: 'top', category: 'TOPPING', basePrice: 20 });
  const { service, calls } = fixture([item(), topping]);
  const updated = await service.updatePrices([{ id: 'ice-a', basePrice: 180 }, { id: 'top', basePrice: 25 }], { actorId: 'admin' });
  assert.deepEqual(updated.map((value) => value.basePrice), [180, 25]);
  assert.deepEqual(calls.map(({ id, basePrice }) => ({ id, basePrice })), [{ id: 'ice-a', basePrice: 180 }, { id: 'top', basePrice: 25 }]);
  await assert.rejects(() => service.updatePrices([{ id: 'ice-a', basePrice: 170 }, { id: 'ice-a', basePrice: 175 }]), (error) => error.code === 'CATALOG_PRICE_CHANGES_INVALID');
});

test('admin status distinguishes missing prices and configuration errors', async () => {
  const { service } = fixture([
    item({ id: 'missing', basePrice: null, active: false }),
    item({ id: 'currency', currency: 'USD' }),
    item({ id: 'inactive', active: false }),
  ]);
  const values = await service.listAll();
  assert.equal(values.find((value) => value.id === 'missing').configurationStatus, 'MISSING_PRICE');
  assert.equal(values.find((value) => value.id === 'currency').configurationStatus, 'CONFIG_ERROR');
  assert.equal(values.find((value) => value.id === 'inactive').configurationStatus, 'INACTIVE');
});

test('catalog accepts RUB only and blocks deactivation of an assigned current flavor', async () => {
  const { service } = fixture();
  await assert.rejects(() => service.updatePrice('ice-a', { basePrice: 180, currency: 'USD' }), (error) => error.code === 'CATALOG_CURRENCY_UNSUPPORTED');
  await assert.rejects(() => service.updateItem('ice-a', { active: false }), (error) => error.code === 'CATALOG_CURRENT_FLAVOR_DEACTIVATION_BLOCKED');
});

test('pricing resolution ignores client price and includes configured zero options', async () => {
  const none = item({ id: 'none', sku: 'none', category: 'TOPPING', nameRu: 'Без топпинга', basePrice: 0, systemItem: true });
  const { service } = fixture([item(), none]);
  const priced = await service.resolvePricedItems('a', [{ productId: 'ice-a', unitPrice: 1 }, { productId: 'none', unitPrice: 999 }]);
  assert.deepEqual(priced.map(({ unitPrice }) => unitPrice), [150, 0]);
});
