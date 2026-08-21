const crypto = require('crypto');
const { validateEvent } = require('../transactional_outbox/OutboxRepository');
const RECOVERABLE_STATES = ['AWAITING_PAYMENT', 'PAID', 'FULFILLMENT_AUTHORIZED', 'DISPENSING', 'FULFILLMENT_FAILED', 'REFUND_REQUIRED'];
class PrismaSaleFlowRepository {
  constructor(prisma) { this.prisma = prisma; this.persistenceMode = 'POSTGRESQL'; this.implementationKind = 'PRODUCTION'; }
  create(data) { return this.prisma.saleFlow.create({ data: cleanFlow(data) }); }
  getById(id) { return this.prisma.saleFlow.findFirst({ where: { OR: [{ id }, { flowId: id }] } }); }
  getByOrderId(orderId) { return this.prisma.saleFlow.findUnique({ where: { orderId } }); }
  getByCorrelationId(correlationId) { return this.prisma.saleFlow.findUnique({ where: { correlationId } }); }
  list() { return this.prisma.saleFlow.findMany({ orderBy: { startedAt: 'desc' } }); }
  listRecoverable() { return this.prisma.saleFlow.findMany({ where: { currentState: { in: RECOVERABLE_STATES } }, orderBy: { updatedAt: 'asc' } }); }
  async updateState(flowId, nextState, patch = {}) { const current = await this.getById(flowId); if (!current) throw notFound(); return this.compareAndSetState(current.flowId, current.version, nextState, patch); }
  async compareAndSetState(flowId, expectedVersion, nextState, patch = {}) { const result = await this.prisma.saleFlow.updateMany({ where: { flowId, version: expectedVersion }, data: { ...safePatch(patch), currentState: nextState, version: { increment: 1 }, updatedAt: patch.updatedAt || new Date() } }); if (result.count !== 1) throw conflict(); return this.getById(flowId); }
  saveIdempotencyKey(record) { return this.prisma.saleFlowIdempotencyKey.create({ data: record }); }
  getIdempotencyKey(key) { return this.prisma.saleFlowIdempotencyKey.findUnique({ where: { key } }); }
  completeIdempotencyKey(key, resultReference) { return this.prisma.saleFlowIdempotencyKey.update({ where: { key }, data: { status: 'COMPLETED', resultReference: resultReference || null, completedAt: new Date() } }); }
  createOutboxEvent(event) { validateEvent(event); return this.prisma.transactionalOutboxEvent.create({ data: event }); }
  transactionWithOutbox(callback) { return this.prisma.$transaction((tx) => callback(new PrismaSaleFlowRepository(tx))); }
  transaction(callback) { return this.prisma.$transaction((tx) => callback(new PrismaSaleFlowRepository(tx))); }
  async health() { try { await this.prisma.$queryRaw`SELECT 1`; await this.prisma.$transaction((tx) => tx.$queryRaw`SELECT 1`); return { status: 'HEALTHY', repository: 'POSTGRESQL', readable: true, writable: true, transactional: true }; } catch { return { status: 'UNAVAILABLE', repository: 'POSTGRESQL', readable: false, writable: false, transactional: false, errorCode: 'SALE_FLOW_REPOSITORY_UNAVAILABLE' }; } }
}
class InMemorySaleFlowRepository {
  constructor(store = null) { this.store = store || { flows: new Map(), keys: new Map(), outbox: new Map() }; this.store.outbox ||= new Map(); this.persistenceMode = 'IN_MEMORY_TEST'; }
  async create(data) { if ([...this.store.flows.values()].some((v) => v.orderId === data.orderId || v.flowId === data.flowId || v.correlationId === data.correlationId)) throw unique(); const row = { id: data.id || crypto.randomUUID(), version: data.version || 0, recoveryStatus: data.recoveryStatus || 'NONE', metadata: data.metadata || {}, ...data }; this.store.flows.set(row.flowId, row); return row; }
  async getById(id) { return [...this.store.flows.values()].find((v) => v.id === id || v.flowId === id) || null; }
  async getByOrderId(orderId) { return [...this.store.flows.values()].find((v) => v.orderId === orderId) || null; }
  async getByCorrelationId(correlationId) { return [...this.store.flows.values()].find((v) => v.correlationId === correlationId) || null; }
  async list() { return [...this.store.flows.values()]; }
  async listRecoverable() { return [...this.store.flows.values()].filter((v) => RECOVERABLE_STATES.includes(v.currentState)); }
  async updateState(flowId, nextState, patch = {}) { const row = await this.getById(flowId); if (!row) throw notFound(); return this.compareAndSetState(flowId, row.version, nextState, patch); }
  async compareAndSetState(flowId, expectedVersion, nextState, patch = {}) { const row = await this.getById(flowId); if (!row) throw notFound(); if (row.version !== expectedVersion) throw conflict(); Object.assign(row, safePatch(patch), { currentState: nextState, flowState: nextState, version: row.version + 1, updatedAt: patch.updatedAt || new Date() }); return row; }
  async saveIdempotencyKey(record) { if (this.store.keys.has(record.key)) throw unique(); const row = { id: record.id || crypto.randomUUID(), status: 'STARTED', createdAt: new Date(), ...record }; this.store.keys.set(row.key, row); return row; }
  async getIdempotencyKey(key) { return this.store.keys.get(key) || null; }
  async completeIdempotencyKey(key, resultReference) { const row = this.store.keys.get(key); if (!row) throw notFound(); Object.assign(row, { status: 'COMPLETED', resultReference: resultReference || null, completedAt: new Date() }); return row; }
  async createOutboxEvent(event) { validateEvent(event); if ([...this.store.outbox.values()].some((x) => x.eventId === event.eventId || x.idempotencyKey === event.idempotencyKey)) throw unique(); const row={id:crypto.randomUUID(),status:'PENDING',attemptCount:0,createdAt:new Date(),updatedAt:new Date(),...event};this.store.outbox.set(row.eventId,row);return row; }
  async transaction(callback) { const clone={flows:new Map([...this.store.flows].map(([k,v])=>[k,{...v}])),keys:new Map([...this.store.keys].map(([k,v])=>[k,{...v}])),outbox:new Map([...this.store.outbox].map(([k,v])=>[k,{...v}]))}; const result=await callback(new InMemorySaleFlowRepository(clone)); this.store.flows=clone.flows;this.store.keys=clone.keys;this.store.outbox=clone.outbox;return result; }
  transactionWithOutbox(callback) { return this.transaction(callback); }
  async health() { return { status: 'HEALTHY', repository: 'IN_MEMORY_TEST', readable: true, writable: true, transactional: true }; }
}
function cleanFlow(value) { const copy = { ...value }; delete copy.flowState; delete copy.timestamps; delete copy.createdAt; return copy; }
function safePatch(value) { const allowed = ['paymentReference','fulfillmentAuthorizationReference','inventoryReservationReference','loyaltyOperationReference','refundRequirementReference','completionOperationId','completedAt','expiresAt','retentionUntil','lastProcessedEventId','lastErrorCode','lastErrorAt','recoveryStatus','metadata','updatedAt']; return Object.fromEntries(Object.entries(value).filter(([key]) => allowed.includes(key))); }
function conflict() { return Object.assign(new Error('Состояние процесса было изменено конкурентно.'), { code: 'SALE_FLOW_VERSION_CONFLICT', statusCode: 409 }); }
function notFound() { return Object.assign(new Error('Процесс продажи не найден.'), { code: 'SALE_FLOW_NOT_FOUND', statusCode: 404 }); }
function unique() { return Object.assign(new Error('Идемпотентный ключ или процесс уже существует.'), { code: 'SALE_FLOW_DUPLICATE', statusCode: 409 }); }
module.exports = { PrismaSaleFlowRepository, InMemorySaleFlowRepository, RECOVERABLE_STATES };
