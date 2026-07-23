const crypto = require('crypto');

const { ApiError } = require('../../platform/errors/ApiError');
const { MACHINE_DOMAIN_EVENTS } = require('../../platform/events/domainEventContract');
const { ORDER_STATUS } = require('../order/OrderEntity');
const {
  DISPENSE_REQUEST_STATE,
  MACHINE_STATUS,
  normalizeMachineStatus,
  toDispenseRequestEntity,
  toMachineEntity,
} = require('./MachineEntity');

class MachineService {
  constructor({
    machineRepository,
    auditRepository,
    domainEventPublisher,
    clock = () => new Date(),
  }) {
    this.machineRepository = machineRepository;
    this.auditRepository = auditRepository;
    this.domainEventPublisher = domainEventPublisher;
    this.clock = clock;
  }

  async registerMachine(request, context = {}) {
    const machineCode = parseRequiredText(request.machineCode, 'machine_code');
    const name = parseRequiredText(request.name, 'name');
    const location = normalizeOptionalText(request.location);
    const status = normalizeMachineStatus(request.status || MACHINE_STATUS.ONLINE);
    const existing = await this.machineRepository.findByMachineCode(machineCode);

    if (existing) {
      return {
        machine: existing,
        created: false,
      };
    }

    const machine = await this.machineRepository.createMachine({
      machineCode,
      name,
      location,
      status,
    });

    await this.recordAudit({
      eventType: 'MachineRegistered',
      targetType: 'Machine',
      targetId: machine.id,
      action: 'register',
      decision: 'success',
      reasonCode: 'machine_registered',
      context,
      metadata: {
        machine_code: machine.machineCode,
        status: machine.status,
      },
    });

    return {
      machine,
      created: true,
    };
  }

  async getMachine(machineId) {
    const machine = await this.machineRepository.findById(machineId);

    if (!machine) {
      throw new ApiError({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Machine was not found.',
        source: 'runtime',
      });
    }

    return machine;
  }

  async getOwnOrderDispense(customerId, orderId) {
    const dispenseRequest =
      await this.machineRepository.findDispenseByOrderIdForCustomer(orderId, customerId);

    if (!dispenseRequest) {
      throw new ApiError({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Dispense request was not found.',
        source: 'runtime',
      });
    }

    return dispenseRequest;
  }

  async requestDispenseForPaidOrder(order, context = {}) {
    if (!order || order.status !== ORDER_STATUS.PAID) {
      throw new ApiError({
        statusCode: 422,
        code: 'MACHINE_DISPENSE_REQUIRES_PAID_ORDER',
        message: 'Machine dispense can be requested only for a paid order.',
        source: 'runtime',
      });
    }

    const existing = await this.machineRepository.findDispenseByOrderId(order.id);

    if (existing) {
      return {
        dispenseRequest: existing,
        command: existing.commandPayload,
        event: null,
        created: false,
      };
    }

    const machine = await this.resolveTargetMachine(context.machineId || order.machineId);
    const machineEntity = toMachineEntity(machine);

    if (!machineEntity.canReceiveDispenseCommand()) {
      throw new ApiError({
        statusCode: 422,
        code: 'MACHINE_NOT_AVAILABLE',
        message: 'Selected machine cannot receive a dispense command.',
        source: 'runtime',
      });
    }

    const requestedAt = this.clock();
    const dispenseRequestId = `dispense_${crypto.randomUUID()}`;
    const command = createDispenseCommand({
      commandId: `machine_command_${crypto.randomUUID()}`,
      dispenseRequestId,
      machine,
      order,
      context,
      issuedAt: requestedAt,
    });

    const result = await this.machineRepository.createDispenseRequest({
      id: dispenseRequestId,
      orderId: order.id,
      machineId: machine.id,
      state: DISPENSE_REQUEST_STATE.REQUESTED,
      commandId: command.command_id,
      commandType: command.command_type,
      commandPayload: command,
      requestedAt,
    });

    if (!result.created) {
      return {
        dispenseRequest: result.dispenseRequest,
        command: result.dispenseRequest.commandPayload,
        event: null,
        created: false,
      };
    }

    const event = await this.publishMachineEvent(
      MACHINE_DOMAIN_EVENTS.MACHINE_DISPENSE_REQUESTED,
      result.dispenseRequest,
      {
        fromState: null,
        toState: DISPENSE_REQUEST_STATE.REQUESTED,
        stateReason: 'order_paid',
        context,
      },
    );

    await this.recordAuditForDispense({
      eventType: MACHINE_DOMAIN_EVENTS.MACHINE_DISPENSE_REQUESTED.name,
      dispenseRequest: result.dispenseRequest,
      action: 'request_dispense',
      decision: 'success',
      reasonCode: 'order_paid',
      context,
    });

    return {
      dispenseRequest: result.dispenseRequest,
      command,
      event,
      created: true,
    };
  }

