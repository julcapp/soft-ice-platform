const { randomUUID } = require('crypto');

class AdminOperationsDispatchService {
  constructor({ prisma, notificationCenter }) {
    if (!prisma) throw new Error('prisma is required');
    if (!notificationCenter) throw new Error('notificationCenter is required');
    this.prisma = prisma;
    this.notificationCenter = notificationCenter;
  }

  async list({ adminSubject = 'admin', category = 'ALL', severity = 'ALL', status = 'ALL', limit = 200 } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 300);
    const center = await this.notificationCenter.list({ adminSubject, limit: 300 });
    await this.#syncSnapshots(center.items || []);
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT "id","notificationKey","source","sourceReferenceId","category","severity","title","message","deepLink","sourceActive","lastSourceSeenAt","status","assigneeSubject","assigneeDisplayName","assignmentMode","assignmentReason","acknowledgedAt","resolvedAt","createdAt","updatedAt"
       FROM "AdminOperationsWorkItem"
       WHERE ($1='ALL' OR "category"=$1) AND ($2='ALL' OR "severity"=$2) AND ($3='ALL' OR "status"=$3)
       ORDER BY CASE "severity" WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END, "sourceActive" DESC, "updatedAt" DESC LIMIT $4`,
      category, severity, status, safeLimit,
    );
    const items = rows.map((row) => ({
      key: row.notificationKey, source: row.source, referenceId: row.sourceReferenceId, category: row.category, severity: row.severity, title: row.title, message: row.message,
      deepLink: row.deepLink, sourceActive: row.sourceActive, occurredAt: row.lastSourceSeenAt,
      work: { id: row.id, status: row.status, assigneeSubject: row.assigneeSubject, assigneeDisplayName: row.assigneeDisplayName, assignmentMode: row.assignmentMode, assignmentReason: row.assignmentReason, acknowledgedAt: row.acknowledgedAt, resolvedAt: row.resolvedAt, updatedAt: row.updatedAt },
    }));
    return { summary: { total: items.length, critical: items.filter((i) => i.severity === 'CRITICAL').length, open: items.filter((i) => i.work.status === 'OPEN').length, inProgress: items.filter((i) => i.work.status === 'IN_PROGRESS').length, resolved: items.filter((i) => i.work.status === 'RESOLVED').length }, items, filters: { category, severity, status } };
  }

  async #syncSnapshots(items) {
    const now = new Date();
    await this.prisma.$executeRawUnsafe(`UPDATE "AdminOperationsWorkItem" SET "sourceActive"=FALSE,"updatedAt"="updatedAt" WHERE "sourceActive"=TRUE`);
    const machineItems = items.filter((item) => item.source === 'MACHINE' && item.referenceId);
    const assignments = await this.#loadMachineAssignments(machineItems.map((item) => item.referenceId));
    for (const item of items) {
      const category = sourceCategory(item.source);
      const auto = item.source === 'MACHINE' ? autoAssignmentFor(item, assignments.get(item.referenceId)) : null;
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "AdminOperationsWorkItem" ("id","notificationKey","source","sourceReferenceId","category","severity","title","message","deepLink","sourceActive","lastSourceSeenAt","status","assigneeSubject","assigneeDisplayName","assignmentMode","assignmentReason","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,$10,'OPEN',$11,$12,$13,$14,$10,$10)
         ON CONFLICT ("notificationKey") DO UPDATE SET "source"=EXCLUDED."source","sourceReferenceId"=EXCLUDED."sourceReferenceId","category"=EXCLUDED."category","severity"=EXCLUDED."severity","title"=EXCLUDED."title","message"=EXCLUDED."message","deepLink"=EXCLUDED."deepLink","sourceActive"=TRUE,"lastSourceSeenAt"=EXCLUDED."lastSourceSeenAt",
           "assigneeSubject"=CASE WHEN "AdminOperationsWorkItem"."assigneeSubject" IS NULL THEN EXCLUDED."assigneeSubject" ELSE "AdminOperationsWorkItem"."assigneeSubject" END,
           "assigneeDisplayName"=CASE WHEN "AdminOperationsWorkItem"."assigneeSubject" IS NULL THEN EXCLUDED."assigneeDisplayName" ELSE "AdminOperationsWorkItem"."assigneeDisplayName" END,
           "assignmentMode"=CASE WHEN "AdminOperationsWorkItem"."assigneeSubject" IS NULL THEN EXCLUDED."assignmentMode" ELSE "AdminOperationsWorkItem"."assignmentMode" END,
           "assignmentReason"=CASE WHEN "AdminOperationsWorkItem"."assigneeSubject" IS NULL THEN EXCLUDED."assignmentReason" ELSE "AdminOperationsWorkItem"."assignmentReason" END`,
        randomUUID(), item.key, item.source, item.referenceId || null, category, item.severity || 'WARNING', item.title || item.key, item.message || null, item.deepLink || null, now,
        auto?.subject || null, auto?.displayName || null, auto ? 'AUTO' : null, auto?.reason || null,
      );
    }
  }

  async #loadMachineAssignments(machineIds) {
    const ids = [...new Set(machineIds.filter(Boolean))];
    if (!ids.length) return new Map();
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT a."machineId",a."responsibleMemberId",a."serviceSpecialistId",
              r."fullName" AS "responsibleName",r."platformUserId" AS "responsiblePlatformUserId",
              s."fullName" AS "serviceName",s."platformUserId" AS "servicePlatformUserId"
       FROM "OrganizationMachineAssignment" a
       LEFT JOIN "OrganizationMember" r ON r."id"=a."responsibleMemberId"
       LEFT JOIN "OrganizationMember" s ON s."id"=a."serviceSpecialistId"
       WHERE a."machineId" = ANY($1::text[]) AND a."unassignedAt" IS NULL
       ORDER BY a."assignedAt" DESC`, ids,
    );
    const map = new Map();
    for (const row of rows) if (!map.has(row.machineId)) map.set(row.machineId, row);
    return map;
  }

  async update({ notificationKey, actorSubject = 'admin', status, assigneeSubject, comment }) {
    const key = String(notificationKey || '').trim();
    if (!key) throw badRequest('ADMIN_OPERATIONS_KEY_REQUIRED', 'notificationKey is required');
    const nextStatus = status ? String(status).toUpperCase() : null;
    if (nextStatus && !['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(nextStatus)) throw badRequest('ADMIN_OPERATIONS_STATUS_INVALID', 'status is invalid');
    const rows = await this.prisma.$queryRawUnsafe(`SELECT "id","status","assigneeSubject","assigneeDisplayName" FROM "AdminOperationsWorkItem" WHERE "notificationKey"=$1 LIMIT 1`, key);
    const current = rows[0];
    if (!current) throw badRequest('ADMIN_OPERATIONS_ITEM_NOT_FOUND', 'Incident is not present in the dispatch ledger');
    const now = new Date();
    const effectiveStatus = nextStatus || current.status;
    const manualAssigneeProvided = assigneeSubject !== undefined;
    const effectiveAssignee = manualAssigneeProvided ? (String(assigneeSubject || '').trim() || null) : current.assigneeSubject;
    await this.prisma.$executeRawUnsafe(
      `UPDATE "AdminOperationsWorkItem" SET "status"=$2,"assigneeSubject"=$3,
       "assigneeDisplayName"=CASE WHEN $5 THEN $3 ELSE "assigneeDisplayName" END,
       "assignmentMode"=CASE WHEN $5 THEN 'MANUAL' ELSE "assignmentMode" END,
       "assignmentReason"=CASE WHEN $5 THEN 'Назначено вручную администратором' ELSE "assignmentReason" END,
       "acknowledgedAt"=CASE WHEN $2 IN ('IN_PROGRESS','RESOLVED') THEN COALESCE("acknowledgedAt",$4) ELSE "acknowledgedAt" END,
       "resolvedAt"=CASE WHEN $2='RESOLVED' THEN COALESCE("resolvedAt",$4) ELSE NULL END,"updatedAt"=$4 WHERE "id"=$1`,
      current.id, effectiveStatus, effectiveAssignee, now, manualAssigneeProvided,
    );
    const finalRows = await this.prisma.$queryRawUnsafe(`SELECT "id","notificationKey","status","assigneeSubject","assigneeDisplayName","assignmentMode","assignmentReason","acknowledgedAt","resolvedAt","createdAt","updatedAt" FROM "AdminOperationsWorkItem" WHERE "id"=$1 LIMIT 1`, current.id);
    const finalItem = finalRows[0];
    const changedStatus = finalItem.status !== current.status;
    const changedAssignee = finalItem.assigneeSubject !== current.assigneeSubject;
    const note = String(comment || '').trim();
    if (changedStatus || changedAssignee || note) await this.prisma.$executeRawUnsafe(
      `INSERT INTO "AdminOperationsWorkEvent" ("id","workItemId","eventType","actorSubject","fromStatus","toStatus","assigneeSubject","comment","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      randomUUID(), finalItem.id, changedStatus ? 'STATUS_CHANGED' : changedAssignee ? 'ASSIGNED' : 'COMMENTED', String(actorSubject || 'admin'), current.status, finalItem.status, finalItem.assigneeSubject || null, note || null, now,
    );
    return finalItem;
  }

  async history({ notificationKey, limit = 100 }) {
    const key = String(notificationKey || '').trim();
    if (!key) throw badRequest('ADMIN_OPERATIONS_KEY_REQUIRED', 'notificationKey is required');
    const workRows = await this.prisma.$queryRawUnsafe(`SELECT * FROM "AdminOperationsWorkItem" WHERE "notificationKey"=$1 LIMIT 1`, key);
    if (!workRows[0]) return { workItem: null, events: [] };
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 300);
    const events = await this.prisma.$queryRawUnsafe(`SELECT "id","eventType","actorSubject","fromStatus","toStatus","assigneeSubject","comment","createdAt" FROM "AdminOperationsWorkEvent" WHERE "workItemId"=$1 ORDER BY "createdAt" DESC LIMIT $2`, workRows[0].id, safeLimit);
    return { workItem: workRows[0], events };
  }
}

