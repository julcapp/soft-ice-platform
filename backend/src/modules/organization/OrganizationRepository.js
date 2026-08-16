class OrganizationRepository {
  constructor(prisma) { this.prisma = prisma; }

  list(where = {}) {
    return this.prisma.organization.findMany({ where: { archivedAt: null, ...where }, orderBy: [{ shortName: 'asc' }, { id: 'asc' }] });
  }
  findById(id) {
    return this.prisma.organization.findFirst({ where: { id, archivedAt: null } });
  }
  create(data) { return this.prisma.organization.create({ data }); }
  update(id, data) { return this.prisma.organization.update({ where: { id }, data }); }
  listUnits(organizationId) {
    return this.prisma.organizationUnit.findMany({ where: { organizationId, archivedAt: null }, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
  }
  findUnit(id) { return this.prisma.organizationUnit.findUnique({ where: { id } }); }
  createUnit(data) { return this.prisma.organizationUnit.create({ data }); }
  updateUnit(id, data) { return this.prisma.organizationUnit.update({ where: { id }, data }); }
  listMembers(organizationId) {
    return this.prisma.organizationMember.findMany({ where: { organizationId, archivedAt: null }, include: { unit: true, roleAssignments: { where: { revokedAt: null } } }, orderBy: [{ fullName: 'asc' }, { id: 'asc' }] });
  }
  findMember(id) { return this.prisma.organizationMember.findUnique({ where: { id }, include: { roleAssignments: { where: { revokedAt: null } } } }); }
  createMember(data) { return this.prisma.organizationMember.create({ data }); }
  updateMember(id, data) { return this.prisma.organizationMember.update({ where: { id }, data }); }
  createRole(data) { return this.prisma.organizationRoleAssignment.create({ data }); }
  revokeRole(id, revokedAt) { return this.prisma.organizationRoleAssignment.update({ where: { id }, data: { revokedAt } }); }
  findRole(id) { return this.prisma.organizationRoleAssignment.findUnique({ where: { id } }); }
  listLocations(organizationId) {
    return this.prisma.organizationLocation.findMany({ where: { organizationId, archivedAt: null }, include: { responsibleUnit: true, responsibleMember: true, machineAssignments: { where: { unassignedAt: null }, include: { machine: true } } }, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
  }
  findLocation(id) { return this.prisma.organizationLocation.findUnique({ where: { id } }); }
  createLocation(data) { return this.prisma.organizationLocation.create({ data }); }
  updateLocation(id, data) { return this.prisma.organizationLocation.update({ where: { id }, data }); }
  listMachines(organizationId) {
    return this.prisma.organizationMachineAssignment.findMany({ where: { organizationId, unassignedAt: null }, include: { machine: true, location: true, responsibleMember: true, serviceSpecialist: true, ownerOrganization: true, operatorOrganization: true }, orderBy: [{ assignedAt: 'desc' }, { id: 'asc' }] });
  }
  findMachine(machineId) { return this.prisma.machine.findUnique({ where: { id: machineId } }); }
  findActiveMachineAssignment(machineId) { return this.prisma.organizationMachineAssignment.findFirst({ where: { machineId, unassignedAt: null } }); }
  createMachineAssignment(data) { return this.prisma.organizationMachineAssignment.create({ data }); }
  unassignMachine(id, unassignedAt) { return this.prisma.organizationMachineAssignment.update({ where: { id }, data: { unassignedAt } }); }
  listResponsibilities(organizationId) {
    return this.prisma.organizationResponsibility.findMany({ where: { organizationId, revokedAt: null }, include: { member: true, unit: true, location: true, machine: true }, orderBy: [{ assignedAt: 'desc' }, { id: 'asc' }] });
  }
  findResponsibility(id) { return this.prisma.organizationResponsibility.findUnique({ where: { id } }); }
  createResponsibility(data) { return this.prisma.organizationResponsibility.create({ data }); }
  revokeResponsibility(id, revokedAt) { return this.prisma.organizationResponsibility.update({ where: { id }, data: { revokedAt } }); }
  async overview(organizationId) {
    const [units, members, locations, machines, online, assignments] = await Promise.all([
      this.prisma.organizationUnit.count({ where: { organizationId, archivedAt: null } }),
      this.prisma.organizationMember.count({ where: { organizationId, archivedAt: null, status: 'ACTIVE' } }),
      this.prisma.organizationLocation.count({ where: { organizationId, archivedAt: null } }),
      this.prisma.organizationMachineAssignment.count({ where: { organizationId, unassignedAt: null } }),
      this.prisma.organizationMachineAssignment.count({ where: { organizationId, unassignedAt: null, machine: { status: 'ONLINE' } } }),
      this.prisma.organizationMachineAssignment.findMany({ where: { organizationId }, select: { machineId: true, assignedAt: true, unassignedAt: true } }),
    ]);
    const salesByAssignment = await Promise.all(assignments.map((assignment) => this.prisma.order.aggregate({
      where: { machineId: assignment.machineId, createdAt: { gte: assignment.assignedAt, ...(assignment.unassignedAt ? { lt: assignment.unassignedAt } : {}) }, status: { in: ['PAID', 'DISPENSING', 'COMPLETED'] } },
      _count: true, _sum: { amountPaidRub: true },
    })));
    const sales = salesByAssignment.reduce((total, item) => ({ count: total.count + (item._count || 0), revenueRub: total.revenueRub + Number(item._sum?.amountPaidRub || 0) }), { count: 0, revenueRub: 0 });
    return { units, members, locations, machines, online, incidents: null, maintenance: null, sales: sales.count, revenueRub: sales.revenueRub, customers: null };
  }
}

module.exports = { OrganizationRepository };
