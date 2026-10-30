const crypto = require('crypto');

const MACHINE_STATUSES = new Set(['READY', 'BUSY', 'ERROR', 'SERVICE', 'OFFLINE']);
const DISPENSE_RESULTS = new Set(['SUCCESS', 'FAILED']);

class EquipmentIntegrationService {
  constructor({ clock = () => new Date(), testMachineId = 'TEST-MACHINE-001', telemetryLimit = 200, eventLimit = 200 } = {}) {
    this.clock = clock;
    this.testMachineId = testMachineId;
    this.telemetryLimit = telemetryLimit;
    this.eventLimit = eventLimit;
    this.machines = new Map();
    this.commands = new Map();
    this.commandResults = new Map();
    this.events = [];
    this.registerMachine({ machine_id: testMachineId, source: 'SANDBOX_BOOTSTRAP' });
  }

  registerMachine(input = {}) {
    const machineId = requiredString(input.machine_id, 'machine_id');
    const now = this.clock().toISOString();
    const previous = this.machines.get(machineId);
    const record = {
      machineId,
      serialNumber: optionalString(input.serial_number) || previous?.serialNumber || null,
      controllerModel: optionalString(input.controller_model) || previous?.controllerModel || null,
      controllerVersion: previous?.controllerVersion || null,
      firmwareVersion: previous?.firmwareVersion || null,
      status: previous?.status || 'OFFLINE',
      online: previous?.online || false,
      registeredAt: previous?.registeredAt || now,
      lastSeenAt: previous?.lastSeenAt || null,
      latestTelemetry: previous?.latestTelemetry || null,
      telemetry: previous?.telemetry || [],
      source: optionalString(input.source) || previous?.source || 'EQUIPMENT_API',
    };
    this.machines.set(machineId, record);
    return this.machineSnapshot(machineId);
  }

  heartbeat(machineId, input = {}) {
    const machine = this.requireMachine(machineId);
    assertMachineIdMatches(machineId, input.machine_id);
    const status = normalizeStatus(input.status || 'READY');
    const timestamp = normalizeTimestamp(input.timestamp, this.clock);
    machine.status = status;
    machine.online = input.online === undefined ? status !== 'OFFLINE' : Boolean(input.online);
    machine.lastSeenAt = timestamp;
    machine.controllerVersion = optionalString(input.controller_version) || machine.controllerVersion;
    machine.firmwareVersion = optionalString(input.firmware_version) || machine.firmwareVersion;
    return this.machineSnapshot(machineId);
  }

  recordStatus(machineId, input = {}) {
    return this.heartbeat(machineId, input);
  }

  recordTelemetry(machineId, input = {}) {
    const machine = this.requireMachine(machineId);
    assertMachineIdMatches(machineId, input.machine_id);
    const timestamp = normalizeTimestamp(input.timestamp, this.clock);
    const telemetry = input.telemetry && typeof input.telemetry === 'object' && !Array.isArray(input.telemetry)
      ? sanitizeObject(input.telemetry)
      : {};
    const sample = {
      machineId,
      recordedAt: timestamp,
      receivedAt: this.clock().toISOString(),
      values: telemetry,
      errors: Array.isArray(input.errors) ? input.errors.map((item) => sanitizeObject(item)) : [],
    };
    machine.lastSeenAt = timestamp;
    machine.online = true;
    if (machine.status === 'OFFLINE') machine.status = 'READY';
    machine.latestTelemetry = sample;
    machine.telemetry.unshift(sample);
    machine.telemetry.length = Math.min(machine.telemetry.length, this.telemetryLimit);
    return clone(sample);
  }

  enqueueDispense(machineId, input = {}) {
    this.requireMachine(machineId);
    const commandId = optionalString(input.command_id) || `cmd_${crypto.randomUUID()}`;
    if (this.commands.has(commandId)) return clone(this.commands.get(commandId));
    const issuedAt = this.clock().toISOString();
    const expiresAt = input.expires_at ? normalizeTimestamp(input.expires_at, this.clock) : new Date(this.clock().getTime() + 5 * 60 * 1000).toISOString();
    const command = {
      command_id: commandId,
      type: 'DISPENSE',
      machine_id: machineId,
      payload: sanitizeObject(input.payload || {}),
      issued_at: issuedAt,
      expires_at: expiresAt,
      state: 'PENDING',
      acknowledged_at: null,
    };
    this.commands.set(commandId, command);
    return clone(command);
  }

  pendingCommands(machineId) {
    this.requireMachine(machineId);
    const now = this.clock().getTime();
    return [...this.commands.values()]
      .filter((command) => command.machine_id === machineId && ['PENDING', 'ACKNOWLEDGED'].includes(command.state) && new Date(command.expires_at).getTime() >= now)
      .map(clone);
  }

  acknowledgeCommand(machineId, commandId) {
    const command = this.requireCommand(machineId, commandId);
    if (['SUCCESS', 'FAILED'].includes(command.state)) return clone(command);
    if (!command.acknowledged_at) command.acknowledged_at = this.clock().toISOString();
    command.state = 'ACKNOWLEDGED';
    return clone(command);
  }

