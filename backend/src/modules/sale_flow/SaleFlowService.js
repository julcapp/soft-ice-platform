const crypto = require('crypto');
const { FLOW_STATE, transition } = require('./SaleFlowModels');

class SaleFlowService {
  constructor({ repository, orderDomain, paymentAdapter, machineAdapter, machineAvailability, organizationContext, inventory, eventPublisher, customer360, crm, loyalty, clock = () => new Date(), tokenTtlMs = 300000 }) {
    Object.assign(this, { repository, orderDomain, paymentAdapter, machineAdapter, machineAvailability, organizationContext, inventory, eventPublisher, customer360, crm, loyalty, clock, tokenTtlMs });
  }

  async create(request, context = {}) {
    if (!context.idempotencyKey) throw invalid('Для создания заказа требуется idempotency key.');
    const existing = this.repository.findCreated(context.idempotencyKey);
    if (existing) return existing;
    for (const field of ['customerId', 'machineId']) if (!request[field]) throw invalid(`${field} обязателен.`);
    if (!request.product?.baseProductId || !request.product?.toppingId || !request.product?.additionId) throw invalid('Состав должен включать базовый продукт, топпинг и добавку.');

    const org = await this.organizationContext?.resolveByMachine(request.machineId);
    if (!org?.organizationId || !(org.locationId || org.pointId)) throw conflict('MACHINE_CONTEXT_UNRESOLVED', 'Не удалось определить организацию и точку по аппарату.');
    if (context.organizationId && context.organizationId !== org.organizationId) throw conflict('TENANT_SCOPE_MISMATCH', 'Аппарат не принадлежит организации из доверенного контекста.');
    if (this.machineAvailability && !(await this.machineAvailability.isAvailable(request.machineId))) throw conflict('MACHINE_UNAVAILABLE', 'Аппарат недоступен для выдачи.');

    const quantity = request.quantity || 1;
    const reservation = await this.inventory.checkAndReserve({ machineId: request.machineId, product: request.product, quantity, idempotencyKey: `reserve:${context.idempotencyKey}` });
    if (!reservation.available) throw conflict('INGREDIENTS_INSUFFICIENT', 'Недостаточно ингредиентов для заказа.');
    const price = await this.inventory.calculatePrice({ product: request.product, quantity });
    const created = await this.orderDomain.create({ customerId: request.customerId, machineId: request.machineId, organizationId: org.organizationId, locationId: org.locationId || org.pointId, product: request.product, quantity, totalAmount: price.totalAmount, currency: price.currency || 'RUB', channel: request.channel || null }, context);
    const now = this.clock();
    const flow = {
      flowId: `sale_flow_${crypto.randomUUID()}`, orderId: created.orderId,
      customerId: request.customerId, machineId: request.machineId, organizationId: org.organizationId,
      locationId: org.locationId || org.pointId, reservationId: reservation.reservationId,
      correlationId: context.correlationId || `sale_${crypto.randomUUID()}`,
      flowState: FLOW_STATE.STARTED, createdAt: now, updatedAt: now, timestamps: { STARTED: now }, lastEventId: null,
    };
    transition(flow, FLOW_STATE.WAITING_FOR_PAYMENT, now);
    this.repository.saveFlow(flow); this.repository.rememberCreate(context.idempotencyKey, flow);
    await this.emit('SALE_FLOW_STARTED', flow, {});
    return flow;
  }

  async pay(orderId, request = {}, context = {}) {
    const flow = this.required(orderId); const key = context.idempotencyKey || request.callbackId;
    if (!key) throw invalid('Для callback оплаты требуется idempotency key.');
    const remembered = this.repository.findPayment(key); if (remembered) return { ...remembered, duplicate: true };
    if (flow.flowState !== FLOW_STATE.WAITING_FOR_PAYMENT) throw conflict('PAYMENT_NOT_ALLOWED', 'Процесс не ожидает оплату.');
    const paymentDetails = await this.orderDomain.getPaymentDetails(orderId);
    const payment = await this.paymentAdapter.pay({ orderId, ...paymentDetails, ...request });
    if (payment.paymentId) {
      const fact = this.repository.rememberProviderTransaction(payment.provider, payment.paymentId, orderId);
      if (fact.duplicate && fact.orderId !== orderId) throw conflict('PAYMENT_TRANSACTION_CONFLICT', 'Платёжная транзакция уже связана с другим заказом.');
    }
    if (payment.status === 'PAID') {
      await this.orderDomain.confirmPayment(orderId, { ...context, paymentId: payment.paymentId });
      flow.paymentId = payment.paymentId; transition(flow, FLOW_STATE.PAYMENT_CONFIRMED, this.clock());
      await this.emit('PAYMENT_CONFIRMED', flow, { paymentId: payment.paymentId });
    } else {
      await this.orderDomain.rejectPayment(orderId, { ...context, paymentStatus: payment.status });
      await this.once(`release:${orderId}`, () => this.inventory.release(flow.reservationId, { idempotencyKey: `release:${orderId}` }));
      transition(flow, FLOW_STATE.STOPPED, this.clock()); await this.emit('PAYMENT_FAILED', flow, { paymentStatus: payment.status });
    }
    const result = { flow, payment, duplicate: false }; this.repository.rememberPayment(key, result); return result;
  }

