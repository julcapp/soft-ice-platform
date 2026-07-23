class SegmentationRepository {
  constructor(prisma) { this.prisma = prisma; }

  createSegment(data) { return this.prisma.segment.create({ data, include: { rules: true } }); }
  findSegmentById(id) { return this.prisma.segment.findUnique({ where: { id }, include: { rules: { orderBy: [{ priority: 'asc' }, { id: 'asc' }] } } }); }
  findSegmentByCode(code) { return this.prisma.segment.findUnique({ where: { code }, include: { rules: { orderBy: [{ priority: 'asc' }, { id: 'asc' }] } } }); }
  listSegments() { return this.prisma.segment.findMany({ include: { rules: { orderBy: [{ priority: 'asc' }, { id: 'asc' }] } }, orderBy: [{ code: 'asc' }] }); }
  setSegmentStatus(id, status) { return this.prisma.segment.update({ where: { id }, data: { status }, include: { rules: true } }); }
  addRule(segmentId, data) { return this.prisma.segmentRule.create({ data: { segmentId, ...data } }); }

  async assignCustomer(command) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.customerSegment.findFirst({
        where: { customerId: command.customerId, segmentId: command.segmentId, unassignedAt: null },
        include: { segment: true },
      });
      if (existing) return { assignment: existing, created: false };
      const assignment = await tx.customerSegment.create({ data: command, include: { segment: true } });
      return { assignment, created: true };
    });
  }

  async unassignCustomer(customerId, segmentId, unassignedAt) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.customerSegment.findFirst({ where: { customerId, segmentId, unassignedAt: null } });
      if (!existing) return null;
      return tx.customerSegment.update({ where: { id: existing.id }, data: { unassignedAt }, include: { segment: true } });
    });
  }

  findActiveForCustomer(customerId) {
    return this.prisma.customerSegment.findMany({
      where: { customerId, unassignedAt: null, segment: { status: 'ACTIVE' } },
      include: { segment: true }, orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }],
    });
  }

  findHistoryForCustomer(customerId) {
    return this.prisma.customerSegment.findMany({
      where: { customerId }, include: { segment: true },
      orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }],
    });
  }
}

module.exports = { SegmentationRepository };
