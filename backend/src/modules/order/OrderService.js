const { ApiError } = require('../../platform/errors/ApiError');
const { ORDER_DOMAIN_EVENTS } = require('../../platform/events/domainEventContract');
const { ORDER_STATUS, toOrderEntity } = require('./OrderEntity');

const SUPPORTED_CURRENCY = 'RUB';

class OrderService {
  constructor({
    orderRepository,
    auditRepository,
    domainEventPublisher,
    clubAccountService,
    clock = () => new Date(),
  }) {
    this.orderRepository = orderRepository;
    this.auditRepository = auditRepository;
    this.domainEventPublisher = domainEventPublisher;
    this.clubAccountService = clubAccountService;
    this.clock = clock;
  }

  async createOrder(customerId, request, context = {}) {
    const amount = parsePositiveAmount(request.amount);
    const currency = normalizeCurrency(request.currency);

    const order = await this.orderRepository.create({
      customerId,
      status: ORDER_STATUS.PAYMENT_PENDING,
      amount,
      currency,
    });

    const event = await this.publishOrderEvent(
      ORDER_DOMAIN_EVENTS.ORDER_CREATED,
      order,
      {
        fromStatus: null,
        toStatus: order.status,
        stateReason: 'customer_order_created',
        context,
      },
    );

    await this.recordAudit({
      eventType: ORDER_DOMAIN_EVENTS.ORDER_CREATED.name,
      customerId,
      order,
      action: 'create',
      decision: 'success',
      reasonCode: 'customer_order_created',
      context,
    });

    return {
      order,
      event,
      created: true,
    };
  }

  async getOwnOrder(customerId, orderId) {
    const order = await this.orderRepository.findByIdForCustomer(orderId, customerId);

    if (!order) {
      throw new ApiError({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Order was not found.',
        source: 'runtime',
      });
    }

    return order;
  }

  async listOwnOrders(customerId, options) {
    return this.orderRepository.findByCustomerId(customerId, options);
  }

  async confirmPayment(orderId, context = {}) {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new ApiError({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Order was not found.',
        source: 'runtime',
      });
    }

    if (context.customerId && order.customerId !== context.customerId) {
      throw new ApiError({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Order was not found.',
        source: 'runtime',
      });
    }

    if (order.status === ORDER_STATUS.PAID) {
      return {
        order,
        event: null,
        clubAccountIntegration: await this.prepareClubAccountIntegration(order, context),
        changed: false,
      };
    }

    const entity = toOrderEntity(order);

    if (!entity.canConfirmPayment()) {
      throw new ApiError({
        statusCode: 422,
        code: 'ORDER_PAYMENT_CONFIRMATION_NOT_ALLOWED',
        message: 'Order cannot be marked as paid from its current status.',
        source: 'runtime',
      });
    }

    const paidAt = this.clock();
    const paidOrder = await this.orderRepository.updateStatus(order.id, ORDER_STATUS.PAID, {
      paidAt,
    });
    const clubAccountIntegration = await this.prepareClubAccountIntegration(
      paidOrder,
      context,
    );
    const event = await this.publishOrderEvent(ORDER_DOMAIN_EVENTS.ORDER_PAID, paidOrder, {
      fromStatus: order.status,
      toStatus: paidOrder.status,
      stateReason: 'payment_confirmed',
      context,
    });

    await this.recordAudit({
      eventType: ORDER_DOMAIN_EVENTS.ORDER_PAID.name,
      customerId: paidOrder.customerId,
      order: paidOrder,
      action: 'confirm_payment',
      decision: 'success',
      reasonCode: 'payment_confirmed',
      context,
    });