  async authorize(orderId) {
    const flow = this.required(orderId);
    if (flow.flowState !== FLOW_STATE.PAYMENT_CONFIRMED) throw conflict('FULFILLMENT_NOT_PAID', 'Разрешение возможно только после подтверждения оплаты.');
    const now = this.clock(); const token = { tokenId: `fulfillment_${crypto.randomUUID()}`, orderId, machineId: flow.machineId, issuedAt: now, expiresAt: new Date(now.getTime() + this.tokenTtlMs), usedAt: null };
    this.repository.saveToken(token); transition(flow, FLOW_STATE.FULFILLMENT_AUTHORIZED, now);
    await this.emit('FULFILLMENT_AUTHORIZED', flow, { tokenId: token.tokenId, expiresAt: token.expiresAt }); return token;
  }

  async dispense(tokenId, request = {}) {
    const token = this.repository.findToken(tokenId);
    if (!token || token.usedAt || token.expiresAt <= this.clock()) throw conflict('FULFILLMENT_TOKEN_INVALID', 'Разрешение недействительно или уже использовано.');
    if (request.machineId && request.machineId !== token.machineId) throw conflict('FULFILLMENT_MACHINE_MISMATCH', 'Разрешение выдано другому аппарату.');
    const flow = this.required(token.orderId); token.usedAt = this.clock(); transition(flow, FLOW_STATE.DISPENSING, token.usedAt);
    await this.emit('DISPENSE_STARTED', flow, { tokenId });
    const fulfillmentDetails = await this.orderDomain.getFulfillmentDetails(flow.orderId);
    const result = await this.machineAdapter.dispense({ orderId: flow.orderId, machineId: flow.machineId, ...fulfillmentDetails, ...request });
    return this.handleMachineResult(flow.orderId, result, { idempotencyKey: result.commandId });
  }

  async handleMachineResult(orderId, result, context = {}) {
    const flow = this.required(orderId); const key = `machine:${context.idempotencyKey || result.eventId || `${orderId}:${result.status}`}`;
    if (this.repository.effects.has(key)) return flow;
    if (['ACCEPTED', 'DISPENSING'].includes(result.status)) { this.repository.effects.set(key, true); return flow; }
    if (flow.flowState !== FLOW_STATE.DISPENSING) throw conflict('MACHINE_RESULT_NOT_ALLOWED', 'Результат аппарата не соответствует состоянию процесса.');
    if (result.status !== 'DISPENSED') {
      await this.orderDomain.requireRefund(orderId, { paymentId: flow.paymentId, reason: result.status });
      transition(flow, FLOW_STATE.REFUND_REQUIRED, this.clock());
      await this.once(`release:${orderId}`, () => this.inventory.release(flow.reservationId, { idempotencyKey: `release:${orderId}` }));
      await this.emit('DISPENSE_FAILED', flow, { machineStatus: result.status }); await this.emit('REFUND_REQUIRED', flow, { paymentId: flow.paymentId });
      this.repository.effects.set(key, true); return flow;
    }
    await this.complete(flow, result); this.repository.effects.set(key, true); return flow;
  }

  async complete(flow, result) {
    await this.emit('DISPENSE_SUCCEEDED', flow, { commandId: result.commandId });
    await this.once(`inventory:${flow.orderId}`, () => this.inventory.consume(flow.reservationId, { idempotencyKey: `consume:${flow.orderId}` }));
    await this.emit('INVENTORY_CONSUMED', flow, {});
    await this.once(`order:${flow.orderId}`, () => this.orderDomain.complete(flow.orderId, { commandId: result.commandId }));
    transition(flow, FLOW_STATE.COMPLETED, this.clock());
    await this.once(`customer360:${flow.orderId}`, () => this.customer360?.recordPurchase?.({ orderId: flow.orderId }));
    await this.once(`crm:${flow.orderId}`, () => this.crm?.recordSale?.({ orderId: flow.orderId }));
    await this.emit('SALE_COMPLETED', flow, {});
    await this.once(`loyalty:${flow.orderId}`, () => this.loyalty?.registerPurchase?.({ orderId: flow.orderId }));
    await this.emit('LOYALTY_UPDATED', flow, {});
  }

  async once(key, effect) { if (this.repository.effects.has(key)) return this.repository.effects.get(key); const pending = Promise.resolve().then(effect); this.repository.effects.set(key, pending); try { const value = await pending; this.repository.effects.set(key, value ?? true); return value; } catch (error) { this.repository.effects.delete(key); throw error; } }
  required(id) { const flow = this.repository.findFlow(id); if (!flow) throw Object.assign(new Error('Процесс продажи не найден.'), { code: 'SALE_FLOW_NOT_FOUND', statusCode: 404 }); return flow; }
  async emit(eventType, flow, payload) { const event = { eventId: `event_${crypto.randomUUID()}`, eventType, eventVersion: 1, occurredAt: this.clock(), aggregateType: 'SALE_FLOW', aggregateId: flow.flowId, actorType: 'SYSTEM', actorId: 'sale-flow-v1', sourceChannel: 'SALE_FLOW', correlationId: flow.correlationId, causationId: flow.lastEventId || null, payload: { orderId: flow.orderId, customerId: flow.customerId, machineId: flow.machineId, organizationId: flow.organizationId, locationId: flow.locationId, ...payload }, metadata: { mode: 'FOUNDATION_ONLY' } }; const published = await this.eventPublisher?.publish(event); flow.lastEventId = event.eventId; return published || event; }
}

function invalid(message) { return Object.assign(new Error(message), { code: 'VALIDATION_FAILED', statusCode: 400 }); }
function conflict(code, message) { return Object.assign(new Error(message), { code, statusCode: 409 }); }
module.exports = { SaleFlowService };
