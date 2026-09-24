'use strict';

class CatalogRepository {
  constructor(prisma) {
    if (!prisma) throw new Error('Prisma client is required.');
    this.prisma = prisma;
  }

  listAll() {
    return this.prisma.catalogItem.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { nameRu: 'asc' }],
      include: { machines: { include: { machine: { select: { id: true, machineCode: true, name: true } } } } },
    });
  }

  getItem(id) {
    return this.prisma.catalogItem.findUnique({ where: { id } });
  }

  async getItemByIdOrSku(value, client = this.prisma) {
    return client.catalogItem.findFirst({ where: { OR: [{ id: value }, { sku: value }] } });
  }

  async listMachineCatalog(machineId) {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      select: { id: true, machineCode: true, name: true, location: true },
    });
    if (!machine) return null;
    const assignments = await this.prisma.machineCatalogItem.findMany({
      where: { machineId, available: true, catalogItem: { active: true } },
      include: { catalogItem: true },
      orderBy: [{ catalogItem: { sortOrder: 'asc' } }],
    });
    return { machine, assignments };
  }

  createItem(data, context) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.catalogItem.create({ data });
      await this._audit(tx, 'CATALOG_ITEM_CREATED', context, item.id, { after: this._safe(item) });
      return item;
    });
  }

  updateItem(id, data, context, action = 'CATALOG_ITEM_UPDATED') {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.catalogItem.findUnique({ where: { id } });
      const item = await tx.catalogItem.update({ where: { id }, data });
      await this._audit(tx, action, context, id, { before: this._safe(before), after: this._safe(item) });
      return item;
    });
  }

  setAvailability({ machineId, catalogItemId, available }, context) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.machineCatalogItem.findUnique({
        where: { machineId_catalogItemId: { machineId, catalogItemId } },
      });
      const assignment = await tx.machineCatalogItem.upsert({
        where: { machineId_catalogItemId: { machineId, catalogItemId } },
        update: { available },
        create: { machineId, catalogItemId, available },
        include: { catalogItem: true },
      });
      await this._audit(tx, 'MACHINE_CATALOG_AVAILABILITY_UPDATED', context, catalogItemId, {
        machineId,
        before: this._safeAssignment(before),
        after: this._safeAssignment(assignment),
      });
      return assignment;
    });
  }

  setCurrentFlavor({ machineId, catalogItemId }, context) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.machineCatalogItem.findMany({
        where: { machineId, isCurrentFlavor: true },
        select: { id: true, machineId: true, catalogItemId: true, available: true, isCurrentFlavor: true },
      });
      await tx.machineCatalogItem.updateMany({ where: { machineId, isCurrentFlavor: true }, data: { isCurrentFlavor: false } });
      const assignment = await tx.machineCatalogItem.upsert({
        where: { machineId_catalogItemId: { machineId, catalogItemId } },
        update: { available: true, isCurrentFlavor: true },
        create: { machineId, catalogItemId, available: true, isCurrentFlavor: true },
        include: { catalogItem: true },
      });
      await this._audit(tx, 'MACHINE_CURRENT_FLAVOR_UPDATED', context, catalogItemId, {
        machineId,
        before: before.map((value) => this._safeAssignment(value)),
        after: this._safeAssignment(assignment),
      });
      return assignment;
    });
  }

  async _audit(client, eventType, context = {}, targetId, metadata) {
    await client.auditEvent.create({ data: {
      eventType,
      subjectType: 'ADMIN',
      subjectId: context.actorId || null,
      targetType: 'CATALOG_ITEM',
      targetId,
      action: eventType,
      decision: 'ALLOWED',
      reasonCode: 'EXPLICIT_ADMIN_ACTION',
      authMethod: context.authMethod || null,
      sourceChannel: 'ADMIN_API',
      correlationId: context.correlationId || null,
      metadata,
    } });
  }

  _safe(item) {
    if (!item) return null;
    return { ...item, basePrice: item.basePrice == null ? null : Number(item.basePrice) };
  }

  _safeAssignment(value) {
    if (!value) return null;
    return {
      id: value.id,
      machineId: value.machineId,
      catalogItemId: value.catalogItemId,
      available: value.available,
      isCurrentFlavor: value.isCurrentFlavor,
    };
  }
}

module.exports = { CatalogRepository };
