const { InventoryRuntime } = require('./InventoryRuntime');
const { InventoryService } = require('./InventoryService');
const { InventoryEventSubscriber } = require('./InventoryEventSubscriber');
const { InMemoryInventoryRepository } = require('./InventoryRepository');
const models = require('./InventoryModels');
module.exports = {
  name: 'inventory', status: 'runtime-foundation-v1',
  owns: ['inventory items', 'stock ledger', 'reservations', 'stock projections'],
  InventoryRuntime, InventoryService, InventoryEventSubscriber, InMemoryInventoryRepository, ...models,
};