  async receiveDispenseCommand(dispenseRequestId, context = {}) {
    const current = await this.getDispenseRequestOrThrow(dispenseRequestId);
    const entity = toDispenseRequestEntity(current);

    if (entity.state === DISPENSE_REQUEST_STATE.STARTED) {
      return {
        dispenseRequest: current,
        event: null,
        changed: false,
      };
    }

    if (!entity.canStart()) {
      throw new ApiError({
        statusCode: 422,
        code: 'DISPENSE_START_NOT_ALLOWED',
        message: 'Dispense request cannot be started from its current state.',
        source: 'runtime',
      });
    }

    const startedAt = this.clock();
    const dispenseRequest = await this.machineRepository.updateDispenseState(
      current.id,
      DISPENSE_REQUEST_STATE.STARTED,
      {
        startedAt,
      },
    );
    const event = await this.publishMachineEvent(
      MACHINE_DOMAIN_EVENTS.DISPENSE_STARTED,
      dispenseRequest,
      {
        fromState: current.state,
        toState: DISPENSE_REQUEST_STATE.STARTED,
        stateReason: 'machine_received_command',
        context,
      },
    );

    await this.recordAuditForDispense({
      eventType: MACHINE_DOMAIN_EVENTS.DISPENSE_STARTED.name,
      dispenseRequest,
      action: 'start_dispense',
      decision: 'success',
      reasonCode: 'machine_received_command',
      context,
    });

    return {
      dispenseRequest,
      event,
      changed: true,
    };
  }

  async completeDispense(dispenseRequestId, context = {}) {
    const current = await this.getDispenseRequestOrThrow(dispenseRequestId);
    const entity = toDispenseRequestEntity(current);

    if (entity.state === DISPENSE_REQUEST_STATE.COMPLETED) {
      return {
        dispenseRequest: current,
        event: null,
        changed: false,
      };
    }

    if (!entity.canComplete()) {
      throw new ApiError({
        statusCode: 422,
        code: 'DISPENSE_COMPLETION_NOT_ALLOWED',
        message: 'Dispense request cannot be completed from its current state.',
        source: 'runtime',
      });
    }

    const completedAt = this.clock();
    const dispenseRequest = await this.machineRepository.updateDispenseState(
      current.id,
      DISPENSE_REQUEST_STATE.COMPLETED,
      {
        completedAt,
      },
    );
    const event = await this.publishMachineEvent(
      MACHINE_DOMAIN_EVENTS.DISPENSE_COMPLETED,
      dispenseRequest,
      {
        fromState: current.state,
        toState: DISPENSE_REQUEST_STATE.COMPLETED,
        stateReason: 'machine_dispense_completed',
        context,
      },
    );

    await this.recordAuditForDispense({
      eventType: MACHINE_DOMAIN_EVENTS.DISPENSE_COMPLETED.name,
      dispenseRequest,
      action: 'complete_dispense',
      decision: 'success',
      reasonCode: 'machine_dispense_completed',
      context,
    });

    return {
      dispenseRequest,
      event,
      changed: true,
    };
  }

  async failDispense(dispenseRequestId, reasonCode, context = {}) {
    const current = await this.getDispenseRequestOrThrow(dispenseRequestId);
    const entity = toDispenseRequestEntity(current);
    const failureReason = normalizeOptionalText(reasonCode) || 'machine_dispense_failed';

    if (entity.state === DISPENSE_REQUEST_STATE.FAILED) {
      return {
        dispenseRequest: current,
        event: null,
        changed: false,
      };
    }

    if (!entity.canFail()) {
      throw new ApiError({
        statusCode: 422,
        code: 'DISPENSE_FAILURE_NOT_ALLOWED',
        message: 'Dispense request cannot be failed from its current state.',
        source: 'runtime',
      });
    }

    const failedAt = this.clock();
    const dispenseRequest = await this.machineRepository.updateDispenseState(
      current.id,
      DISPENSE_REQUEST_STATE.FAILED,
      {
        failedAt,
        failureReason,
      },
    );
    const event = await this.publishMachineEvent(
      MACHINE_DOMAIN_EVENTS.DISPENSE_FAILED,
      dispenseRequest,
      {
        fromState: current.state,
        toState: DISPENSE_REQUEST_STATE.FAILED,
        stateReason: failureReason,
        context,
      },
    );

    await this.recordAuditForDispense({
      eventType: MACHINE_DOMAIN_EVENTS.DISPENSE_FAILED.name,
      dispenseRequest,
      action: 'fail_dispense',
      decision: 'success',
      reasonCode: failureReason,
      context,
    });

    return {
      dispenseRequest,
      event,
      changed: true,
    };
  }

