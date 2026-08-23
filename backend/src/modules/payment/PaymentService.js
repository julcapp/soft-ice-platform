const crypto = require('node:crypto');
const { assertPaymentTransition, money, sameMoney, error } = require('./PaymentModels');

class PaymentService {
  constructor({ repository, providers = {}, inventory = null, clock = () => new Date() }) { Object.assign(this, { repository, providers, inventory, clock }); }

  async createPayment(request, context = {}) {
    required(request, ['organizationId', 'orderId', 'provider', 'idempotencyKey']);
    const create = async () => this.repository.transaction(async (repo, tx) => {
      const order = await tx.order.findUnique({ where: { id: request.orderId } });
      if (!order) throw error('PAYMENT_ORDER_NOT_FOUND', 'Заказ не найден.', 404);
      const flow = await tx.saleFlow.findFirst({ where: { orderId: request.orderId, organizationId: request.organizationId, ...(request.saleFlowId && { flowId: request.saleFlowId }) } });
      if (!flow) throw error('PAYMENT_TENANT_SCOPE_MISMATCH', 'Заказ не принадлежит указанной организации/Sale Flow.', 403);
      const amount = money(order.amount);
      if (request.amount !== undefined && !sameMoney(request.amount, amount)) throw error('PAYMENT_CLIENT_AMOUNT_REJECTED', 'Сумма клиента не совпадает с authoritative Order amount.', 409);
      const identity = canonicalCreateIdentity({ orderId: order.id, saleFlowId: flow.flowId, provider: request.provider, amount, currency: order.currency, description: request.description, metadata: request.metadata });
      const requestFingerprint = hash(identity);
      const byKey = await repo.getByIdempotencyKey(request.organizationId, request.idempotencyKey);
      if (byKey) return replayCreate(byKey, requestFingerprint);
      const byOrder = await repo.getByOrderId(request.organizationId, request.orderId);
      if (byOrder) {
        if (byOrder.idempotencyKey === request.idempotencyKey) return replayCreate(byOrder, requestFingerprint);
        throw error('PAYMENT_ORDER_ALREADY_HAS_PAYMENT', 'Для заказа уже существует Payment.', 409);
      }
      const payment = await repo.create({ organizationId: request.organizationId, orderId: order.id, saleFlowId: flow.flowId, customerId: order.customerId, provider: request.provider, idempotencyKey: request.idempotencyKey, requestFingerprint, status: 'CREATED', amount, currency: order.currency, description: identity.description, metadata: identity.metadata });
      await repo.createOperation({ organizationId: payment.organizationId, paymentId: payment.id, operationType: 'CREATE', idempotencyKey: request.idempotencyKey, requestHash: requestFingerprint, completedAt: this.clock(), resultReference: payment.id });
      await this.auditAndEvent(repo, payment, 'PAYMENT_CREATED', 'PaymentCreated', context);
      return { payment, duplicate: false };
    });
    try { return await create(); } catch (failure) {
      if (failure.code !== 'P2002') throw failure;
      const winner = await this.repository.getByIdempotencyKey(request.organizationId, request.idempotencyKey)
        || await this.repository.getByOrderId(request.organizationId, request.orderId);
      if (!winner) throw failure;
      const order = await this.repository.prisma.order.findUnique({ where: { id: request.orderId } });
      const flow = order && await this.repository.prisma.saleFlow.findFirst({ where: { orderId: request.orderId, organizationId: request.organizationId, ...(request.saleFlowId && { flowId: request.saleFlowId }) } });
      if (!order || !flow) throw failure;
      const fingerprint = hash(canonicalCreateIdentity({ orderId: order.id, saleFlowId: flow.flowId, provider: request.provider, amount: money(order.amount), currency: order.currency, description: request.description, metadata: request.metadata }));
      if (winner.idempotencyKey === request.idempotencyKey) return replayCreate(winner, fingerprint);
      throw error('PAYMENT_ORDER_ALREADY_HAS_PAYMENT', 'Для заказа уже существует Payment.', 409);
    }
  }

  markPending(organizationId, paymentId, request, context = {}) { return this.transition({ organizationId, paymentId, ...request, to: 'PENDING', eventType: 'PaymentPending' }, context); }
  confirmPayment(request, context = {}) { return this.transition({ ...request, to: 'SUCCEEDED', eventType: 'PaymentSucceeded' }, context); }
  failPayment(request, context = {}) { return this.transition({ ...request, to: 'FAILED', eventType: 'PaymentFailed' }, context); }
  cancelPayment(request, context = {}) { return this.transition({ ...request, to: 'CANCELED', eventType: 'PaymentCanceled' }, context); }

