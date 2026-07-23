const MACHINE_STATUS = Object.freeze({
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  MAINTENANCE: 'MAINTENANCE',
  ERROR: 'ERROR',
});

const MACHINE_STATUSES = Object.freeze(Object.values(MACHINE_STATUS));

const DISPENSE_REQUEST_STATE = Object.freeze({
  REQUESTED: 'REQUESTED',
  STARTED: 'STARTED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
});

const DISPENSE_REQUEST_STATES = Object.freeze(Object.values(DISPENSE_REQUEST_STATE));

class MachineEntity {
  constructor({ id, machineCode, name, location, status, createdAt, updatedAt }) {
    this.id = id;
    this.machineCode = machineCode;
    this.name = name;
    this.location = location || null;
    this.status = normalizeMachineStatus(status);
    this.createdAt = createdAt;
    this.updatedAt = updatedAt || createdAt;
  }

  canReceiveDispenseCommand() {
    return this.status === MACHINE_STATUS.ONLINE;
  }
}

class DispenseRequestEntity {
  constructor({
    id,
    orderId,
    machineId,
    state,
    commandId,
    commandType,
    commandPayload,
    failureReason,
    requestedAt,
    startedAt,
    completedAt,
    failedAt,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.orderId = orderId;
    this.machineId = machineId;
    this.state = normalizeDispenseRequestState(state);
    this.commandId = commandId;
    this.commandType = commandType || 'DispenseCommand';
    this.commandPayload = commandPayload || {};
    this.failureReason = failureReason || null;
    this.requestedAt = requestedAt;
    this.startedAt = startedAt || null;
    this.completedAt = completedAt || null;
    this.failedAt = failedAt || null;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt || createdAt;
  }

  canStart() {
    return this.state === DISPENSE_REQUEST_STATE.REQUESTED;
  }

  canComplete() {
    return this.state === DISPENSE_REQUEST_STATE.STARTED;
  }

  canFail() {
    return [
      DISPENSE_REQUEST_STATE.REQUESTED,
      DISPENSE_REQUEST_STATE.STARTED,
    ].includes(this.state);
  }

  isTerminal() {
    return [
      DISPENSE_REQUEST_STATE.COMPLETED,
      DISPENSE_REQUEST_STATE.FAILED,
    ].includes(this.state);
  }
}

function toMachineEntity(machine) {
  if (!machine) {
    return null;
  }

  return new MachineEntity(machine);
}

function toDispenseRequestEntity(dispenseRequest) {
  if (!dispenseRequest) {
    return null;
  }

  return new DispenseRequestEntity(dispenseRequest);
}

function normalizeMachineStatus(status) {
  const normalized = String(status || MACHINE_STATUS.OFFLINE).toUpperCase();

  if (!MACHINE_STATUSES.includes(normalized)) {
    return MACHINE_STATUS.OFFLINE;
  }

  return normalized;
}

function normalizeDispenseRequestState(state) {
  const normalized = String(state || DISPENSE_REQUEST_STATE.REQUESTED).toUpperCase();

  if (!DISPENSE_REQUEST_STATES.includes(normalized)) {
    return DISPENSE_REQUEST_STATE.REQUESTED;
  }

  return normalized;
}

module.exports = {
  DISPENSE_REQUEST_STATE,
  DISPENSE_REQUEST_STATES,
  DispenseRequestEntity,
  MACHINE_STATUS,
  MACHINE_STATUSES,
  MachineEntity,
  normalizeDispenseRequestState,
  normalizeMachineStatus,
  toDispenseRequestEntity,
  toMachineEntity,
};
