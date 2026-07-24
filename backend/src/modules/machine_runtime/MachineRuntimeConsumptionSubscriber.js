const CONSUMPTION = Object.freeze({
  CUP_DISPENSE_COMPLETED: ['CUP_CONSUMED','cup'], PRODUCT_DISPENSE_COMPLETED: ['MIX_CONSUMED','mix'], TOPPING_DISPENSE_COMPLETED: ['TOPPING_CONSUMED','topping'],
});
class MachineRuntimeConsumptionSubscriber {
  constructor({ inventoryService, eventPublisher }) { this.inventoryService = inventoryService; this.eventPublisher = eventPublisher; this.processed = new Set(); }
  subscriber() { return { subscriberId: 'inventory.machine-runtime-consumption.v1', order: 300, handler: async (event, context) => {
    if (this.processed.has(context.idempotencyKey)) return;
    const mapping = CONSUMPTION[event.eventType]; if (!mapping) return;
    const reason = event.payload.consumptionReason || 'SALE';
    const fact = { machineId: event.aggregateId, itemType: mapping[1], quantity: event.payload.quantity || 1, reason, sourceEventId: event.eventId, idempotencyKey: context.idempotencyKey };
    if (this.inventoryService) await this.inventoryService.recordConsumption(fact);
    if (this.eventPublisher) await this.eventPublisher.publish({ eventType: mapping[0], eventVersion: 1, aggregateType: 'MACHINE', aggregateId: event.aggregateId, actorType: 'SYSTEM', actorId: 'machine-runtime-consumption', sourceChannel: 'MACHINE_RUNTIME', correlationId: event.correlationId, causationId: event.eventId, payload: fact, metadata: {} });
    this.processed.add(context.idempotencyKey);
  } }; }
}
module.exports = { MachineRuntimeConsumptionSubscriber };
