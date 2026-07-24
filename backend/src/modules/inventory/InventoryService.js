const crypto = require('crypto');
const { ApiError } = require('../../platform/errors/ApiError');
const { ITEM_CATEGORY, LOCATION_TYPE, MOVEMENT_TYPE, RESERVATION_STATUS, DIRECTION } = require('./InventoryModels');

class InventoryService {
  constructor({ repository, auditRepository, eventPublisher, clock = () => new Date() }) {
    this.repository = repository; this.auditRepository = auditRepository;
    this.eventPublisher = eventPublisher; this.clock = clock;
  }
  createItem(request, context) {
    return this.idempotent('create_item', request, context, async () => {
      const item = await this.repository.createItem({
        id: optionalId(request.id), sku: code(request.sku, 'sku'), name: text(request.name, 'name'),
        category: enumeration(request.category, ITEM_CATEGORY, 'category'), baseUnit: code(request.baseUnit, 'base_unit'),
        metadata: object(request.metadata || {}, 'metadata'),
      });
      await this.after('Inventory.ItemCreated', item.id, context, item); return item;
    });
  }
  createLocation(request, context) {
    return this.idempotent('create_location', request, context, async () => {
      const location = await this.repository.createLocation({
        id: optionalId(request.id), code: code(request.code, 'code'), name: text(request.name, 'name'),
        locationType: enumeration(request.locationType, LOCATION_TYPE, 'location_type'),
        machineId: request.machineId || null, warehouseId: request.warehouseId || null,
        metadata: object(request.metadata || {}, 'metadata'),
      });
      if (location.locationType === 'MACHINE' && !location.machineId) validation('machine_id', 'is required for MACHINE location');
      await this.after('Inventory.LocationCreated', location.id, context, location); return location;
    });
  }
  recordMovement(request, context) {
    return this.idempotent('record_movement', request, context, async () => {
      const item = await this.requireItem(request.itemId); const location = await this.requireLocation(request.locationId);
      const movementType = enumeration(request.movementType, MOVEMENT_TYPE, 'movement_type');
      const requestedQuantity = movementType === MOVEMENT_TYPE.ADJUSTMENT ? signed(request.quantity, 'quantity') : positive(request.quantity, 'quantity');
      const quantity = Math.abs(requestedQuantity); const current = await this.getBalance(item.id, location.id);
      let delta = DIRECTION[movementType] ? DIRECTION[movementType] * quantity : requestedQuantity;
      if (movementType === MOVEMENT_TYPE.INVENTORY_COUNT) delta = quantity - current.onHand;
      if (current.onHand + delta < 0 && request.allowNegative !== true) throw conflict('INVENTORY_INSUFFICIENT_STOCK', 'Movement would make on-hand stock negative.');
      const movement = await this.repository.appendMovement({
        itemId: item.id, locationId: location.id, movementType, quantity, delta, unit: item.baseUnit,
        reason: text(request.reason, 'reason'), sourceType: request.sourceType || 'API', sourceId: request.sourceId || null,
        sourceEventId: request.sourceEventId || null, actorType: context.actorType, actorId: context.actorId,
        correlationId: requiredContext(context, 'correlationId'), idempotencyKey: requiredContext(context, 'idempotencyKey'),
        occurredAt: date(request.occurredAt || this.clock(), 'occurred_at'), metadata: object(request.metadata || {}, 'metadata'),
      });
      const balance = await this.getBalance(item.id, location.id);
      await this.after('Inventory.MovementRecorded', movement.id, context, { ...movement, balance });
      return { movement, balance };
    });
  }
  reserve(request, context) {
    return this.idempotent('reserve', request, context, async () => {
      const item = await this.requireItem(request.itemId); await this.requireLocation(request.locationId);
      const quantity = positive(request.quantity, 'quantity'); const balance = await this.getBalance(item.id, request.locationId);
      if (balance.available < quantity) throw conflict('INVENTORY_INSUFFICIENT_AVAILABLE_STOCK', 'Available stock is insufficient for reservation.');
      const reservation = await this.repository.createReservation({
        itemId: item.id, locationId: request.locationId, quantity, unit: item.baseUnit, status: RESERVATION_STATUS.ACTIVE,
        purpose: text(request.purpose, 'purpose'), sourceType: request.sourceType || 'API', sourceId: request.sourceId || null,
        expiresAt: request.expiresAt ? date(request.expiresAt, 'expires_at') : null, actorType: context.actorType,
        actorId: context.actorId, correlationId: requiredContext(context, 'correlationId'), idempotencyKey: requiredContext(context, 'idempotencyKey'),
      });
      await this.after('Inventory.StockReserved', reservation.id, context, reservation); return { reservation, balance: await this.getBalance(item.id, request.locationId) };
    });
  }
  changeReservation(reservationId, action, request, context) {
    return this.idempotent(`${action}_reservation`, { reservationId, ...request }, context, async () => {
      const reservation = await this.repository.findReservation(reservationId);
      if (!reservation) throw notFound('Inventory reservation');
      if (reservation.status !== RESERVATION_STATUS.ACTIVE) throw conflict('INVENTORY_RESERVATION_TERMINAL', 'Reservation is already terminal.');
      let movement = null;
      if (action === 'consume') {
        const result = await this.recordMovement({
          itemId: reservation.itemId, locationId: reservation.locationId, movementType: MOVEMENT_TYPE.CONSUMPTION,
          quantity: reservation.quantity, reason: request.reason || 'reservation_consumed', sourceType: 'RESERVATION',
          sourceId: reservation.id,
        }, { ...context, idempotencyKey: `${context.idempotencyKey}:movement` });
        movement = result.movement;
      }
      const status = action === 'consume' ? RESERVATION_STATUS.CONSUMED : RESERVATION_STATUS.RELEASED;
      const updated = await this.repository.updateReservation(reservationId, { status, completedAt: this.clock() });
      await this.after(action === 'consume' ? 'Inventory.ReservationConsumed' : 'Inventory.ReservationReleased', reservationId, context, updated);
      return { reservation: updated, movement, balance: await this.getBalance(updated.itemId, updated.locationId) };
    });
  }
  async getBalance(itemId, locationId) {
    const movements = await this.repository.listMovements({ itemId, locationId });
    const reservations = await this.repository.listReservations({ itemId, locationId, status: RESERVATION_STATUS.ACTIVE });
    const now = this.clock();
    const onHand = movements.reduce((sum, movement) => sum + movement.delta, 0);
    const reserved = reservations.filter((entry) => !entry.expiresAt || new Date(entry.expiresAt) > now).reduce((sum, entry) => sum + entry.quantity, 0);
    return { itemId, locationId, onHand, reserved, available: onHand - reserved, calculatedAt: now };
  }
  async listBalances(filters = {}) {
    const items = filters.itemId ? [await this.requireItem(filters.itemId)] : await this.repository.listItems();
    const locations = filters.locationId ? [await this.requireLocation(filters.locationId)] : await this.repository.listLocations();
    return Promise.all(items.flatMap((item) => locations.map((location) => this.getBalance(item.id, location.id))));
  }
  listMovements(filters) { return this.repository.listMovements(filters); }
  listReservations(filters) { return this.repository.listReservations(filters); }
  listItems() { return this.repository.listItems(); }
  listLocations() { return this.repository.listLocations(); }
  async requireItem(id) { const row = await this.repository.findItem(id); if (!row) throw notFound('Inventory item'); return row; }
  async requireLocation(id) { const row = await this.repository.findLocation(id); if (!row) throw notFound('Inventory location'); return row; }
  idempotent(operation, request, context, callback) {
    const key = requiredContext(context, 'idempotencyKey');
    return this.repository.executeIdempotent(`${operation}:${key}`, fingerprint(request), callback);
  }
  async after(eventType, targetId, context, payload) {
    await this.auditRepository?.record?.({ eventType, subjectType: context.actorType, subjectId: context.actorId, targetType: 'Inventory', targetId, action: eventType.split('.').pop(), decision: 'success', sourceChannel: context.sourceChannel, correlationId: context.correlationId, metadata: { idempotency_key: context.idempotencyKey } });
    await this.eventPublisher?.publish?.({ eventType, eventVersion: 1, aggregateType: 'INVENTORY', aggregateId: targetId, actorType: context.actorType || 'SYSTEM', actorId: context.actorId || 'inventory-runtime', sourceChannel: context.sourceChannel || 'INVENTORY_RUNTIME', correlationId: context.correlationId, payload, metadata: { idempotencyKey: context.idempotencyKey } });
  }
}

