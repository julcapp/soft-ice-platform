'use strict';

const crypto = require('node:crypto');

class TerminalCheckoutService {
  constructor({
    prisma,
    pricingRepository,
    catalogService,
    organizationContext,
    inventory,
    paymentCheckoutService,
    paymentService,
    buyerTokenService = null,
    clock = () => new Date(),
    returnOrigin = 'https://miniapp.utimoshi.ru',
  } = {}) {
    for (const [name, value] of Object.entries({ prisma, pricingRepository, catalogService, organizationContext, inventory, paymentCheckoutService, paymentService })) {
      if (!value) throw new Error(`${name} is required`);
    }
    Object.assign(this, { prisma, pricingRepository, catalogService, organizationContext, inventory, paymentCheckoutService, paymentService, buyerTokenService, clock });
    this.returnOrigin = String(returnOrigin).replace(/\/$/, '');
  }

  async initiate({ machineId, quoteId, purchaseToken = null, method = 'sbp', idempotencyKey }, context = {}) {
    required({ machineId, quoteId, idempotencyKey }, ['machineId', 'quoteId', 'idempotencyKey']);
    if (String(method).toLowerCase() === 'pos') throw problem('TERMINAL_POS_NOT_CONFIGURED', 'POS-терминал пока не подключён.', 503);
    if (String(method).toLowerCase() !== 'sbp') throw problem('TERMINAL_PAYMENT_METHOD_INVALID', 'На аппарате сейчас доступна оплата через СБП.', 400);

    const existingQuote = await this.pricingRepository.getQuote(quoteId);
    if (!existingQuote) throw problem('TERMINAL_QUOTE_NOT_FOUND', 'Расчёт заказа не найден.', 404);
    this.assertQuote(existingQuote, machineId);

    if (existingQuote.orderId) {
      return this.resume(existingQuote.orderId, machineId, context);
    }

    const buyer = await this.resolveBuyer({ purchaseToken, machineId });
    const organization = await this.organizationContext.resolveByMachine(machineId);
    if (!organization?.organizationId || !organization.locationId) {
      throw problem('TERMINAL_MACHINE_CONTEXT_UNRESOLVED', 'Не удалось определить организацию и точку аппарата.', 409);
    }

    const skus = (existingQuote.items || []).map((item) => item.sku).filter(Boolean);
    const inventoryItems = await this.catalogService.resolveInventoryRecipe(skus);
    const now = this.clock();
    const flowId = `sale_flow_${crypto.randomUUID()}`;
    const correlationId = context.correlationId || `terminal_${crypto.randomUUID()}`;

    const created = await this.prisma.$transaction(async (tx) => {
      const quote = await tx.pricingQuote.findUnique({
        where: { id: quoteId },
        include: { snapshot: { include: { items: true } } },
      });
      if (!quote) throw problem('TERMINAL_QUOTE_NOT_FOUND', 'Расчёт заказа не найден.', 404);
      if (quote.orderId) return { orderId: quote.orderId, replay: true };
      if (quote.machineId !== machineId || String(quote.channel).toUpperCase() !== 'TERMINAL') {
        throw problem('TERMINAL_QUOTE_SCOPE_MISMATCH', 'Расчёт создан для другого канала или аппарата.', 403);
      }
      if (quote.consumedAt || new Date(quote.lockedUntil) <= now) {
        throw problem('TERMINAL_QUOTE_EXPIRED', 'Цена заказа устарела. Соберите заказ заново.', 409);
      }

      await this.assertBuyerInTransaction(tx, buyer, machineId);

      const order = await tx.order.create({
        data: {
          customerId: buyer.customerId,
          status: 'PAYMENT_PENDING',
          amount: Number(quote.finalAmount),
          currency: quote.currency || 'RUB',
          machineId,
          basePriceRub: Number(quote.baseAmount),
          promoDiscountRub: Number(quote.promotionDiscountAmount || 0),
          paymentStatus: Number(quote.finalAmount) > 0 ? 'pending' : 'not_required',
        },
      });

      const reservation = await this.inventory.checkAndReserve({
        saleFlowId: flowId,
        orderId: order.id,
        organizationId: organization.organizationId,
        locationId: organization.locationId,
        machineId,
        items: inventoryItems,
        quantity: 1,
        correlationId,
        idempotencyKey: `terminal-reserve:${quoteId}`,
      }, { transactionClient: tx });
      if (!reservation.available) throw problem('TERMINAL_INVENTORY_UNAVAILABLE', 'Недостаточно ингредиентов для заказа.', 409);

      await tx.saleFlow.create({
        data: {
          flowId,
          orderId: order.id,
          customerId: buyer.customerId,
          machineId,
          organizationId: organization.organizationId,
          locationId: organization.locationId,
          correlationId,
          currentState: 'AWAITING_PAYMENT',
          inventoryReservationReference: reservation.reservationId,
          startedAt: now,
          updatedAt: now,
          recoveryStatus: 'SAFE_TO_RESUME',
          metadata: {
            channel: 'TERMINAL',
            quoteId,
            buyerKind: buyer.kind,
            ...(buyer.contactId ? { unverifiedContactId: buyer.contactId } : {}),
          },
        },
      });

      await this.pricingRepository.consumeQuote(quoteId, now, order.id, { transactionClient: tx });

      if (buyer.contactId) {
        const linked = await tx.unverifiedPurchaseContact.updateMany({
          where: { id: buyer.contactId, machineId, orderId: null, status: 'ACTIVE' },
          data: { orderId: order.id, lastSeenAt: now },
        });
        if (linked.count !== 1) throw problem('TERMINAL_CONTACT_LINK_CONFLICT', 'Покупатель уже связан с другим заказом.', 409);
      }

      await tx.transactionalOutboxEvent.create({
        data: {
          eventId: `event_${crypto.randomUUID()}`,
          eventType: 'SALE_CREATED',
          eventVersion: 1,
          aggregateType: 'SALE_FLOW',
          aggregateId: flowId,
          organizationId: organization.organizationId,
          machineId,
          saleFlowId: flowId,
          payload: {
            orderId: order.id,
            customerId: buyer.customerId,
            machineId,
            quoteId,
            buyerKind: buyer.kind,
          },
          status: 'PENDING',
          occurredAt: now,
          correlationId,
          idempotencyKey: `terminal-checkout:${quoteId}:SALE_CREATED`,
        },
      });

      return { orderId: order.id, replay: false };
    });

    if (created.replay) return this.resume(created.orderId, machineId, context);
    return this.startPayment(created.orderId, machineId, method, idempotencyKey, context);
  }

