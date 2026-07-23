function toMachineDto(machine) {
  return {
    type: 'machine',
    id: machine.id,
    attributes: {
      machine_id: machine.id,
      machine_code: machine.machineCode,
      name: machine.name,
      location: machine.location || null,
      status: machine.status,
      created_at: toIsoString(machine.createdAt),
      updated_at: toIsoString(machine.updatedAt || machine.createdAt),
    },
  };
}

function toMachineRegistrationDto({ machine }) {
  return toMachineDto(machine);
}

function toDispenseRequestDto(dispenseRequest) {
  return {
    type: 'dispense_request',
    id: dispenseRequest.id,
    attributes: {
      dispense_request_id: dispenseRequest.id,
      order_id: dispenseRequest.orderId,
      machine_id: dispenseRequest.machineId,
      machine_code: dispenseRequest.machine
        ? dispenseRequest.machine.machineCode
        : dispenseRequest.commandPayload?.machine_code || null,
      state: dispenseRequest.state,
      command: {
        command_id: dispenseRequest.commandId,
        command_type: dispenseRequest.commandType,
        payload: dispenseRequest.commandPayload || {},
      },
      failure_reason: dispenseRequest.failureReason || null,
      requested_at: toIsoString(dispenseRequest.requestedAt),
      started_at: toIsoString(dispenseRequest.startedAt),
      completed_at: toIsoString(dispenseRequest.completedAt),
      failed_at: toIsoString(dispenseRequest.failedAt),
      created_at: toIsoString(dispenseRequest.createdAt),
      updated_at: toIsoString(dispenseRequest.updatedAt || dispenseRequest.createdAt),
    },
  };
}

function toIsoString(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}

module.exports = {
  toDispenseRequestDto,
  toMachineDto,
  toMachineRegistrationDto,
};