function fingerprint(value) { return crypto.createHash('sha256').update(stable(value)).digest('hex'); }
function stable(value) { if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`; if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${key}:${stable(value[key])}`).join(',')}}`; return JSON.stringify(value); }
function requiredContext(context, field) { const value = context?.[field]; if (!value) throw new ApiError({ statusCode: 400, code: field === 'idempotencyKey' ? 'IDEMPOTENCY_KEY_REQUIRED' : 'CORRELATION_ID_REQUIRED', message: `${field} is required.` }); return value; }
function optionalId(value) { return value ? code(value, 'id') : undefined; }
function text(value, field) { if (typeof value !== 'string' || !value.trim()) validation(field, 'must be a non-empty string'); return value.trim(); }
function code(value, field) { const result = text(value, field); if (!/^[a-z][a-z0-9_-]*$/.test(result)) validation(field, 'must be a stable semantic ID'); return result; }
function object(value, field) { if (!value || typeof value !== 'object' || Array.isArray(value)) validation(field, 'must be an object'); return value; }
function positive(value, field) { const number = Number(value); if (!Number.isFinite(number) || number <= 0) validation(field, 'must be positive'); return number; }
function signed(value, field) { const number = Number(value); if (!Number.isFinite(number) || number === 0) validation(field, 'must be non-zero'); return number; }
function date(value, field) { const result = new Date(value); if (Number.isNaN(result.getTime())) validation(field, 'must be a date-time'); return result; }
function enumeration(value, allowed, field) { const result = String(value || '').toUpperCase(); if (!Object.values(allowed).includes(result)) validation(field, `must be one of ${Object.values(allowed).join(', ')}`); return result; }
function validation(field, issue) { throw new ApiError({ statusCode: 400, code: 'VALIDATION_FAILED', message: 'Request validation failed.', details: [{ field, issue }] }); }
function conflict(code, message) { return new ApiError({ statusCode: 409, code, message, source: 'runtime' }); }
function notFound(resource) { return new ApiError({ statusCode: 404, code: 'RESOURCE_NOT_FOUND', message: `${resource} was not found.`, source: 'runtime' }); }

module.exports = { InventoryService };