  async transition(request, context = {}) {
    required(request, ['organizationId', 'paymentId', 'to', 'idempotencyKey']);
    const operationType = `TRANSITION_${request.to}`;
    const replay = await this.repository.findOperation(request.organizationId, operationType, request.idempotencyKey);
    if (replay) {
      if (replay.paymentId !== request.paymentId || replay.requestHash !== hash(request)) throw error('PAYMENT_IDEMPOTENCY_CONFLICT', 'Idempotency key уже использован для другой команды.', 409);
      return { payment: await this.repository.getById(request.organizationId, request.paymentId), duplicate: true };
    }
    try { return await this.repository.transaction(async (repo, tx) => {
      const payment = await tx.payment.findFirst({ where: { id: request.paymentId, organizationId: request.organizationId } });
      if (!payment) throw error('PAYMENT_NOT_FOUND', 'Платёж не найден.', 404);
      assertPaymentTransition(payment.status, request.to);
      const order = await tx.order.findUnique({ where: { id: payment.orderId } });
      if (!order) throw error('PAYMENT_ORDER_NOT_FOUND', 'Заказ не найден.', 404);
      if (request.to === 'SUCCEEDED' && (!sameMoney(payment.amount, order.amount) || request.amount !== undefined && !sameMoney(request.amount, payment.amount) || request.currency && request.currency !== payment.currency)) {
        throw error('PAYMENT_AMOUNT_MISMATCH', 'Сумма Payment/provider не совпадает с authoritative Order amount.', 409);
      }
      const now = this.clock();
      const stamp = { PENDING: 'pendingAt', AUTHORIZED: 'authorizedAt', SUCCEEDED: 'succeededAt', FAILED: 'failedAt', CANCELED: 'canceledAt', REFUNDED: 'refundedAt' }[request.to];
      const changed = await tx.payment.updateMany({ where: { id: payment.id, organizationId: payment.organizationId, status: payment.status }, data: { status: request.to, providerPaymentId: request.providerPaymentId || payment.providerPaymentId, providerStatus: request.providerStatus || request.to, ...(stamp && { [stamp]: now }) } });
      if (changed.count !== 1) throw error('PAYMENT_CONCURRENT_TRANSITION', 'Payment изменён конкурентно.', 409);
      if (request.to === 'SUCCEEDED') await this.applySuccess(tx, payment, now);
      if (['FAILED', 'CANCELED'].includes(request.to)) await this.applyFailure(tx, payment, request.to, now);
      const operation = await repo.createOperation({ organizationId: payment.organizationId, paymentId: payment.id, operationType, idempotencyKey: request.idempotencyKey, requestHash: hash(request), completedAt: now, resultReference: payment.id });
      const updated = await tx.payment.findUnique({ where: { id: payment.id } });
      await this.auditAndEvent(repo, updated, `PAYMENT_${request.to}`, request.eventType || `Payment${title(request.to)}`, context, operation.id);
      return { payment: updated, duplicate: false };
    }); } catch (failure) {
      if (failure.code === 'PAYMENT_AMOUNT_MISMATCH') {
        const payment = await this.repository.getById(request.organizationId, request.paymentId);
        if (payment) await this.recordMismatch(payment, 'AMOUNT_MISMATCH', { status: request.providerStatus, amount: request.amount, currency: request.currency });
      }
      throw failure;
    }
  }

  async applySuccess(tx, payment, now) {
    const orderChanged = await tx.order.updateMany({ where: { id: payment.orderId, status: { in: ['CREATED', 'PAYMENT_PENDING'] } }, data: { status: 'PAID', paymentStatus: 'paid', amountPaidRub: Number(payment.amount), paidAt: now } });
    if (orderChanged.count !== 1) throw error('PAYMENT_ORDER_TRANSITION_FAILED', 'Order не может быть подтверждён.', 409);
    const flow = await tx.saleFlow.findFirst({ where: { flowId: payment.saleFlowId, organizationId: payment.organizationId } });
    if (!flow || flow.currentState !== 'AWAITING_PAYMENT') throw error('PAYMENT_SALE_FLOW_TRANSITION_FAILED', 'Sale Flow не ожидает оплату.', 409);
    await tx.saleFlow.update({ where: { flowId: flow.flowId }, data: { currentState: 'PAID', paymentReference: payment.id, version: { increment: 1 }, recoveryStatus: 'SAFE_TO_RESUME', updatedAt: now } });
  }