function autoAssignmentFor(item, assignment) {
  if (!assignment) return null;
  const technical = isTechnicalMachineIncident(item.key);
  if (technical && assignment.serviceSpecialistId) return {
    subject: assignment.servicePlatformUserId || `organization-member:${assignment.serviceSpecialistId}`,
    displayName: assignment.serviceName || 'Сервисный специалист',
    reason: 'Технический инцидент автоматически назначен сервисному специалисту аппарата',
  };
  if (assignment.responsibleMemberId) return {
    subject: assignment.responsiblePlatformUserId || `organization-member:${assignment.responsibleMemberId}`,
    displayName: assignment.responsibleName || 'Ответственный за аппарат',
    reason: item.key.startsWith('machine:low-stock:') ? 'Низкий остаток автоматически назначен ответственному за аппарат/точку' : 'Инцидент автоматически назначен ответственному за аппарат',
  };
  if (assignment.serviceSpecialistId) return {
    subject: assignment.servicePlatformUserId || `organization-member:${assignment.serviceSpecialistId}`,
    displayName: assignment.serviceName || 'Сервисный специалист',
    reason: 'Ответственный не назначен; использован сервисный специалист аппарата',
  };
  return null;
}
function isTechnicalMachineIncident(key) {
  return key.startsWith('machine:dispense-') || key.startsWith('machine:connectivity:') || key.includes(':ERROR') || key.includes(':OFFLINE');
}
function sourceCategory(source) { if (source === 'FINANCIAL') return 'FINANCE'; if (source === 'PRIVATE_CHANNEL') return 'SUBSCRIPTIONS'; if (source === 'PHOTO_PUBLICATION') return 'CONTENT'; if (source === 'MACHINE') return 'MACHINES'; return 'OTHER'; }
function badRequest(code, message) { const error = new Error(message); error.code = code; error.statusCode = 400; return error; }
module.exports = { AdminOperationsDispatchService, sourceCategory, autoAssignmentFor, isTechnicalMachineIncident };
