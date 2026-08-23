class ServiceSpecialistWorkspaceService {
  constructor({ prisma, specialistDirectory }) {
    if (!prisma) throw new Error('prisma is required');
    if (!specialistDirectory) throw new Error('specialistDirectory is required');
    this.prisma = prisma;
    this.specialistDirectory = specialistDirectory;
  }

  async getMyWorkspace({ subject }) {
    const profile = await this.specialistDirectory.getBySubject(subject);
    if (!profile) return { profile: null, machines: [], workItems: [], summary: { assignedMachines: 0, activeWorkItems: 0, overdue: 0 } };
    const machines = await this.prisma.$queryRawUnsafe(
      `SELECT a."machineId",m."machineCode",m."name",m."location",m."status",a."responsibleMemberId",a."serviceSpecialistId"
       FROM "OrganizationMachineAssignment" a
       JOIN "Machine" m ON m."id"=a."machineId"
       WHERE a."unassignedAt" IS NULL AND (a."serviceSpecialistId"=$1 OR a."responsibleMemberId"=$1)
       ORDER BY m."name"`, profile.memberId,
    );
    const workItems = await this.prisma.$queryRawUnsafe(
      `SELECT "id","notificationKey","title","message","deepLink","severity","status","ackDueAt","resolveDueAt","escalationLevel","sourceActive","updatedAt"
       FROM "AdminOperationsWorkItem"
       WHERE "assigneeSubject"=$1 AND "status"<>'RESOLVED'
       ORDER BY CASE "severity" WHEN 'CRITICAL' THEN 0 ELSE 1 END,"updatedAt" DESC LIMIT 100`, String(subject),
    );
    const now = new Date();
    return {
      profile,
      machines,
      workItems: workItems.map((item) => ({ ...item, ackOverdue: item.ackDueAt && new Date(item.ackDueAt) < now, resolveOverdue: item.resolveDueAt && new Date(item.resolveDueAt) < now })),
      summary: {
        assignedMachines: machines.length,
        activeWorkItems: workItems.length,
        overdue: workItems.filter((item) => (item.ackDueAt && new Date(item.ackDueAt) < now) || (item.resolveDueAt && new Date(item.resolveDueAt) < now)).length,
      },
    };
  }
}

module.exports = { ServiceSpecialistWorkspaceService };