  async applyFailure(tx, payment, status, now) {
    await tx.order.updateMany({ where: { id: payment.orderId, status: { in: ['CREATED', 'PAYMENT_PENDING'] } }, data: { status: 'CANCELLED', paymentStatus: status.toLowerCase() } });
    const flow = await tx.saleFlow.findFirst({ where: { flowId: payment.saleFlowId, organizationId: payment.organizationId } });
    if (!flow || !['CREATED', 'AWAITING_PAYMENT'].includes(flow.currentState)) return;
    if (this.inventory && flow.inventoryReservationReference) await this.inventory.release(flow.inventoryReservationReference, { idempotencyKey: `payment-release:${payment.id}` }, { organizationId: payment.organizationId, actorType: 'SYSTEM', actorId: 'payment-domain', correlationId: flow.correlationId, transactionClient: tx });
    await tx.saleFlow.update({ where: { flowId: flow.flowId }, data: { currentState: status === 'FAILED' ? 'PAYMENT_FAILED' : 'CANCELLED', version: { increment: 1 }, recoveryStatus: 'NONE', updatedAt: now } });
  }

  async receiveWebhook(request) {
    required(request, ['provider', 'headers', 'rawBody', 'body']);
    const adapter = this.providers[request.provider];
    if (!adapter) throw error('PAYMENT_PROVIDER_UNSUPPORTED', 'Payment provider не поддерживается.', 400);
    await adapter.verifyWebhookSignature({ headers: request.headers, rawBody: request.rawBody });
    const event = await adapter.parseWebhook({ headers: request.headers, rawBody: request.rawBody, body: request.body });
    required(event, ['providerEventId', 'eventType', 'providerPaymentId', 'providerStatus']);
    const payment = await this.repository.getByProviderReferenceGlobal(request.provider, event.providerPaymentId);
    if (!payment) throw error('PAYMENT_NOT_FOUND', 'Payment для provider event не найден.', 404);
    if (request.organizationId && request.organizationId !== payment.organizationId) throw error('PAYMENT_TENANT_SCOPE_MISMATCH', 'Webhook не принадлежит указанной организации.', 403);
    const duplicate = await this.repository.findInbox(request.provider, event.providerEventId);
    if (duplicate) return { inbox: duplicate, duplicate: true };
    const inbox = await this.repository.createInbox({ organizationId: payment.organizationId, paymentId: payment.id, provider: request.provider, providerEventId: event.providerEventId, eventType: event.eventType, payload: safePayload(event), status: 'RECEIVED' });
    return { inbox, duplicate: false };
  }

  async processWebhook(request, context = {}) {
    const received = await this.receiveWebhook(request);
    if (received.duplicate) return received;
    return { ...received, ...(await this.processInbox(received.inbox, context)) };
  }