  async resolveTargetMachine(machineId) {
    if (machineId) {
      const machine = await this.machineRepository.findById(machineId);

      if (!machine) {
        throw new ApiError({
          statusCode: 404,
          code: 'RESOURCE_NOT_FOUND',
          message: 'Machine was not found.',
          source: 'runtime',
        });
      }

      return machine;
    }

    const machine = await this.machineRepository.findFirstOnlineMachine();

    if (!machine) {
      throw new ApiError({
        statusCode: 422,
        code: 'MACHINE_NOT_AVAILABLE',
        message: 'No online machine is available for dispense.',
        source: 'runtime',
      });
    }

    return machine;
  }

  async getDispenseRequestOrThrow(dispenseRequestId) {
    const dispenseRequest = await this.machineRepository.findDispenseById(
      dispenseRequestId,
    );

    if (!dispenseRequest) {
      throw new ApiError({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Dispense request was not found.',
        source: 'runtime',
      });
    }

    return dispenseRequest;
  }

  async publishMachineEvent(
    contract,
    dispenseRequest,
    { fromState, toState, stateReason, context },
  ) {
    if (!this.domainEventPublisher) {
      return null;
    }

    return this.domainEventPublisher.publish({
      name: contract.name,
      canonicalName: contract.canonicalName,
      version: contract.version,
      category: contract.category,
      aggregateType: 'dispense_request',
      aggregateId: dispenseRequest.id,
      correlationId:
        context.correlationId ||
        dispenseRequest.commandPayload?.correlation_id ||
        dispenseRequest.orderId,
      causationId: context.causationId || dispenseRequest.commandId,
      idempotencyKey:
        context.idempotencyKey ||
        `machine_event:${dispenseRequest.id}:${dispenseRequest.commandId}:${contract.name}`,
      actorContext: {
        actor_type: context.actorType || 'system',
        actor_id: context.actorId || 'machine_runtime',
      },
      payload: {
        dispense_request_id: dispenseRequest.id,
        order_id: dispenseRequest.orderId,
        machine_id: dispenseRequest.machineId,
        command_id: dispenseRequest.commandId,
        command_type: dispenseRequest.commandType,
        from_state: fromState,
        to_state: toState,
        state_reason: stateReason,
        failure_reason: dispenseRequest.failureReason || null,
      },
      metadata: {
        producer: 'Machine Runtime',
        canonical_event_name: contract.canonicalName,
        schema_ref: `event://machines/${contract.name}/v1`,
      },
    });
  }

  async recordAuditForDispense({
    eventType,
    dispenseRequest,
    action,
    decision,
    reasonCode,
    context,
  }) {
    return this.recordAudit({
      eventType,
      targetType: 'DispenseRequest',
      targetId: dispenseRequest.id,
      action,
      decision,
      reasonCode,
      context,
      metadata: {
        order_id: dispenseRequest.orderId,
        machine_id: dispenseRequest.machineId,
        command_id: dispenseRequest.commandId,
        state: dispenseRequest.state,
      },
    });
  }

  async recordAudit({
    eventType,
    targetType,
    targetId,
    action,
    decision,
    reasonCode,
    context,
    metadata,
  }) {
    if (!this.auditRepository) {
      return null;
    }

    return this.auditRepository.record({
      eventType,
      subjectType: context.actorType || 'system',
      subjectId: context.actorId || null,
      targetType,
      targetId,
      action,
      decision,
      reasonCode,
      authMethod: context.authMethod || null,
      sourceChannel: context.sourceChannel || null,
      correlationId: context.correlationId || null,
      metadata,
    });
  }
}

function createDispenseCommand({
  commandId,
  dispenseRequestId,
  machine,
  order,
  context,
  issuedAt,
}) {
  return {
    command_id: commandId,
    command_type: 'DispenseCommand',
    payload_version: 1,
    dispense_request_id: dispenseRequestId,
    machine_operation_id: dispenseRequestId,
    machine_id: machine.id,
    machine_code: machine.machineCode,
    order_id: order.id,
    amount: Number(order.amount ?? order.amountPaidRub ?? 0),
    currency: order.currency || 'RUB',
    idempotency_key:
      context.idempotencyKey || `dispense:${order.id}:${machine.id}:v1`,
    correlation_id: context.correlationId || order.id,
    causation_id: context.causationId || null,
    issued_at: issuedAt.toISOString(),
  };
}

function parseRequiredText(value, field) {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    throw new ApiError({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'Request validation failed.',
      details: [
        {
          field,
          issue: 'must be a non-empty string',
        },
      ],
      source: 'api',
    });
  }

  return normalized;
}

function normalizeOptionalText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

module.exports = {
  MachineService,
  createDispenseCommand,
};
