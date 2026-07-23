const { MachineGateway } = require('../machine_gateway/MachineGateway');
const { DeterministicRandom } = require('./DeterministicRandom');
const { SIMULATOR_STATE } = require('./SimulatorState');

const DEFAULT_INGREDIENTS = Object.freeze({
  mix_vanilla: 100,
  syrup_strawberry: 100,
  topping_oreo: 100,
});

class SimulatedMachineGateway extends MachineGateway {
  constructor({
    machineId = 'machine_simulator_1',
    seed = 1,
    clock = () => new Date(),
    cupStock = 20,
    ingredientLevels = DEFAULT_INGREDIENTS,
    dispenseOutcomes = [],
    failureRate = 0,
    errorRate = 0,
    heartbeatIntervalMs = 15000,
    telemetryLimit = 100,
  } = {}) {
    super();
    this.machineId = machineId;
    this.clock = clock;
    this.random = new DeterministicRandom(seed);
    this.state = SIMULATOR_STATE.OFFLINE;
    this.cupStock = nonNegativeInteger(cupStock, 'cupStock');
    this.ingredientLevels = normalizeLevels(ingredientLevels);
    this.dispenseOutcomes = [...dispenseOutcomes];
    this.failureRate = probability(failureRate, 'failureRate');
    this.errorRate = probability(errorRate, 'errorRate');
    this.heartbeatIntervalMs = nonNegativeInteger(heartbeatIntervalMs, 'heartbeatIntervalMs');
    this.telemetryLimit = nonNegativeInteger(telemetryLimit, 'telemetryLimit');
    this.telemetry = [];
    this.transitions = [];
    this.lastHeartbeatAt = null;
    this.lastError = null;
    this.heartbeatTimer = null;
  }

  async start() {
    await this.reconnect();
    if (this.heartbeatIntervalMs > 0) {
      this.heartbeatTimer = setInterval(() => this.simulateHeartbeat(), this.heartbeatIntervalMs);
      this.heartbeatTimer.unref?.();
    }
    return this.getStatus();
  }

  async stop() {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.transition(SIMULATOR_STATE.OFFLINE, 'simulator_stopped');
    return this.getStatus();
  }

  async reconnect() {
    this.lastError = null;
    this.transition(SIMULATOR_STATE.ONLINE, 'connection_established');
    this.simulateHeartbeat();
    this.transition(SIMULATOR_STATE.READY, 'self_check_completed');
    return this.getStatus();
  }

  getStatus() {
    return {
      machineId: this.machineId,
      connection: this.state === SIMULATOR_STATE.OFFLINE ? 'DISCONNECTED' : 'CONNECTED',
      availability: this.state,
      lifecycle: this.state,
      lastHeartbeatAt: this.lastHeartbeatAt,
      lastError: this.lastError ? { ...this.lastError } : null,
      cupStock: this.cupStock,
      ingredientLevels: { ...this.ingredientLevels },
      transitions: this.transitions.map((transition) => ({ ...transition })),
    };
  }

  getTelemetry() {
    this.generateTelemetry();
    return {
      machineId: this.machineId,
      samples: this.telemetry.map(cloneSample),
    };
  }

  async sendCommand(request = {}) {
    const type = requiredText(request.type, 'type').toLowerCase();
    const commandId = request.commandId || `sim_command_${this.transitions.length + 1}`;

    if (type === 'heartbeat') {
      this.assertConnected();
      return { commandId, status: 'ok', code: null, data: this.simulateHeartbeat() };
    }
    if (type === 'dispense' || type === 'dispensecommand' || type === 'prepareproduct') {
      return this.dispense(commandId, request.payload || {});
    }
    if (type === 'start_cleaning') {
      this.assertState(SIMULATOR_STATE.READY, 'MACHINE_NOT_READY');
      this.transition(SIMULATOR_STATE.CLEANING, 'cleaning_started');
      return { commandId, status: 'accepted', code: null, data: { lifecycle: this.state } };
    }
    if (type === 'finish_cleaning') {
      this.assertState(SIMULATOR_STATE.CLEANING, 'MACHINE_CLEANING_NOT_ACTIVE');
      this.transition(SIMULATOR_STATE.READY, 'cleaning_completed');
      return { commandId, status: 'ok', code: null, data: { lifecycle: this.state } };
    }
    if (type === 'simulate_error') {
      this.enterError(request.payload?.code || 'MACHINE_SIMULATED_ERROR');
      throw simulatorError('Simulated machine error.', this.lastError.code);
    }
    if (type === 'reset_error') {
      this.assertState(SIMULATOR_STATE.ERROR, 'MACHINE_ERROR_NOT_ACTIVE');
      this.lastError = null;
      this.transition(SIMULATOR_STATE.ONLINE, 'error_reset');
      this.transition(SIMULATOR_STATE.READY, 'self_check_completed');
      return { commandId, status: 'ok', code: null, data: { lifecycle: this.state } };
    }

    throw simulatorError(`Unsupported simulator command: ${request.type}.`, 'MACHINE_COMMAND_UNSUPPORTED');
  }