  async status({ paymentId, machineId }, context = {}) {
    required({ paymentId, machineId }, ['paymentId', 'machineId']);
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { saleFlow: true } });
    if (!payment || payment.channel !== 'TERMINAL' || payment.saleFlow?.machineId !== machineId) {
      throw problem('TERMINAL_PAYMENT_NOT_FOUND', 'Платёж не найден.', 404);
    }
    const result = payment.provider === 'INTERNAL'
      ? { payment, status: payment.status, userState: payment.status === 'SUCCEEDED' ? 'SUCCESS' : 'PENDING', confirmationUrl: null }
      : await this.paymentCheckoutService.refreshPayment({
        organizationId: payment.organizationId,
        paymentId: payment.id,
      }, {
        actorType: 'TERMINAL',
        actorId: machineId,
        correlationId: context.correlationId,
      });
    return this.present(result, machineId);
  }

  async startPayment(orderId, machineId, method, idempotencyKey, context) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    const flow = await this.prisma.saleFlow.findUnique({ where: { orderId } });
    if (!order || !flow || flow.machineId !== machineId) throw problem('TERMINAL_ORDER_NOT_FOUND', 'Заказ не найден.', 404);

    if (Number(order.amount) === 0) {
      const local = await this.paymentService.createPayment({
        organizationId: flow.organizationId,
        orderId,
        saleFlowId: flow.flowId,
        provider: 'INTERNAL',
        idempotencyKey: `terminal-zero:${orderId}`,
        channel: 'TERMINAL',
        description: `Подарок по заказу ${orderId}`,
      }, { actorType: 'TERMINAL', actorId: machineId, correlationId: context.correlationId });
      let payment = local.payment;
      if (payment.status === 'CREATED') {
        payment = (await this.paymentService.markPending(payment.organizationId, payment.id, {
          idempotencyKey: `terminal-zero:${orderId}:pending`,
          providerPaymentId: `internal_zero_${payment.id}`,
          providerStatus: 'pending',
        }, { actorType: 'SYSTEM', actorId: 'terminal-zero-payment', correlationId: context.correlationId })).payment;
      }
      if (payment.status === 'PENDING') {
        payment = (await this.paymentService.confirmPayment({
          organizationId: payment.organizationId,
          paymentId: payment.id,
          idempotencyKey: `terminal-zero:${orderId}:succeeded`,
          providerPaymentId: payment.providerPaymentId || `internal_zero_${payment.id}`,
          providerStatus: 'succeeded',
          amount: '0.00',
          currency: payment.currency,
        }, { actorType: 'SYSTEM', actorId: 'terminal-zero-payment', correlationId: context.correlationId })).payment;
      }
      return this.present({ payment, status: payment.status, userState: 'SUCCESS', confirmationUrl: null }, machineId);
    }

    const result = await this.paymentCheckoutService.initiate({
      organizationId: flow.organizationId,
      orderId,
      saleFlowId: flow.flowId,
      provider: 'YOOKASSA',
      idempotencyKey: `terminal-checkout:${orderId}:${idempotencyKey}`,
      method,
      returnUrl: `${this.returnOrigin}/?mode=payment-return&source=terminal&orderId=${encodeURIComponent(orderId)}`,
      channel: 'TERMINAL',
      description: `Мороженое У Тимоши, заказ ${orderId}`,
    }, {
      actorType: 'TERMINAL',
      actorId: machineId,
      correlationId: context.correlationId,
    });
    return this.present(result, machineId);
  }

  async resume(orderId, machineId, context) {
    const payment = await this.prisma.payment.findFirst({ where: { orderId }, include: { saleFlow: true } });
    if (!payment) return this.startPayment(orderId, machineId, 'sbp', 'resume', context);
    if (payment.saleFlow?.machineId !== machineId) throw problem('TERMINAL_ORDER_SCOPE_MISMATCH', 'Заказ относится к другому аппарату.', 403);
    if (payment.provider === 'INTERNAL') return this.present({ payment, status: payment.status, userState: payment.status === 'SUCCEEDED' ? 'SUCCESS' : 'PENDING' }, machineId);
    if (payment.status === 'CREATED' && !payment.providerPaymentId) {
      const result = await this.paymentCheckoutService.initiate({
        organizationId: payment.organizationId,
        orderId: payment.orderId,
        saleFlowId: payment.saleFlowId,
        provider: payment.provider,
        idempotencyKey: payment.idempotencyKey,
        method: 'sbp',
        returnUrl: `${this.returnOrigin}/?mode=payment-return&source=terminal&orderId=${encodeURIComponent(orderId)}`,
        channel: 'TERMINAL',
        description: payment.description || `Мороженое У Тимоши, заказ ${orderId}`,
      }, { actorType: 'TERMINAL', actorId: machineId, correlationId: context.correlationId });
      return this.present(result, machineId);
    }
    const result = await this.paymentCheckoutService.refreshPayment({
      organizationId: payment.organizationId,
      paymentId: payment.id,
    }, { actorType: 'TERMINAL', actorId: machineId, correlationId: context.correlationId });
    return this.present(result, machineId);
  }

  async resolveBuyer({ purchaseToken, machineId }) {
    if (!purchaseToken || !this.buyerTokenService) return { kind: 'ANONYMOUS', customerId: null, contactId: null };
    const parsed = this.buyerTokenService.verify(purchaseToken, { machineId });
    return {
      kind: parsed.kind,
      customerId: parsed.kind === 'CUSTOMER' ? parsed.id : null,
      contactId: parsed.kind === 'UNVERIFIED' ? parsed.id : null,
    };
  }

  async assertBuyerInTransaction(tx, buyer, machineId) {
    if (buyer.customerId) {
      const customer = await tx.customer.findUnique({ where: { id: buyer.customerId }, select: { id: true } });
      if (!customer) throw problem('TERMINAL_CUSTOMER_NOT_FOUND', 'Покупатель не найден.', 404);
    }
    if (buyer.contactId) {
      const contact = await tx.unverifiedPurchaseContact.findFirst({
        where: { id: buyer.contactId, machineId, status: 'ACTIVE', phoneStatus: 'UNVERIFIED' },
        select: { id: true, orderId: true },
      });
      if (!contact || contact.orderId) throw problem('TERMINAL_CONTACT_INVALID', 'Сессия покупателя недействительна.', 409);
    }
  }

  assertQuote(quote, machineId) {
    if (quote.machineId !== machineId || String(quote.channel).toUpperCase() !== 'TERMINAL') {
      throw problem('TERMINAL_QUOTE_SCOPE_MISMATCH', 'Расчёт создан для другого канала или аппарата.', 403);
    }
    if (!quote.orderId && (quote.consumedAt || new Date(quote.lockedUntil) <= this.clock())) {
      throw problem('TERMINAL_QUOTE_EXPIRED', 'Цена заказа устарела. Соберите заказ заново.', 409);
    }
  }

  async present(result, machineId) {
    const payment = result.payment;
    const flow = await this.prisma.saleFlow.findUnique({ where: { orderId: payment.orderId } });
    let fulfillmentState = 'WAITING';
    if (flow?.machineId === machineId) {
      if (flow.currentState === 'COMPLETED') fulfillmentState = 'COMPLETED';
      else if (flow.currentState === 'REFUND_REQUIRED' || flow.currentState === 'FULFILLMENT_FAILED') fulfillmentState = 'ATTENTION_REQUIRED';
      else {
        // DISPENSING alone records command intent, not a physical acknowledgement.
        const attempt = flow.currentState === 'DISPENSING' && flow.flowId && flow.organizationId
          && payment.status === 'SUCCEEDED' && this.prisma.machineDispenseAttempt
          ? await this.prisma.machineDispenseAttempt.findFirst({ where: {
            organizationId: flow.organizationId, orderId: payment.orderId,
            saleFlowId: flow.flowId, machineId, operationType: 'CUSTOMER_SALE',
          }, select: { status: true, acceptedAt: true, startedAt: true } }) : null;
        if (attempt && ['ACCEPTED', 'DISPENSING'].includes(attempt.status) && (attempt.acceptedAt || attempt.startedAt)) fulfillmentState = 'PREPARING';
        else if (flow.recoveryStatus === 'NEEDS_RECONCILIATION') fulfillmentState = 'ATTENTION_REQUIRED';
      }
    }
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      machineId,
      status: result.status || payment.status,
      userState: result.userState || userState(payment.status),
      amount: String(payment.amount),
      currency: payment.currency,
      confirmationUrl: result.confirmationUrl || payment.confirmationUrl || null,
      failureCode: payment.failureCode || null,
      succeededAt: payment.succeededAt || null,
      fulfillmentState,
    };
  }
}

function userState(status) {
  if (status === 'SUCCEEDED') return 'SUCCESS';
  if (['FAILED', 'CANCELED'].includes(status)) return 'ERROR';
  return 'PENDING';
}
function required(value, keys) { for (const key of keys) if (value[key] === undefined || value[key] === null || value[key] === '') throw problem('TERMINAL_CHECKOUT_VALIDATION_FAILED', `${key} обязателен.`, 400); }
function problem(code, message, statusCode = 409) { return Object.assign(new Error(message), { code, statusCode, source: 'terminal_checkout' }); }

module.exports = { TerminalCheckoutService };
