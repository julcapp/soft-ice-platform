const assert = require('node:assert/strict');
const test = require('node:test');

const { MachineGateway } = require('../src/modules/machine_gateway');
const {
  SIMULATOR_STATE,
  SimulatedMachineGateway,
} = require('../src/modules/machine_simulator');
const { createTestDependencies } = require('./helpers/createTestDependencies');

test('simulator implements MachineGateway and deterministic lifecycle, heartbeat, telemetry, and inventory', async () => {
  const now = new Date('2026-07-21T12:00:00.000Z');
  const simulator = new SimulatedMachineGateway({
    machineId: 'sim_1',
    seed: 42,
    clock: () => now,
    cupStock: 2,
    ingredientLevels: { mix_vanilla: 3, syrup_strawberry: 2 },
    heartbeatIntervalMs: 0,
  });

  assert.ok(simulator instanceof MachineGateway);
  assert.equal(simulator.getStatus().lifecycle, SIMULATOR_STATE.OFFLINE);
  await simulator.start();
  assert.equal(simulator.getStatus().lifecycle, SIMULATOR_STATE.READY);
  assert.equal(simulator.getStatus().lastHeartbeatAt, now.toISOString());

  const firstTelemetry = simulator.getTelemetry().samples[0];
  const twin = new SimulatedMachineGateway({
    machineId: 'sim_1',
    seed: 42,
    clock: () => now,
    cupStock: 2,
    ingredientLevels: { mix_vanilla: 3, syrup_strawberry: 2 },
    heartbeatIntervalMs: 0,
  });
  await twin.start();
  assert.deepEqual(twin.getTelemetry().samples[0], firstTelemetry);

  const result = await simulator.sendCommand({
    commandId: 'command_1',
    type: 'dispense',
    payload: { ingredients: { mix_vanilla: 1, syrup_strawberry: 1 } },
  });
  assert.equal(result.status, 'success');
  assert.equal(simulator.getStatus().cupStock, 1);
  assert.deepEqual(simulator.getStatus().ingredientLevels, {
    mix_vanilla: 2,
    syrup_strawberry: 1,
  });
  assert.deepEqual(
    simulator.getStatus().transitions.map(({ to }) => to),
    ['ONLINE', 'READY', 'BUSY', 'DISPENSING', 'READY'],
  );
});

test('simulator covers cleaning, dispense failure, machine error, reset, and empty cup stock', async () => {
  const simulator = new SimulatedMachineGateway({
    cupStock: 1,
    ingredientLevels: { mix_vanilla: 1 },
    dispenseOutcomes: ['failure'],
    heartbeatIntervalMs: 0,
  });
  await simulator.start();
  await simulator.sendCommand({ type: 'start_cleaning' });
  assert.equal(simulator.getStatus().lifecycle, SIMULATOR_STATE.CLEANING);
  await simulator.sendCommand({ type: 'finish_cleaning' });
  assert.equal(simulator.getStatus().lifecycle, SIMULATOR_STATE.READY);

  await assert.rejects(
    simulator.sendCommand({ type: 'dispense' }),
    { code: 'MACHINE_DISPENSING_FAILED' },
  );
  assert.equal(simulator.getStatus().lifecycle, SIMULATOR_STATE.ERROR);
  assert.equal(simulator.getTelemetry().samples[0].values.error_code, 'MACHINE_DISPENSING_FAILED');
  await simulator.sendCommand({ type: 'reset_error' });

  await simulator.sendCommand({ type: 'dispense' });
  await assert.rejects(
    simulator.sendCommand({ type: 'dispense' }),
    { code: 'MACHINE_INVENTORY_INSUFFICIENT' },
  );
  await assert.rejects(
    simulator.sendCommand({ type: 'simulate_error', payload: { code: 'MACHINE_DOOR_OPEN' } }),
    { code: 'MACHINE_DOOR_OPEN' },
  );
  assert.equal(simulator.getStatus().lifecycle, SIMULATOR_STATE.ERROR);
});

test('order -> payment -> MachineGateway simulator -> dispense completes without changing business services', async () => {
  const now = new Date('2026-07-21T12:00:00.000Z');
  const dependencies = createTestDependencies({
    botToken: '123456:test_bot_token',
    now,
  });
  const machine = await dependencies.machineRuntime.registerMachine({
    machineCode: 'simulator_e2e_1',
    name: 'Deterministic simulator',
    status: 'ONLINE',
  });
  const created = await dependencies.orderRuntime.createOrder(
    'customer_simulator_test',
    { amount: 160, currency: 'RUB' },
    { correlationId: 'simulator_e2e' },
  );
  const paid = await dependencies.orderRuntime.confirmPayment(created.order.id, {
    customerId: 'customer_simulator_test',
    machineId: machine.machine.id,
    actorType: 'system',
    actorId: 'payment_runtime',
    correlationId: 'simulator_e2e',
  });
  assert.equal(paid.order.status, 'PAID');
  assert.equal(paid.machineDispenseIntegration.state, 'REQUESTED');

  const dispenseRequest = await dependencies.machineRuntime.getOwnOrderDispense(
    'customer_simulator_test',
    created.order.id,
  );
  const simulator = new SimulatedMachineGateway({
    machineId: machine.machine.id,
    cupStock: 1,
    ingredientLevels: { mix_vanilla: 1 },
    heartbeatIntervalMs: 0,
  });
  await simulator.start();
  const gatewayResult = await simulator.sendCommand({
    commandId: dispenseRequest.commandId,
    machineId: dispenseRequest.machineId,
    type: dispenseRequest.commandType,
    payload: dispenseRequest.commandPayload,
  });
  assert.equal(gatewayResult.status, 'success');

  await dependencies.machineRuntime.receiveDispenseCommand(dispenseRequest.id, {
    actorType: 'machine',
    actorId: simulator.machineId,
    correlationId: 'simulator_e2e',
  });
  const completed = await dependencies.machineRuntime.completeDispense(dispenseRequest.id, {
    actorType: 'machine',
    actorId: simulator.machineId,
    correlationId: 'simulator_e2e',
  });
  assert.equal(completed.dispenseRequest.state, 'COMPLETED');
  assert.equal(simulator.getStatus().cupStock, 0);
});