    return {
      order: paidOrder,
      event,
      clubAccountIntegration,
      changed: true,
    };
  }

  async cancelOrder(orderId, context = {}) {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new ApiError({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Order was not found.',
        source: 'runtime',
      });
    }

    if (context.customerId && order.customerId !== context.customerId) {
      throw new ApiError({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Order was not found.',
        source: 'runtime',
      });
    }

    if (order.status === ORDER_STATUS.CANCELLED) {
      return {
        order,
        event: null,
        changed: false,
      };
    }

    if (![ORDER_STATUS.CREATED, ORDER_STATUS.PAYMENT_PENDING].includes(order.status)) {
      throw new ApiError({
        statusCode: 422,
        code: 'ORDER_CANCELLATION_NOT_ALLOWED',
        message: 'Order cannot be cancelled from its current status.',
        source: 'runtime',
      });
    }

    const cancelledOrder = await this.orderRepository.updateStatus(
      order.id,
      ORDER_STATUS.CANCELLED,
    );
    const event = await this.publishOrderEvent(
      ORDER_DOMAIN_EVENTS.ORDER_CANCELLED,
      cancelledOrder,
      {
        fromStatus: order.status,
        toStatus: cancelledOrder.status,
        stateReason: context.reasonCode || 'customer_cancelled',
        context,
      },
    );

    await this.recordAudit({
      eventType: ORDER_DOMAIN_EVENTS.ORDER_CANCELLED.name,
      customerId: cancelledOrder.customerId,
      order: cancelledOrder,
      action: 'cancel',
      decision: 'success',
      reasonCode: context.reasonCode || 'customer_cancelled',
      context,
    });

    return {
      order: cancelledOrder,
      event,
      changed: true,
    };
  }

  async prepareClubAccountIntegration(order, context) {
    if (
      this.clubAccountService &&
      typeof this.clubAccountService.prepareOrderPaidIntegration === 'function'
    ) {
      return this.clubAccountService.prepareOrderPaidIntegration(order, context);
    }

    return {
      service: 'ClubAccountService',
      status: 'prepared',
      applied: false,
      order_id: order.id,
      customer_id: order.customerId,
      amount: Number(order.amount ?? order.amountPaidRub ?? 0),
      currency: order.currency || SUPPORTED_CURRENCY,
      future_capabilities: ['bonus_accrual', 'deposit_usage', 'loyalty_rules'],
    };
  }

  async publishOrderEvent(contract, order, { fromStatus, toStatus, stateReason, context }) {
    if (!this.domainEventPublisher) {
      return null;
    }

    return this.domainEventPublisher.publish({
      name: contract.name,
      canonicalName: contract.canonicalName,
      version: contract.version,
      category: contract.category,
      aggregateType: 'order',
      aggregateId: order.id,
      correlationId: context.correlationId || null,
      causationId: context.causationId || null,
      idempotencyKey:
        context.idempotencyKey ||
        `orders.event:${order.id}:${toStatus}:${contract.name}`,
      actorContext: {
        actor_type: context.actorType || 'customer',
        actor_id: context.actorId || order.customerId,
      },
      payload: {
        order_id: order.id,
        customer_id: order.customerId,
        from_status: fromStatus,
        to_status: toStatus,
        state_reason: stateReason,
        amount: Number(order.amount ?? order.amountPaidRub ?? 0),
        currency: order.currency || SUPPORTED_CURRENCY,
      },
      metadata: {
        producer: 'Order Runtime',
        canonical_event_name: contract.canonicalName,
        schema_ref: `event://orders/${contract.name}/v1`,
      },
    });
  }

  async recordAudit({
    eventType,
    customerId,
    order,
    action,
    decision,
    reasonCode,
    context,
  }) {
    if (!this.auditRepository) {
      return null;
    }

    return this.auditRepository.record({
      eventType,
      subjectType: 'user',
      subjectId: customerId,
      targetType: 'Order',
      targetId: order.id,
      action,
      decision,
      reasonCode,
      authMethod: context.authMethod || null,
      sourceChannel: context.sourceChannel || null,
      correlationId: context.correlationId || null,
      metadata: {
        order_status: order.status,
        amount: Number(order.amount ?? order.amountPaidRub ?? 0),
        currency: order.currency || SUPPORTED_CURRENCY,
      },
    });
  }
}

function normalizeCurrency(currency) {
  const normalized = currency || SUPPORTED_CURRENCY;

  if (normalized !== SUPPORTED_CURRENCY) {
    throw new ApiError({
      statusCode: 422,
      code: 'UNSUPPORTED_CURRENCY',
      message: 'Orders support only RUB in the MVP.',
      source: 'runtime',
    });
  }

  return normalized;
}

function parsePositiveAmount(amount) {
  const parsed = Number(amount);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ApiError({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'Request validation failed.',
      details: [
        {
          field: 'amount',
          issue: 'must be a number greater than zero',
        },
      ],
      source: 'api',
    });
  }

  return parsed;
}

module.exports = {
  OrderService,
  SUPPORTED_CURRENCY,
  normalizeCurrency,
  parsePositiveAmount,
};
