const crypto = require('crypto');
const { validateEvent } = require('../transactional_outbox/OutboxRepository');

const ACTIVE = ['PENDING', 'RESERVED'];
const TERMINAL = ['CONSUMED', 'RELEASED', 'EXPIRED', 'FAILED'];

class PostgresInventoryReservationService {
  constructor({ prisma, clock = () => new Date(), defaultTtlMs = 5 * 60 * 1000, priceCalculator = null, transactionMaxWaitMs = 15000, transactionTimeoutMs = 30000 }) {
    this.prisma = prisma;
    this.clock = clock;
    this.defaultTtlMs = defaultTtlMs;
    this.priceCalculator = priceCalculator;
    this.transactionMaxWaitMs = transactionMaxWaitMs;
    this.transactionTimeoutMs = transactionTimeoutMs;
    this.persistenceMode = 'POSTGRESQL';
    this.implementationKind = 'PRODUCTION';
  }

  calculatePrice(request) {
    if (!this.priceCalculator) throw problem('PRICE_ENGINE_UNAVAILABLE', 503, 'Authoritative Price Engine недоступен.');
    return this.priceCalculator(request);
  }

  async reserve(request, context, { transactionClient = null } = {}) {
    validateCommand(request, context);
    const client = transactionClient || this.prisma;
    const existing = await client.inventoryRuntimeReservation.findUnique({ where: { idempotencyKey: context.idempotencyKey }, include: { items: true } });
    if (existing) return replay(existing, request);
    const now = this.clock();
    const reservationId = request.reservationId || `inventory_reservation_${crypto.randomUUID()}`;
    const expiresAt = new Date(request.expiresAt || now.getTime() + this.defaultTtlMs);
    if (!(expiresAt > now)) throw problem('INVENTORY_RESERVATION_EXPIRY_INVALID', 400, 'Срок резерва должен быть в будущем.');
    try {
      const operation = async (tx) => {
        const location = await tx.inventoryRuntimeLocation.findFirst({ where: { id: request.locationId, machineId: request.machineId, locationType: 'MACHINE', active: true } });
        if (!location) throw problem('INVENTORY_MACHINE_LOCATION_MISMATCH', 409, 'Точка остатков не принадлежит указанному аппарату.');
        const requested = normalizeItems(request.items);
        const stocks = [];
        for (const item of [...requested].sort((a, b) => a.inventoryItemId.localeCompare(b.inventoryItemId))) {
          const [locked] = await tx.$queryRaw`SELECT * FROM "InventoryRuntimeStock" WHERE "organizationId"=${request.organizationId} AND "machineId"=${request.machineId} AND "locationId"=${request.locationId} AND "inventoryItemId"=${item.inventoryItemId} FOR UPDATE`;
          if (!locked) throw problem('INVENTORY_STOCK_NOT_FOUND', 409, 'Остаток для позиции не найден.');
          stocks.push({ item, stock: locked });
        }
        const insufficient = stocks.find(({ item, stock }) => Number(stock.physicalQuantity) - Number(stock.activeReservedQuantity) < item.quantity);
        const status = insufficient ? 'FAILED' : 'RESERVED';
        const reservation = await tx.inventoryRuntimeReservation.create({ data: {
          reservationId, saleFlowId: request.saleFlowId || null, orderId: request.orderId || null,
          machineId: request.machineId, organizationId: request.organizationId, locationId: request.locationId,
          status, operationType: request.operationType || 'CUSTOMER_SALE', actorType: context.actorType || 'SYSTEM', actorId: context.actorId || 'inventory-runtime',
          correlationId: context.correlationId, idempotencyKey: context.idempotencyKey, expiresAt,
          reason: insufficient ? 'INSUFFICIENT_STOCK' : request.reason || 'RESERVATION_CREATED',
          metadata: { ...(request.metadata || {}), requestFingerprint: fingerprint(request) },
          items: { create: requested.map((item) => ({ ...item, status, reservedQuantity: insufficient ? 0 : item.quantity })) },
        }, include: { items: true } });
        if (!insufficient) for (const { item, stock } of stocks) await tx.inventoryRuntimeStock.update({ where: { id: stock.id }, data: { activeReservedQuantity: { increment: item.quantity }, version: { increment: 1 } } });
        await createOutbox(tx, 'INVENTORY_RESERVATION_CREATED', reservation, `${context.idempotencyKey}:created`);
        await createOutbox(tx, status === 'RESERVED' ? 'INVENTORY_RESERVED' : 'INVENTORY_RESERVATION_FAILED', reservation, context.idempotencyKey);
        return { reservation, available: !insufficient, failureCode: insufficient ? 'INSUFFICIENT_STOCK' : null };
      };
      return transactionClient ? await operation(transactionClient) : await this.prisma.$transaction(operation, { isolationLevel: 'ReadCommitted', maxWait: this.transactionMaxWaitMs, timeout: this.transactionTimeoutMs });
    } catch (error) {
      if (error.code === 'P2002') {
        const duplicate = await this.prisma.inventoryRuntimeReservation.findUnique({ where: { idempotencyKey: context.idempotencyKey }, include: { items: true } });
        if (duplicate) return replay(duplicate, request);
      }
      throw error;
    }
  }