  async processInbox(inboxOrId, context = {}) {
    const inbox = typeof inboxOrId === 'string' ? await this.repository.getInbox(inboxOrId) : inboxOrId;
    if (!inbox) throw error('PAYMENT_INBOX_NOT_FOUND', 'Inbox event не найден.', 404);
    try {
      const event = inbox.payload;
      const payment = await this.repository.getById(inbox.organizationId, inbox.paymentId);
      if (!payment) throw error('PAYMENT_NOT_FOUND', 'Payment для provider event не найден.', 404);
      const common = { organizationId: payment.organizationId, paymentId: payment.id, idempotencyKey: `provider-event:${inbox.provider}:${inbox.providerEventId}`, providerPaymentId: event.providerPaymentId, providerStatus: event.providerStatus, amount: event.amount, currency: event.currency };
      let result;
      if (event.refundId && event.refundStatus === 'SUCCEEDED') result = await this.completeRefund({ organizationId: payment.organizationId, refundId: event.refundId, idempotencyKey: common.idempotencyKey, providerRefundId: event.providerRefundId, providerEventId: inbox.providerEventId }, context);
      else if (event.refundId && event.refundStatus === 'FAILED') result = await this.failRefund({ organizationId: payment.organizationId, refundId: event.refundId, idempotencyKey: common.idempotencyKey, providerRefundId: event.providerRefundId, providerEventId: inbox.providerEventId, failureCode: event.failureCode }, context);
      else if (event.providerStatus === 'SUCCEEDED') result = await this.confirmPayment(common, context);
      else if (event.providerStatus === 'FAILED') result = await this.failPayment(common, context);
      else if (event.providerStatus === 'CANCELED') result = await this.cancelPayment(common, context);
      else throw error('PAYMENT_PROVIDER_STATUS_UNSUPPORTED', 'Provider status не поддерживается.', 409);
      await this.repository.updateInbox(inbox.id, { status: 'PROCESSED', processedAt: this.clock(), attemptCount: { increment: 1 }, lockedAt: null, lockedBy: null, lastFailureCode: null, nextAttemptAt: null });
      return { payment: result.payment, refund: result.refund };
    } catch (failure) {
      await this.repository.updateInbox(inbox.id, { status: 'FAILED', attemptCount: { increment: 1 }, lockedAt: null, lockedBy: null, lastFailureCode: failure.code || 'PAYMENT_WEBHOOK_PROCESSING_FAILED', nextAttemptAt: new Date(this.clock().getTime() + 1000) });
      throw failure;
    }
  }

  async requestRefund(request, context = {}) {
    required(request, ['organizationId', 'paymentId', 'idempotencyKey', 'reason']);
    const duplicate = await this.repository.findRefundOperation(request.organizationId, request.idempotencyKey);
    if (duplicate) {
      const requestedAmount = money(request.amount ?? duplicate.amount);
      if (duplicate.paymentId !== request.paymentId || money(duplicate.amount) !== requestedAmount || duplicate.reason !== request.reason) throw error('PAYMENT_IDEMPOTENCY_CONFLICT', 'Idempotency key Refund уже использован для другой команды.', 409);
      return { refund: duplicate, duplicate: true };
    }
    return this.repository.transaction(async (repo, tx) => {
      const payment = await tx.payment.findFirst({ where: { id: request.paymentId, organizationId: request.organizationId } });
      if (!payment) throw error('PAYMENT_NOT_FOUND', 'Платёж не найден.', 404);
      assertPaymentTransition(payment.status, 'REFUND_PENDING');
      const amount = money(request.amount ?? payment.amount);
      if (Number(amount) > Number(payment.amount)) throw error('REFUND_AMOUNT_EXCEEDS_PAYMENT', 'Сумма возврата превышает платёж.', 409);
      const refund = await repo.createRefund({ organizationId: payment.organizationId, paymentId: payment.id, idempotencyKey: request.idempotencyKey, status: 'REQUESTED', amount, currency: payment.currency, reason: request.reason });
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUND_PENDING' } });
      await this.auditAndEvent(repo, payment, 'REFUND_REQUESTED', 'RefundRequested', context, refund.id, { refundId: refund.id, amount });
      return { refund, duplicate: false };
    });
  }

  completeRefund(request, context = {}) { return this.refundTransition(request, 'SUCCEEDED', context); }
  failRefund(request, context = {}) { return this.refundTransition(request, 'FAILED', context); }
  async refundTransition(request, status, context) {
    required(request, ['organizationId', 'refundId', 'idempotencyKey']);
    if (!request.providerEventId) throw error('REFUND_PROVIDER_CONFIRMATION_REQUIRED', 'Завершение Refund требует подтверждённый provider event.', 409);
    return this.repository.transaction(async (repo, tx) => {
      const refund = await tx.paymentRefund.findFirst({ where: { id: request.refundId, organizationId: request.organizationId }, include: { payment: true } });
      if (!refund) throw error('REFUND_NOT_FOUND', 'Возврат не найден.', 404);
      if (refund.status === status) return { refund, duplicate: true };
      if (!['REQUESTED', 'PENDING'].includes(refund.status)) throw error('REFUND_TRANSITION_INVALID', 'Переход Refund запрещён.', 409);
      const now = this.clock();
      const providerEvent = await tx.paymentProviderInbox.findFirst({ where: { organizationId: request.organizationId, providerEventId: request.providerEventId, paymentId: refund.paymentId } });
      if (!providerEvent) throw error('REFUND_PROVIDER_CONFIRMATION_REQUIRED', 'Provider event возврата не найден в durable Inbox.', 409);
      await tx.paymentRefund.update({ where: { id: refund.id }, data: { status, providerRefundId: request.providerRefundId || refund.providerRefundId, ...(status === 'SUCCEEDED' ? { succeededAt: now } : { failedAt: now, failureCode: request.failureCode || 'PROVIDER_FAILED' }) } });
      await tx.payment.update({ where: { id: refund.paymentId }, data: { status: status === 'SUCCEEDED' ? 'REFUNDED' : 'SUCCEEDED', ...(status === 'SUCCEEDED' && { refundedAt: now }) } });
      await this.auditAndEvent(repo, refund.payment, `REFUND_${status}`, status === 'SUCCEEDED' ? 'RefundSucceeded' : 'RefundFailed', context, request.idempotencyKey, { refundId: refund.id });
      return { refund: await tx.paymentRefund.findUnique({ where: { id: refund.id } }), duplicate: false };
    });
  }

