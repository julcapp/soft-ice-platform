const EVENT_MAPPING = Object.freeze({
  CUP_DISPENSE_COMPLETED: { itemId: 'consumable_cup', movementType: 'CONSUMPTION', reason: 'sale_dispense' },
  PRODUCT_DISPENSE_COMPLETED: { itemId: 'ingredient_ice_cream_mix', movementType: 'CONSUMPTION', reason: 'sale_dispense' },
  TOPPING_DISPENSE_COMPLETED: { itemId: 'ingredient_topping', movementType: 'CONSUMPTION', reason: 'sale_dispense' },
  'MachineOperations.InventoryConsumed': { movementType: 'TEST_CONSUMPTION', reason: 'operator_consumption' },
});

class InventoryEventSubscriber {
  constructor({ runtime }) { this.runtime = runtime; }
  subscriber() {
    return { subscriberId: 'inventory.runtime-ledger.v1', order: 300, handler: async (event) => {
      const mapping = EVENT_MAPPING[event.eventType]; if (!mapping) return;
      const payload = event.payload || {};
      await this.runtime.recordMovement({
        itemId: payload.itemId || payload.itemReference || mapping.itemId,
        locationId: payload.locationId || `machine_${payload.machineId || event.aggregateId}`,
        movementType: payload.movementType || mapping.movementType,
        quantity: payload.quantity || 1, reason: payload.reason || mapping.reason,
        sourceType: 'PLATFORM_EVENT', sourceId: event.aggregateId, sourceEventId: event.eventId,
      }, { actorType: 'SYSTEM', actorId: 'inventory-event-subscriber', sourceChannel: 'PLATFORM_EVENT_BUS', correlationId: event.correlationId, idempotencyKey: `event:${event.eventId}` });
    } };
  }
}
module.exports = { InventoryEventSubscriber };