  async checkAndReserve(request, { transactionClient = null } = {}) {
    const items = request.items || request.product?.inventoryItems;
    if (!Array.isArray(items) || items.length === 0) throw problem('INVENTORY_RECIPE_UNAVAILABLE', 503, 'Для товара не настроен durable состав складского резерва.');
    const result = await this.reserve({ ...request, items }, {
      organizationId: request.organizationId,
      actorType: 'SYSTEM', actorId: 'sale-flow',
      correlationId: request.correlationId,
      idempotencyKey: request.idempotencyKey,
    }, { transactionClient });
    return { ...result, reservationId: result.reservation.reservationId };
  }

  consume(reservationId, request, context) { return this.finish(reservationId, 'CONSUMED', request, context); }
  release(reservationId, request, context) { return this.finish(reservationId, 'RELEASED', request, context); }
  expire(reservationId, request, context) { return this.finish(reservationId, 'EXPIRED', request, context); }

  async finish(reservationId, target, request = {}, context = {}) {
    if (!context.organizationId) throw problem('INVENTORY_TENANT_SCOPE_REQUIRED', 403, 'Контекст организации обязателен.');
    const operation = async (tx) => {
      const rows = await tx.$queryRaw`SELECT * FROM "InventoryRuntimeReservation" WHERE "reservationId"=${reservationId} AND "organizationId"=${context.organizationId} FOR UPDATE`;
      const current = rows[0];
      if (!current) throw problem('INVENTORY_RESERVATION_NOT_FOUND', 404, 'Резерв не найден.');
      if (current.status === target) return { reservation: await tx.inventoryRuntimeReservation.findUnique({ where: { reservationId }, include: { items: true } }), idempotentReplay: true };
      if (TERMINAL.includes(current.status)) throw problem('INVENTORY_RESERVATION_TERMINAL', 409, 'Резерв уже находится в терминальном статусе.');
      if (target === 'CONSUMED' && new Date(current.expiresAt) <= this.clock()) throw problem('INVENTORY_RESERVATION_EXPIRED', 409, 'Истёкший резерв нельзя списать.');
      const items = await tx.inventoryRuntimeReservationItem.findMany({ where: { reservationId } });
      for (const item of [...items].sort((a, b) => a.inventoryItemId.localeCompare(b.inventoryItemId))) {
        const stock = await tx.inventoryRuntimeStock.findUnique({ where: { organizationId_machineId_locationId_inventoryItemId: { organizationId: current.organizationId, machineId: current.machineId, locationId: current.locationId, inventoryItemId: item.inventoryItemId } } });
        if (!stock) throw problem('INVENTORY_STOCK_NOT_FOUND', 409, 'Остаток для позиции не найден.');
        await tx.$queryRaw`SELECT "id" FROM "InventoryRuntimeStock" WHERE "id"=${stock.id} FOR UPDATE`;
        const data = target === 'CONSUMED'
          ? { physicalQuantity: { decrement: item.reservedQuantity }, activeReservedQuantity: { decrement: item.reservedQuantity }, version: { increment: 1 } }
          : { activeReservedQuantity: { decrement: item.reservedQuantity }, version: { increment: 1 } };
        const updatedStock = await tx.inventoryRuntimeStock.update({ where: { id: stock.id }, data });
        await tx.inventoryRuntimeReservationItem.update({ where: { id: item.id }, data: { status: target, consumedQuantity: target === 'CONSUMED' ? item.reservedQuantity : 0, releasedQuantity: target === 'CONSUMED' ? 0 : item.reservedQuantity } });
        if (target === 'CONSUMED') await tx.inventoryRuntimeMovement.create({ data: { itemId: item.inventoryItemId, locationId: current.locationId, movementType: current.operationType === 'CUSTOMER_SALE' ? 'CONSUMPTION' : 'TEST_CONSUMPTION', quantity: item.reservedQuantity, delta: -item.reservedQuantity, unit: item.unit, reason: request.reason || target, sourceType: current.operationType, sourceId: reservationId, actorType: context.actorType || 'SYSTEM', actorId: context.actorId || 'inventory-runtime', correlationId: current.correlationId, idempotencyKey: `${target}:${reservationId}:${item.inventoryItemId}`, occurredAt: this.clock(), metadata: { operationType: current.operationType } } });
        if (target === 'CONSUMED' && updatedStock.lowStockThreshold !== null && updatedStock.physicalQuantity <= updatedStock.lowStockThreshold) await createOutbox(tx, 'INVENTORY_LOW_STOCK', { ...current, reservationId }, `${reservationId}:${item.inventoryItemId}:low-stock`);
      }
      const reservation = await tx.inventoryRuntimeReservation.update({ where: { reservationId }, data: { status: target, confirmedAt: target === 'CONSUMED' ? this.clock() : null, releasedAt: target === 'CONSUMED' ? null : this.clock(), reason: request.reason || target, version: { increment: 1 } }, include: { items: true } });
      await createOutbox(tx, target === 'CONSUMED' ? 'INVENTORY_CONSUMED' : target === 'EXPIRED' ? 'INVENTORY_RESERVATION_EXPIRED' : 'INVENTORY_RESERVATION_RELEASED', reservation, context.idempotencyKey || `${target}:${reservationId}`);
      return { reservation, idempotentReplay: false };
    };
    return context.transactionClient ? operation(context.transactionClient) : this.prisma.$transaction(operation, { maxWait: this.transactionMaxWaitMs, timeout: this.transactionTimeoutMs });
  }

