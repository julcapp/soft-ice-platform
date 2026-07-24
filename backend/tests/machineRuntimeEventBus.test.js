const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { createApp } = require('../src/main');
const { EventBus, EventHandlerRegistry, InMemoryEventStore, InMemoryOutbox, InMemoryDeadLetterStore, PlatformEvent } = require('../src/platform/events');
const { InMemoryMachineRuntimeRepository, MachineRuntimePolicy, MachineRuntimeEventMapper, MachineRuntimeService, MachineRuntimeSignalMapper, MachineRuntimeProjectionAdapter, MachineRuntimeConsumptionSubscriber } = require('../src/modules/machine_runtime');

const now = new Date('2026-07-23T12:00:00.000Z');
function platform() {
  const registry = new EventHandlerRegistry(), store = new InMemoryEventStore(), dead = new InMemoryDeadLetterStore();
  const bus = new EventBus({ registry, eventStore: store, outbox: new InMemoryOutbox(), deadLetterStore: dead, maxDeliveryAttempts: 2 });
  return { registry, store, dead, bus };
}
function runtime(p = platform()) {
  const repository = new InMemoryMachineRuntimeRepository();
  let sequence = 0;
  const service = new MachineRuntimeService({ repository, policy: new MachineRuntimePolicy(), eventPublisher: p.bus, eventMapper: new MachineRuntimeEventMapper(), clock: () => now, idFactory: (prefix) => `${prefix}_${++sequence}` });
  return { ...p, repository, service };
}
const command = (machineId, toState, extra = {}) => ({ machineId, toState, reason: 'test', actorType: 'SYSTEM', actorId: 'test', source: 'TEST', correlationId: 'corr_1', ...extra });
async function boot(service, machineId = 'machine_1') { for (const state of ['OFFLINE','BOOTING','IDLE','READY']) await service.transition(command(machineId, state)); }