  recordDispenseResult(machineId, input = {}) {
    this.requireMachine(machineId);
    assertMachineIdMatches(machineId, input.machine_id);
    const commandId = requiredString(input.command_id, 'command_id');
    const command = this.requireCommand(machineId, commandId);
    const status = String(input.status || '').toUpperCase();
    if (!DISPENSE_RESULTS.has(status)) throw validationError('status must be SUCCESS or FAILED.');

    const existing = this.commandResults.get(commandId);
    if (existing) {
      if (existing.status !== status || (existing.error_code || null) !== (input.error_code || null)) {
        const error = new Error('Conflicting result for an already completed command.');
        error.code = 'EQUIPMENT_COMMAND_RESULT_CONFLICT';
        error.statusCode = 409;
        throw error;
      }
      return clone(existing);
    }

    const result = {
      command_id: commandId,
      machine_id: machineId,
      status,
      started_at: input.started_at ? normalizeTimestamp(input.started_at, this.clock) : null,
      completed_at: normalizeTimestamp(input.completed_at, this.clock),
      error_code: optionalString(input.error_code),
      actual_mix_amount: optionalNumber(input.actual_mix_amount),
      actual_topping_amount: optionalNumber(input.actual_topping_amount),
    };
    this.commandResults.set(commandId, result);
    command.state = status;
    this.recordEvent(machineId, {
      event_id: `evt_${crypto.randomUUID()}`,
      timestamp: result.completed_at,
      event_type: status === 'SUCCESS' ? 'DISPENSE_COMPLETED' : 'DISPENSE_FAILED',
      severity: status === 'SUCCESS' ? 'INFO' : 'ERROR',
      error_code: result.error_code,
      details: { command_id: commandId },
    });
    return clone(result);
  }

  recordEvent(machineId, input = {}) {
    this.requireMachine(machineId);
    assertMachineIdMatches(machineId, input.machine_id);
    const eventId = requiredString(input.event_id || `evt_${crypto.randomUUID()}`, 'event_id');
    const existing = this.events.find((item) => item.event_id === eventId);
    if (existing) return clone(existing);
    const event = {
      event_id: eventId,
      machine_id: machineId,
      timestamp: normalizeTimestamp(input.timestamp, this.clock),
      event_type: requiredString(input.event_type, 'event_type'),
      severity: optionalString(input.severity) || 'INFO',
      error_code: optionalString(input.error_code),
      details: sanitizeObject(input.details || {}),
    };
    this.events.unshift(event);
    this.events.length = Math.min(this.events.length, this.eventLimit);
    return clone(event);
  }

  dashboardSnapshot(machineId = this.testMachineId) {
    const machine = this.requireMachine(machineId);
    const commands = [...this.commands.values()].filter((item) => item.machine_id === machineId);
    const results = [...this.commandResults.values()].filter((item) => item.machine_id === machineId);
    const successful = results.filter((item) => item.status === 'SUCCESS').length;
    const failed = results.filter((item) => item.status === 'FAILED').length;
    return {
      machine: this.machineSnapshot(machineId),
      telemetry: machine.latestTelemetry ? clone(machine.latestTelemetry) : null,
      counters: {
        commands_total: commands.length,
        dispense_success: successful,
        dispense_failed: failed,
        technical_success_rate_percent: results.length ? Number(((successful / results.length) * 100).toFixed(2)) : null,
      },
      recent_events: this.events.filter((item) => item.machine_id === machineId).slice(0, 20).map(clone),
      pending_commands: this.pendingCommands(machineId),
      data_mode: 'SANDBOX',
    };
  }

  machineSnapshot(machineId) {
    const machine = this.requireMachine(machineId);
    return clone({
      machine_id: machine.machineId,
      serial_number: machine.serialNumber,
      controller_model: machine.controllerModel,
      controller_version: machine.controllerVersion,
      firmware_version: machine.firmwareVersion,
      status: machine.status,
      online: machine.online,
      registered_at: machine.registeredAt,
      last_seen_at: machine.lastSeenAt,
      source: machine.source,
    });
  }

  requireMachine(machineId) {
    const machine = this.machines.get(machineId);
    if (!machine) {
      const error = new Error('Machine is not registered in Equipment Integration sandbox.');
      error.code = 'EQUIPMENT_MACHINE_NOT_FOUND';
      error.statusCode = 404;
      throw error;
    }
    return machine;
  }

  requireCommand(machineId, commandId) {
    const command = this.commands.get(commandId);
    if (!command || command.machine_id !== machineId) {
      const error = new Error('Equipment command was not found.');
      error.code = 'EQUIPMENT_COMMAND_NOT_FOUND';
      error.statusCode = 404;
      throw error;
    }
    return command;
  }
}

function normalizeStatus(value) {
  const status = String(value).toUpperCase();
  if (!MACHINE_STATUSES.has(status)) throw validationError('Unsupported machine status.');
  return status;
}
function normalizeTimestamp(value, clock) {
  const date = value ? new Date(value) : clock();
  if (Number.isNaN(date.getTime())) throw validationError('Invalid timestamp.');
  return date.toISOString();
}
function assertMachineIdMatches(machineId, supplied) {
  if (supplied !== undefined && supplied !== machineId) throw validationError('machine_id must match path id.');
}
function requiredString(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw validationError(`${name} is required.`);
  return value.trim();
}
function optionalString(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function optionalNumber(value) { return value === undefined || value === null ? null : Number.isFinite(Number(value)) ? Number(value) : null; }
function sanitizeObject(value) { return JSON.parse(JSON.stringify(value || {})); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function validationError(message) { const error = new TypeError(message); error.code = 'EQUIPMENT_REQUEST_INVALID'; error.statusCode = 400; return error; }

module.exports = { EquipmentIntegrationService };