  simulateHeartbeat() {
    this.assertConnected();
    this.lastHeartbeatAt = this.clock().toISOString();
    return { machineId: this.machineId, status: this.state, timestamp: this.lastHeartbeatAt };
  }

  generateTelemetry() {
    const timestamp = this.clock().toISOString();
    const sample = {
      machineId: this.machineId,
      recordedAt: timestamp,
      receivedAt: timestamp,
      values: {
        lifecycle: this.state,
        temperature_c: Number((-5 + (this.random.next() - 0.5)).toFixed(2)),
        cup_stock: this.cupStock,
        ingredient_levels: { ...this.ingredientLevels },
        error_code: this.lastError?.code || null,
      },
    };
    this.telemetry.unshift(sample);
    this.telemetry.length = Math.min(this.telemetry.length, this.telemetryLimit);
    return cloneSample(sample);
  }

  async dispense(commandId, payload) {
    this.assertState(SIMULATOR_STATE.READY, 'MACHINE_NOT_READY');
    const usage = normalizeLevels(payload.ingredients || { mix_vanilla: 1 });
    this.assertInventory(usage);
    this.transition(SIMULATOR_STATE.BUSY, 'dispense_command_accepted');
    this.transition(SIMULATOR_STATE.DISPENSING, 'dispense_started');

    const scripted = this.dispenseOutcomes.length ? this.dispenseOutcomes.shift() : null;
    const machineError = scripted === 'error' || (scripted === null && this.random.next() < this.errorRate);
    const failed = scripted === 'failure' || (scripted === null && this.random.next() < this.failureRate);

    if (machineError || failed) {
      const code = machineError ? 'MACHINE_SIMULATED_ERROR' : 'MACHINE_DISPENSING_FAILED';
      this.enterError(code);
      throw simulatorError('Simulated dispense failed.', code);
    }

    this.cupStock -= 1;
    for (const [ingredientId, amount] of Object.entries(usage)) {
      this.ingredientLevels[ingredientId] -= amount;
    }
    this.transition(SIMULATOR_STATE.READY, 'dispense_completed');
    return {
      commandId,
      status: 'success',
      code: null,
      data: { lifecycle: this.state, cupsRemaining: this.cupStock, ingredientLevels: { ...this.ingredientLevels } },
    };
  }

  assertInventory(usage) {
    if (this.cupStock < 1) throw simulatorError('No cups available.', 'MACHINE_INVENTORY_INSUFFICIENT');
    for (const [ingredientId, amount] of Object.entries(usage)) {
      if (!(ingredientId in this.ingredientLevels) || this.ingredientLevels[ingredientId] < amount) {
        throw simulatorError(`Insufficient ingredient: ${ingredientId}.`, 'MACHINE_INVENTORY_INSUFFICIENT');
      }
    }
  }

  assertConnected() {
    if (this.state === SIMULATOR_STATE.OFFLINE) throw simulatorError('Simulator is offline.', 'MACHINE_OFFLINE');
  }

  assertState(expected, code) {
    if (this.state !== expected) throw simulatorError(`Simulator must be ${expected}; current state is ${this.state}.`, code);
  }

  enterError(code) {
    this.lastError = { code, message: 'Simulated machine error.', occurredAt: this.clock().toISOString() };
    this.transition(SIMULATOR_STATE.ERROR, code);
  }

  transition(to, reason) {
    if (this.state === to) return;
    const transition = { from: this.state, to, reason, at: this.clock().toISOString() };
    this.state = to;
    this.transitions.push(transition);
  }
}

function simulatorError(message, code) { const error = new Error(message); error.code = code; return error; }
function requiredText(value, name) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} is required.`); return value.trim(); }
function probability(value, name) { const number = Number(value); if (!Number.isFinite(number) || number < 0 || number > 1) throw new TypeError(`${name} must be between 0 and 1.`); return number; }
function nonNegativeInteger(value, name) { const number = Number(value); if (!Number.isInteger(number) || number < 0) throw new TypeError(`${name} must be a non-negative integer.`); return number; }
function normalizeLevels(levels) { return Object.fromEntries(Object.entries(levels || {}).map(([id, value]) => [id, nonNegativeInteger(value, `ingredientLevels.${id}`)])); }
function cloneSample(sample) { return { ...sample, values: { ...sample.values, ingredient_levels: { ...sample.values.ingredient_levels } } }; }

module.exports = { DEFAULT_INGREDIENTS, SimulatedMachineGateway };
