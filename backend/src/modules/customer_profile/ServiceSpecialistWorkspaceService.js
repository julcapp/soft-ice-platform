class ServiceSpecialistWorkspaceService {
  constructor({ prisma, specialistDirectory }) {
    if (!prisma) throw new Error('prisma is required');
    if (!specialistDirectory) throw new Error('specialistDirectory is required');
    this.prisma = prisma;
    this.specialistDirectory = specialistDirectory;
  }

  async getForCustomer(customerId) {
    const profile = await this.specialistDirectory.getBySubject(customerId);
    if (!profile) throw forbidden('SERVICE_CONTEXT_NOT_AVAILABLE', 'Рабочий кабинет недоступен для этого пользователя.');

    const subjects = [String(customerId), `organization-member:${profile.memberId}`];
    const [assignments, workItems, escalations] = await Promise.all([
      this.prisma.$queryRawUnsafe(
        `SELECT a."machineId",a."responsibleMemberId",a."serviceSpecialistId",a."assignedAt",
                m."machineCode",m."name" AS "machineName",m."location",m."status"
         FROM "OrganizationMachineAssignment" a JOIN "Machine" m ON m."id"=a."machineId"
         WHERE a."unassignedAt" IS NULL AND (a."serviceSpecialistId"=$1 OR a."responsibleMemberId"=$1)
         ORDER BY m."machineCode"`, profile.memberId,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT "id","notificationKey","sourceReferenceId","category","severity","title","message","deepLink","sourceActive","status","assigneeSubject","ackDueAt","resolveDueAt","ackBreachedAt","resolveBreachedAt","escalationLevel","updatedAt"
         FROM "AdminOperationsWorkItem"
         WHERE "assigneeSubject" = ANY($1::text[]) AND "status"<>'RESOLVED'
         ORDER BY CASE "severity" WHEN 'CRITICAL' THEN 0 ELSE 1 END,"updatedAt" DESC LIMIT 200`, subjects,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT e."id",e."level",e."recipientSubject",e."recipientDisplayName",e."reason",e."status",e."createdAt",w."notificationKey",w."title",w."deepLink"
         FROM "AdminOperationsEscalation" e JOIN "AdminOperationsWorkItem" w ON w."id"=e."workItemId"
         WHERE e."status"='OPEN' AND e."recipientSubject" = ANY($1::text[])
         ORDER BY e."level" DESC,e."createdAt" DESC LIMIT 100`, subjects,
      ),
    ]);

    return {
      context: 'SERVICE',
      profile,
      assignments: assignments.map((row) => ({
        machineId: row.machineId,
        machineCode: row.machineCode,
        machineName: row.machineName,
        location: row.location,
        status: row.status,
        role: row.serviceSpecialistId === profile.memberId ? 'SERVICE_SPECIALIST' : 'MACHINE_RESPONSIBLE',
        assignedAt: row.assignedAt,
      })),
      incidents: workItems.map((row) => ({
        id: row.id, key: row.notificationKey, machineId: row.sourceReferenceId, category: row.category, severity: row.severity,
        title: row.title, message: row.message, deepLink: row.deepLink, sourceActive: row.sourceActive, status: row.status,
        sla: { ackDueAt: row.ackDueAt, resolveDueAt: row.resolveDueAt, ackBreachedAt: row.ackBreachedAt, resolveBreachedAt: row.resolveBreachedAt },
        escalationLevel: Number(row.escalationLevel || 0), updatedAt: row.updatedAt,
      })),
      escalations,
      summary: {
        machines: assignments.length,
        activeIncidents: workItems.length,
        criticalIncidents: workItems.filter((row) => row.severity === 'CRITICAL').length,
        overdue: workItems.filter((row) => row.ackBreachedAt || row.resolveBreachedAt).length,
        activeEscalations: escalations.length,
      },
    };
  }
}

function forbidden(code, message) { const error = new Error(message); error.code = code; error.statusCode = 403; return error; }
module.exports = { ServiceSpecialistWorkspaceService };