  async recordMismatch(payment, category, provider = {}) {
    const fingerprint = hash({ paymentId: payment.id, category, localStatus: payment.status, providerStatus: provider.status || null, localAmount: money(payment.amount), providerAmount: provider.amount ? money(provider.amount) : null, providerCurrency: provider.currency || null });
    const existing = await this.repository.findReconciliation(payment.organizationId, fingerprint);
    if (existing) return existing;
    return this.repository.transaction(async (repo) => {
      const item = await repo.createReconciliation({ organizationId: payment.organizationId, paymentId: payment.id, provider: payment.provider, providerPaymentId: payment.providerPaymentId, category, fingerprint, status: 'MANUAL_REVIEW', localStatus: payment.status, providerStatus: provider.status || null, localAmount: payment.amount, providerAmount: provider.amount ? money(provider.amount) : null, details: sanitize(provider) });
      await this.auditAndEvent(repo, payment, 'RECONCILIATION_MISMATCH', 'PaymentReconciliationRequired', {}, item.id, { category });
      return item;
    });
  }

  async auditAndEvent(repo, payment, action, eventType, context = {}, causationId = null, payload = {}) {
    const now = this.clock();
    await repo.audit({ organizationId: payment.organizationId, paymentId: payment.id, action, actorType: context.actorType || 'SYSTEM', actorId: context.actorId || null, correlationId: context.correlationId || payment.saleFlowId || payment.id, details: sanitize(payload) });
    await repo.outbox({ eventId: `event_${crypto.randomUUID()}`, eventType, eventVersion: 1, aggregateType: 'PAYMENT', aggregateId: payment.id, organizationId: payment.organizationId, saleFlowId: payment.saleFlowId || null, payload: { paymentId: payment.id, orderId: payment.orderId, status: payment.status, ...sanitize(payload) }, status: 'PENDING', occurredAt: now, correlationId: context.correlationId || payment.saleFlowId || payment.id, causationId, idempotencyKey: `payment:${payment.id}:${eventType}:${causationId || payment.idempotencyKey}` });
  }
}

function required(value, keys) { for (const key of keys) if (value[key] === undefined || value[key] === null || value[key] === '') throw error('PAYMENT_VALIDATION_FAILED', `${key} обязателен.`, 400); }
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function canonicalCreateIdentity(value) { return stable({ orderId: value.orderId, saleFlowId: value.saleFlowId, amount: money(value.amount), currency: value.currency, provider: value.provider, description: value.description || null, metadata: sanitize(value.metadata) }); }
function stable(value) { if (Array.isArray(value)) return value.map(stable); if (!value || typeof value !== 'object') return value; return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])); }
function replayCreate(payment, fingerprint) { if (payment.requestFingerprint !== fingerprint) throw error('PAYMENT_IDEMPOTENCY_CONFLICT', 'Idempotency key создания уже использован для другого логического запроса.', 409); return { payment, duplicate: true }; }
function sanitize(value) { if (!value || typeof value !== 'object') return value || null; const out = {}; for (const [key, child] of Object.entries(value)) if (!/(authorization|cookie|secret|token|card|cvv|cvc|api.?key)/i.test(key)) out[key] = typeof child === 'object' ? sanitize(child) : child; return out; }
function safePayload(value) { return JSON.parse(JSON.stringify(sanitize(value)).slice(0, 65536)); }
function title(value) { return value[0] + value.slice(1).toLowerCase(); }
module.exports = { PaymentService };