  expireDue({ organizationId, limit = 100 } = {}) {
    if (!organizationId) throw problem('INVENTORY_TENANT_SCOPE_REQUIRED', 403, 'Контекст организации обязателен.');
    return this.prisma.inventoryRuntimeReservation.findMany({ where: { organizationId, status: 'RESERVED', expiresAt: { lte: this.clock() } }, orderBy: { expiresAt: 'asc' }, take: limit }).then(async (rows) => Promise.all(rows.map((row) => this.expire(row.reservationId, { reason: 'RESERVATION_TTL_EXPIRED' }, { organizationId, correlationId: row.correlationId, idempotencyKey: `EXPIRE:${row.reservationId}` }))));
  }

  list(filters, context) { if (!context?.organizationId) throw problem('INVENTORY_TENANT_SCOPE_REQUIRED', 403, 'Контекст организации обязателен.'); return this.prisma.inventoryRuntimeReservation.findMany({ where: { organizationId: context.organizationId, ...(filters?.status && { status: filters.status }), ...(filters?.machineId && { machineId: filters.machineId }) }, include: { items: true }, orderBy: { createdAt: 'desc' } }); }
}

async function createOutbox(tx, eventType, reservation, key) {
  // Sale Flow создаётся после успешного резерва, поэтому до появления строки SaleFlow
  // ссылка присутствует в envelope payload, но nullable FK outbox остаётся пустым.
  const event = { eventId: `event_${crypto.randomUUID()}`, eventType, eventVersion: 1, aggregateType: 'INVENTORY_RESERVATION', aggregateId: reservation.reservationId, organizationId: reservation.organizationId, machineId: reservation.machineId, saleFlowId: null, correlationId: reservation.correlationId, idempotencyKey: `inventory:${key}:${eventType}`, payload: { reservationId: reservation.reservationId, saleFlowId: reservation.saleFlowId, orderId: reservation.orderId, organizationId: reservation.organizationId, machineId: reservation.machineId, status: reservation.status } };
  validateEvent(event); await tx.transactionalOutboxEvent.create({ data: event });
}
function normalizeItems(items) { if (!Array.isArray(items) || !items.length) throw problem('INVENTORY_ITEMS_REQUIRED', 400, 'Нужна хотя бы одна позиция резерва.'); const seen = new Set(); return items.map((item) => { const quantity = Number(item.quantity); if (!item.inventoryItemId || !item.ingredientType || !item.unit || !(quantity > 0)) throw problem('INVENTORY_ITEM_INVALID', 400, 'Позиция резерва заполнена некорректно.'); if (seen.has(item.inventoryItemId)) throw problem('INVENTORY_ITEM_DUPLICATE', 400, 'Позиция не должна повторяться в резерве.'); seen.add(item.inventoryItemId); return { inventoryItemId: item.inventoryItemId, ingredientType: item.ingredientType, unit: item.unit, quantity }; }); }
function validateCommand(request, context) { for (const key of ['organizationId','machineId','locationId']) if (!request?.[key]) throw problem('INVENTORY_RESERVATION_INVALID', 400, `${key} обязателен.`); for (const key of ['idempotencyKey','correlationId']) if (!context?.[key]) throw problem('INVENTORY_CONTEXT_INVALID', 400, `${key} обязателен.`); if (context.organizationId && context.organizationId !== request.organizationId) throw problem('INVENTORY_TENANT_SCOPE_MISMATCH', 403, 'Организация запроса не совпадает с доверенным контекстом.'); }
function replay(existing, request) { if (existing.metadata?.requestFingerprint !== fingerprint(request)) throw problem('IDEMPOTENCY_KEY_REUSED', 409, 'Idempotency key повторно использован с другим запросом.'); return { reservation: existing, available: existing.status === 'RESERVED', failureCode: existing.status === 'FAILED' ? 'INSUFFICIENT_STOCK' : null, idempotentReplay: true }; }
function fingerprint(value) { return crypto.createHash('sha256').update(stable(value)).digest('hex'); }
function stable(value) { if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`; if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${key}:${stable(value[key])}`).join(',')}}`; return JSON.stringify(value); }
function problem(code, statusCode, message) { return Object.assign(new Error(message), { code, statusCode }); }

module.exports = { PostgresInventoryReservationService };
