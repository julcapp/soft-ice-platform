class MachineOperationsRepository {
  constructor(prisma) { this.prisma = prisma; }

  findOperatorById(id) { return this.prisma.operator.findUnique({ where: { id }, include: { permissions: true } }); }
  createOperator(data) { return this.prisma.operator.create({ data, include: { permissions: true } }); }
  findMachine(id) { return this.prisma.machine.findUnique({ where: { id } }); }
  createChecklist(data) { return this.prisma.maintenanceChecklist.create({ data }); }
  findChecklist(id) { return this.prisma.maintenanceChecklist.findUnique({ where: { id } }); }
  createTask(data) { return this.prisma.maintenanceTask.create({ data, include: { checklist: true, machine: true } }); }
  findTask(id) { return this.prisma.maintenanceTask.findUnique({ where: { id }, include: { checklist: true, machine: true, photoEvidence: true } }); }
  updateTask(id, data) { return this.prisma.maintenanceTask.update({ where: { id }, data, include: { checklist: true, machine: true, photoEvidence: true } }); }
  createServiceLog(data) { return this.prisma.serviceLog.create({ data, include: { photoEvidence: true } }); }
  findServiceLog(id) { return this.prisma.serviceLog.findUnique({ where: { id }, include: { photoEvidence: true } }); }
  updateServiceLog(id, data) { return this.prisma.serviceLog.update({ where: { id }, data, include: { photoEvidence: true } }); }
  createPhotoEvidence(data) { return this.prisma.photoEvidence.create({ data }); }
  createInventoryMovement(data) { return this.prisma.inventoryMovement.create({ data }); }
  upsertMachineSetting(machineId, key, value, updatedById) {
    return this.prisma.machineSetting.upsert({
      where: { machineId_key: { machineId, key } },
      create: { machineId, key, value, updatedById },
      update: { value, updatedById },
    });
  }
  listOperatorActions(limit = 100) {
    return this.prisma.auditEvent.findMany({ where: { subjectType: 'operator' }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: limit });
  }

  createTestRunWithConsumption({ testRun, movements }) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.testRun.create({ data: testRun });
      const inventoryMovements = [];
      for (const movement of movements) {
        inventoryMovements.push(await tx.inventoryMovement.create({ data: { ...movement, testRunId: created.id } }));
      }
      return { testRun: created, inventoryMovements };
    });
  }
}

module.exports = { MachineOperationsRepository };
