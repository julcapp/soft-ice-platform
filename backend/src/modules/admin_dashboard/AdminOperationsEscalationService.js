const { randomUUID } = require('crypto');

class AdminOperationsEscalationService {
  constructor({ prisma, clock = () => new Date() }) {
    if (!prisma) throw new Error('prisma is required');
    this.prisma = prisma;
    this.clock = clock;
  }

  async sync() {
    const now = this.clock();
    const workItems = await this.prisma.$queryRawUnsafe(
      `SELECT "id","notificationKey","source","sourceReferenceId","status","assigneeSubject","assigneeDisplayName","escalationLevel"
       FROM "AdminOperationsWorkItem"
       WHERE "status"<>'RESOLVED' AND "escalationLevel">0`,
    );

    const machineIds = [...new Set(workItems.filter((row) => row.source === 'MACHINE' && row.sourceReferenceId).map((row) => row.sourceReferenceId))];
    const machineAssignments = await this.#loadMachineAssignments(machineIds);
    let created = 0;

    for (const item of workItems) {
      if (Number(item.escalationLevel || 0) >= 1) {
        const target = levelOneTarget(item, machineAssignments.get(item.sourceReferenceId));
        created += await this.#ensureEscalation(item, 1, target, now);
      }
      if (Number(item.escalationLevel || 0) >= 2) {
        const target = levelTwoTarget(item);
        created += await this.#ensureEscalation(item, 2, target, now);
      }
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE "AdminOperationsEscalation" e
       SET "status"='RESOLVED',"resolvedAt"=COALESCE("resolvedAt",$1)
       FROM "AdminOperationsWorkItem" w
       WHERE e."workItemId"=w."id" AND e."status"='ACTIVE' AND w."status"='RESOLVED'`, now,
    );

    return { activeWorkItems: workItems.length, created };
  }

  async listActive({ limit = 100 } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 300);
    return this.prisma.$queryRawUnsafe(
      `SELECT e."id",e."workItemId",e."level",e."recipientSubject",e."recipientDisplayName",e."reason",e."status",e."createdAt",
              w."notificationKey",w."title",w."message",w."deepLink",w."severity",w."source",w."sourceReferenceId",w."assigneeDisplayName"
       FROM "AdminOperationsEscalation" e
       JOIN "AdminOperationsWorkItem" w ON w."id"=e."workItemId"
       WHERE e."status"='ACTIVE'
       ORDER BY e."level" DESC,e."createdAt" DESC LIMIT $1`, safeLimit,
    );
  }

  async #ensureEscalation(item, level, target, now) {
    const recipient = target || fallbackTarget(level);
    const id = randomUUID();
    const result = await this.prisma.$executeRawUnsafe(
      `INSERT INTO "AdminOperationsEscalation" ("id","workItemId","level","recipientSubject","recipientDisplayName","reason","status","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE',$7)
       ON CONFLICT ("workItemId","level") DO NOTHING`,
      id, item.id, level, recipient.subject, recipient.displayName, recipient.reason, now,
    );
    if (Number(result || 0) > 0) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "AdminOperationsWorkEvent" ("id","workItemId","eventType","actorSubject","fromStatus","toStatus","assigneeSubject","comment","createdAt")
         VALUES ($1,$2,'ESCALATED','system',NULL,NULL,$3,$4,$5)`,
        randomUUID(), item.id, recipient.subject, `L${level}: ${recipient.reason}`, now,
      );
      return 1;
    }
    return 0;
  }

  async #loadMachineAssignments(machineIds) {
    if (!machineIds.length) return new Map();
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT a."machineId",a."responsibleMemberId",r."fullName" AS "responsibleName",r."platformUserId" AS "responsiblePlatformUserId"
       FROM "OrganizationMachineAssignment" a
       LEFT JOIN "OrganizationMember" r ON r."id"=a."responsibleMemberId"
       WHERE a."machineId" = ANY($1::text[]) AND a."unassignedAt" IS NULL
       ORDER BY a."assignedAt" DESC`, machineIds,
    );
    const result = new Map();
    for (const row of rows) if (!result.has(row.machineId)) result.set(row.machineId, row);
    return result;
  }
}

function levelOneTarget(item, assignment) {
  if (item.source === 'MACHINE' && assignment?.responsibleMemberId) {
    return {
      subject: assignment.responsiblePlatformUserId || `organization-member:${assignment.responsibleMemberId}`,
      displayName: assignment.responsibleName || 'Ответственный за аппарат/точку',
      reason: `SLA принятия нарушен; инцидент поднят ответственному за аппарат/точку${item.assigneeDisplayName ? ` поверх исполнителя ${item.assigneeDisplayName}` : ''}`,
    };
  }
  return { subject: 'role:ADMIN', displayName: 'Администратор платформы', reason: 'SLA принятия нарушен; требуется контроль администратора' };
}

function levelTwoTarget(item) {
  return {
    subject: 'role:PLATFORM_OWNER',
    displayName: 'Владелец платформы',
    reason: `SLA решения нарушен; требуется эскалация владельцу платформы${item.assigneeDisplayName ? `, исполнитель: ${item.assigneeDisplayName}` : ''}`,
  };
}

function fallbackTarget(level) {
  return level >= 2
    ? { subject: 'role:PLATFORM_OWNER', displayName: 'Владелец платформы', reason: 'SLA решения нарушен; требуется контроль владельца платформы' }
    : { subject: 'role:ADMIN', displayName: 'Администратор платформы', reason: 'SLA принятия нарушен; требуется контроль администратора' };
}

module.exports = { AdminOperationsEscalationService, levelOneTarget, levelTwoTarget };
