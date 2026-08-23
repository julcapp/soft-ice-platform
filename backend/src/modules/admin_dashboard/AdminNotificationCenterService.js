const { randomUUID } = require('crypto');

class AdminNotificationCenterService {
  constructor({ prisma }) {
    if (!prisma) throw new Error('prisma is required');
    this.prisma = prisma;
  }

  async list({ adminSubject = 'admin', limit = 100 } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 300);
    const [financial, renewals, publications, receipts] = await Promise.all([
      this.prisma.$queryRawUnsafe(`SELECT "id","alertKey","reportDate","alertType","severity","title","message","deepLink","status","firstDetectedAt","lastDetectedAt","resolvedAt" FROM "FinancialOpsAlert" WHERE "status"='OPEN' ORDER BY CASE "severity" WHEN 'CRITICAL' THEN 0 ELSE 1 END,"lastDetectedAt" DESC LIMIT $1`, safeLimit),
      this.prisma.$queryRawUnsafe(`SELECT a."id",a."status",a."failureCode",a."failureMessage",a."attemptCount",a."updatedAt",p."channelType",p."name" AS "planName",c."name" AS "customerName" FROM "PrivateChannelRenewalAttempt" a JOIN "PrivateChannelSubscription" s ON s."id"=a."subscriptionId" JOIN "PrivateChannelPlan" p ON p."id"=s."planId" JOIN "Customer" c ON c."id"=a."customerId" WHERE a."status" IN ('FAILED','EXHAUSTED') ORDER BY CASE WHEN a."status"='EXHAUSTED' THEN 0 ELSE 1 END,a."updatedAt" DESC LIMIT $1`, safeLimit),
      this.prisma.$queryRawUnsafe(`SELECT "id","photoChallengeId","channel","status","errorCode","errorMessage","lastAttemptAt","updatedAt" FROM "PhotoPublication" WHERE LOWER("status")='failed' ORDER BY COALESCE("lastAttemptAt","updatedAt") DESC LIMIT $1`, safeLimit),
      this.prisma.$queryRawUnsafe(`SELECT "notificationKey","readAt" FROM "AdminNotificationReceipt" WHERE "adminSubject"=$1`, String(adminSubject)),
    ]);
    const readMap = new Map(receipts.map((row) => [row.notificationKey, row.readAt]));
    const items = [
      ...financial.map((row) => ({ key: `financial:${row.alertKey}`, source: 'FINANCIAL', severity: row.severity || 'WARNING', title: row.title, message: row.message, deepLink: row.deepLink || '#business-analytics', occurredAt: row.lastDetectedAt || row.firstDetectedAt, referenceId: row.id })),
      ...renewals.map((row) => ({ key: `private-renewal:${row.id}:${row.status}`, source: 'PRIVATE_CHANNEL', severity: row.status === 'EXHAUSTED' ? 'CRITICAL' : 'WARNING', title: `${row.channelType || 'Канал'}: проблема автопродления`, message: row.failureMessage || row.failureCode || `Попыток: ${Number(row.attemptCount || 0)}`, deepLink: '#private-channel-recovery', occurredAt: row.updatedAt, referenceId: row.id })),
      ...publications.map((row) => ({ key: `photo-publication:${row.id}:failed`, source: 'PHOTO_PUBLICATION', severity: 'WARNING', title: `Ошибка публикации ${row.channel}`, message: row.errorMessage || row.errorCode || 'Публикация не выполнена.', deepLink: '#photo-verification', occurredAt: row.lastAttemptAt || row.updatedAt, referenceId: row.photoChallengeId })),
    ].map((item) => ({ ...item, readAt: readMap.get(item.key) || null, unread: !readMap.get(item.key) }))
      .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || new Date(b.occurredAt || 0) - new Date(a.occurredAt || 0))
      .slice(0, safeLimit);
    return { unreadCount: items.filter((item) => item.unread).length, items };
  }

  async markRead({ adminSubject = 'admin', notificationKey }) {
    const key = String(notificationKey || '').trim();
    if (!key) throw badRequest('ADMIN_NOTIFICATION_KEY_REQUIRED', 'notificationKey is required');
    const now = new Date();
    await this.prisma.$executeRawUnsafe(`INSERT INTO "AdminNotificationReceipt" ("id","adminSubject","notificationKey","readAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$4,$4) ON CONFLICT ("adminSubject","notificationKey") DO UPDATE SET "readAt"=EXCLUDED."readAt","updatedAt"=EXCLUDED."updatedAt"`, randomUUID(), String(adminSubject), key, now);
    return { notificationKey: key, readAt: now };
  }

  async markAllRead({ adminSubject = 'admin' } = {}) {
    const current = await this.list({ adminSubject, limit: 300 });
    for (const item of current.items.filter((item) => item.unread)) await this.markRead({ adminSubject, notificationKey: item.key });
    return { marked: current.items.filter((item) => item.unread).length };
  }
}
function severityRank(value) { return value === 'CRITICAL' ? 0 : value === 'WARNING' ? 1 : 2; }
function badRequest(code, message) { const error = new Error(message); error.code = code; error.statusCode = 400; return error; }
module.exports = { AdminNotificationCenterService };
