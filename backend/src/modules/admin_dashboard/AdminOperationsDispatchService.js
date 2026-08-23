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
    const items = center.items;
    const keys = items.map((item) => item.key);
    const workRows = keys.length
      ? await this.prisma.$queryRawUnsafe(
        `SELECT "id","notificationKey","status","assigneeSubject","acknowledgedAt","resolvedAt","createdAt","updatedAt"
         FROM "AdminOperationsWorkItem" WHERE "notificationKey" = ANY($1::text[])`, keys,
      ) : [];
    const workMap = new Map(workRows.map((row) => [row.notificationKey, row]));
    const enriched = items.map((item) => {
      const work = workMap.get(item.key) || null;
      const workStatus = work?.status || 'OPEN';
      return {
        ...item,
        category: sourceCategory(item.source),
        work: {
          id: work?.id || null,
          status: workStatus,
          assigneeSubject: work?.assigneeSubject || null,
          acknowledgedAt: work?.acknowledgedAt || null,
          resolvedAt: work?.resolvedAt || null,
          updatedAt: work?.updatedAt || null,
        },
      };
    }).filter((item) => category === 'ALL' || item.category === category)
      .filter((item) => severity === 'ALL' || item.severity === severity)
      .filter((item) => status === 'ALL' || item.work.status === status)
      .slice(0, safeLimit);

    return {
      summary: {
        total: enriched.length,
        critical: enriched.filter((item) => item.severity === 'CRITICAL').length,
        open: enriched.filter((item) => item.work.status === 'OPEN').length,
        inProgress: enriched.filter((item) => item.work.status === 'IN_PROGRESS').length,
        resolved: enriched.filter((item) => item.work.status === 'RESOLVED').length,
      },
      items: enriched,
      filters: { category, severity, status },
    };
  }

  async update({ notificationKey, actorSubject = 'admin', status, assigneeSubject, comment }) {
    const key = String(notificationKey || '').trim();
    if (!key) throw badRequest('ADMIN_OPERATIONS_KEY_REQUIRED', 'notificationKey is required');
    const nextStatus = status ? String(status).toUpperCase() : null;
    if (nextStatus && !['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(nextStatus)) throw badRequest('ADMIN_OPERATIONS_STATUS_INVALID', 'status is invalid');
    const actor = String(actorSubject || 'admin');
    const currentRows = await this.prisma.$queryRawUnsafe(
      `SELECT "id","status","assigneeSubject" FROM "AdminOperationsWorkItem" WHERE "notificationKey"=$1 LIMIT 1`, key,
    );
    const now = new Date();
    let current = currentRows[0] || null;
    if (!current) {
      const id = randomUUID();
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "AdminOperationsWorkItem" ("id","notificationKey","status","assigneeSubject","acknowledgedAt","resolvedAt","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
        id, key, nextStatus || 'OPEN', assigneeSubject || null,
        (nextStatus === 'IN_PROGRESS' || nextStatus === 'RESOLVED') ? now : null,
        nextStatus === 'RESOLVED' ? now : null,
        now,
      );
      current = { id, status: 'OPEN', assigneeSubject: null };
    } else {
      const effectiveStatus = nextStatus || current.status;
      const effectiveAssignee = assigneeSubject === undefined ? current.assigneeSubject : (assigneeSubject || null);
      await this.prisma.$executeRawUnsafe(
        `UPDATE "AdminOperationsWorkItem"
         SET "status"=$2,
             "assigneeSubject"=$3,
             "acknowledgedAt"=CASE WHEN $2 IN ('IN_PROGRESS','RESOLVED') THEN COALESCE("acknowledgedAt",$4) ELSE "acknowledgedAt" END,
             "resolvedAt"=CASE WHEN $2='RESOLVED' THEN COALESCE("resolvedAt",$4) ELSE NULL END,
             "updatedAt"=$4
         WHERE "id"=$1`,
        current.id, effectiveStatus, effectiveAssignee, now,
      );
    }

    const finalRows = await this.prisma.$queryRawUnsafe(
      `SELECT "id","notificationKey","status","assigneeSubject","acknowledgedAt","resolvedAt","createdAt","updatedAt" FROM "AdminOperationsWorkItem" WHERE "notificationKey"=$1 LIMIT 1`, key,
    );
    const finalItem = finalRows[0];
    const changedStatus = finalItem.status !== current.status;
    const changedAssignee = finalItem.assigneeSubject !== current.assigneeSubject;
    if (changedStatus || changedAssignee || String(comment || '').trim()) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "AdminOperationsWorkEvent" ("id","workItemId","eventType","actorSubject","fromStatus","toStatus","assigneeSubject","comment","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        randomUUID(), finalItem.id,
        changedStatus ? 'STATUS_CHANGED' : changedAssignee ? 'ASSIGNED' : 'COMMENTED',
        actor, current.status, finalItem.status, finalItem.assigneeSubject || null, String(comment || '').trim() || null, now,
      );
    }
    return finalItem;
  }

  async history({ notificationKey, limit = 100 }) {
    const key = String(notificationKey || '').trim();
    if (!key) throw badRequest('ADMIN_OPERATIONS_KEY_REQUIRED', 'notificationKey is required');
    const workRows = await this.prisma.$queryRawUnsafe(
      `SELECT "id","notificationKey","status","assigneeSubject","acknowledgedAt","resolvedAt","createdAt","updatedAt" FROM "AdminOperationsWorkItem" WHERE "notificationKey"=$1 LIMIT 1`, key,
    );
    if (!workRows[0]) return { workItem: null, events: [] };
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 300);
    const events = await this.prisma.$queryRawUnsafe(
      `SELECT "id","eventType","actorSubject","fromStatus","toStatus","assigneeSubject","comment","createdAt"
       FROM "AdminOperationsWorkEvent" WHERE "workItemId"=$1 ORDER BY "createdAt" DESC LIMIT $2`,
      workRows[0].id, safeLimit,
    );
    return { workItem: workRows[0], events };
  }
}

function sourceCategory(source) {
  if (source === 'FINANCIAL') return 'FINANCE';
  if (source === 'PRIVATE_CHANNEL') return 'SUBSCRIPTIONS';
  if (source === 'PHOTO_PUBLICATION') return 'CONTENT';
  if (source === 'MACHINE') return 'MACHINES';
  return 'OTHER';
}
function badRequest(code, message) { const error = new Error(message); error.code = code; error.statusCode = 400; return error; }
module.exports = { AdminOperationsDispatchService, sourceCategory };