describe('Machine Runtime and Platform Event Bus Foundation v1', () => {
  it('executes the legal customer purchase transition path and records every transition', async () => {
    const { service, repository } = runtime(); await boot(service);
    const session = await service.startSession({ machineId: 'machine_1', sessionType: 'CUSTOMER_PURCHASE', initiatedBy: { actorType: 'CUSTOMER', actorId: 'c1' }, orderId: 'o1', paymentId: 'p1', correlationId: 'corr_1' });
    for (const state of ['CUSTOMER_SESSION','ORDER_PENDING','PAYMENT_PENDING','PAYMENT_CONFIRMED','DISPENSE_AUTHORIZED','CUP_DISPENSING','PRODUCT_DISPENSING','TOPPING_DISPENSING','COMPLETING','COMPLETED','READY']) await service.transition(command('machine_1', state, { sessionId: session.sessionId }));
    await service.completeSession(session.sessionId);
    assert.equal(service.get('machine_1').currentState, 'READY');
    assert.equal(repository.listTransitions('machine_1').length, 15);
    assert.equal(session.status, 'COMPLETED');
  });

  it('rejects illegal transitions deterministically and publishes the rejection', async () => {
    const { service, store } = runtime();
    await assert.rejects(() => service.transition(command('m1', 'READY')), ({ code, fromState, toState }) => code === 'MACHINE_RUNTIME_ILLEGAL_TRANSITION' && fromState === 'UNKNOWN' && toState === 'READY');
    assert.equal(store.list()[0].eventType, 'MACHINE_RUNTIME_ILLEGAL_TRANSITION_REJECTED');
  });

  it('supports operator test and maintenance sessions while preventing conflicts', async () => {
    for (const type of ['OPERATOR_TEST','MAINTENANCE']) {
      const { service } = runtime(); await boot(service, type);
      const session = await service.startSession({ machineId: type, sessionType: type, initiatedBy: { actorType: 'OPERATOR', actorId: 'op1' }, operatorId: 'op1', testRunId: type === 'OPERATOR_TEST' ? 'test1' : null, correlationId: 'c' });
      await assert.rejects(() => service.startSession({ machineId: type, sessionType: 'CLEANING', initiatedBy: {}, correlationId: 'c2' }), ({ code }) => code === 'MACHINE_RUNTIME_SESSION_CONFLICT');
      assert.equal(session.sessionType, type);
    }
  });

  it('enters error, recovery, and recovered READY states', async () => {
    const { service, store } = runtime(); await boot(service);
    await service.transition(command('machine_1', 'ERROR')); await service.transition(command('machine_1', 'RECOVERING')); await service.transition(command('machine_1', 'READY'));
    assert.equal(service.get('machine_1').currentState, 'READY');
    assert.ok(store.list().some((event) => event.eventType === 'MACHINE_RUNTIME_RECOVERED'));
  });

  it('maps normalized gateway and simulator signals without vendor XML', async () => {
    const { service } = runtime(); await service.transition(command('m1', 'OFFLINE'));
    const signal = new MachineRuntimeSignalMapper().fromGateway({ machineId: 'm1', signalType: 'MACHINE_CONNECTED', correlationId: 'c1', source: 'SIMULATOR' });
    await service.acceptSignal(signal);
    assert.equal(service.get('m1').currentState, 'BOOTING');
    assert.equal(JSON.stringify(signal).includes('<xml'), false);
  });

  it('validates and deeply freezes the standard event envelope', () => {
    assert.throws(() => new PlatformEvent({ eventType: 'X', eventVersion: 0 }), ({ code }) => code === 'PLATFORM_EVENT_INVALID' || code === 'PLATFORM_EVENT_VERSION_INVALID');
    const event = new PlatformEvent({ eventId: 'e1', eventType: 'FACT_RECORDED', eventVersion: 1, occurredAt: now, aggregateType: 'TEST', aggregateId: 'a1', actorType: 'SYSTEM', actorId: 's1', sourceChannel: 'TEST', correlationId: 'c1', payload: { nested: { value: 1 } } }, { clock: () => now });
    assert.ok(Object.isFrozen(event)); assert.ok(Object.isFrozen(event.payload.nested));
  });

  it('registers handlers in deterministic order and skips duplicate event delivery', async () => {
    const { registry, bus } = platform(); const seen = [];
    registry.register('FACT', { subscriberId: 'second', order: 20, handler: async () => seen.push('second') });
    registry.register('FACT', { subscriberId: 'first', order: 10, handler: async () => seen.push('first') });
    const value = { eventId: 'same', eventType: 'FACT', eventVersion: 1, occurredAt: now, aggregateType: 'T', aggregateId: '1', actorType: 'SYSTEM', actorId: 'x', sourceChannel: 'TEST', correlationId: 'c', payload: {} };
    await bus.publish(value); await bus.publish(value);
    assert.deepEqual(seen, ['first','second']);
    assert.equal(bus.listDeliveries().filter((d) => d.status === 'DUPLICATE_SKIPPED').length, 2);
  });

  it('isolates non-critical failure, retries, and dead-letters it', async () => {
    const { registry, bus, dead } = platform(); let good = 0;
    registry.register('FACT', { subscriberId: 'bad', order: 1, handler: async () => { throw new Error('failed'); } });
    registry.register('FACT', { subscriberId: 'good', order: 2, handler: async () => { good += 1; } });
    await bus.publish({ eventType: 'FACT', aggregateType: 'T', aggregateId: '1', actorType: 'SYSTEM', actorId: 'x', sourceChannel: 'TEST', correlationId: 'c', payload: {} });
    assert.equal(good, 1); assert.equal(dead.list()[0].attempts, 2);
  });

  it('projects Digital Twin fields and prevents duplicate inventory consumption', async () => {
    const { registry, bus } = platform(); const twin = new MachineRuntimeProjectionAdapter(); const movements = [];
    registry.register('*', twin.subscriber());
    const inventory = new MachineRuntimeConsumptionSubscriber({ inventoryService: { recordConsumption: async (fact) => movements.push(fact) } });
    registry.register('CUP_DISPENSE_COMPLETED', inventory.subscriber());
    const value = { eventId: 'cup1', eventType: 'CUP_DISPENSE_COMPLETED', aggregateType: 'MACHINE_RUNTIME', aggregateId: 'm1', actorType: 'MACHINE', actorId: 'm1', sourceChannel: 'SIMULATOR', correlationId: 'c', payload: { toState: 'PRODUCT_DISPENSING', consumptionReason: 'TEST_CUP' } };
    await bus.publish(value); await bus.publish(value);
    assert.equal(movements.length, 1); assert.equal(movements[0].reason, 'TEST_CUP');
    assert.equal(twin.get('m1').currentRuntimeState, 'PRODUCT_DISPENSING');
  });

  it('authorizes read-only runtime and event endpoints and exposes no mutations', async () => {
    const r = runtime(); await boot(r.service);
    const app = createApp({ dependencies: { machineRuntimeService: r.service, platformEventStore: r.store, platformEventBus: r.bus, deadLetterStore: r.dead, adminAuth: { environment: 'development' }, featureFlags: {} } });
    const server = app.listen(0); const base = `http://127.0.0.1:${server.address().port}/api/v1/admin`;
    try {
      const headers = { 'X-Admin-Role': 'ADMIN' };
      for (const path of ['machine-runtime','machine-runtime/machine_1','machine-runtime/machine_1/session','machine-runtime/machine_1/transitions','platform-events','platform-events/dead-letter']) assert.equal((await fetch(`${base}/${path}`, { headers })).status, 200, path);
      assert.equal((await fetch(`${base}/machine-runtime`, { headers: { 'X-Admin-Role': 'SUPPORT' } })).status, 403);
      assert.equal((await fetch(`${base}/machine-runtime`, { method: 'POST', headers })).status, 404);
    } finally { await new Promise((resolve) => server.close(resolve)); }
  });
});
