const { randomUUID } = require('crypto');

class AdminNotificationCenterService {
  constructor({ prisma, clock = () => new Date() }) {
    if (!prisma) throw new Error('prisma is required');
    this.prisma = prisma;
    this.clock = clock;
  }

  async list({ adminSubject = 'admin', limit = 100 } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 300);
    const now = this.clock();
    const stuckBefore = new Date(now.getTime() - 10 * 60 * 1000);
    const recentFailureAfter = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const staleConnectivityBefore = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [financial, renewals, publications, machineStates, dispenseStuck, dispenseFailed, connectivity, lowStock, receipts] = await Promise.all([
      this.prisma.$queryRawUnsafe(`SELECT "id","alertKey","reportDate","alertType","severity","title","message","deepLink","status","firstDetectedAt","lastDetectedAt","resolvedAt" FROM "FinancialOpsAlert" WHERE "status"='OPEN' ORDER BY CASE "severity" WHEN 'CRITICAL' THEN 0 ELSE 1 END,"lastDetectedAt" DESC LIMIT $1`, safeLimit),
      this.prisma.$queryRawUnsafe(`SELECT a."id",a."status",a."failureCode",a."failureMessage",a."attemptCount",a."updatedAt",p."channelType",p."name" AS "planName",c."name" AS "customerName" FROM "PrivateChannelRenewalAttempt" a JOIN "PrivateChannelSubscription" s ON s."id"=a."subscriptionId" JOIN "PrivateChannelPlan" p ON p."id"=s."planId" JOIN "Customer" c ON c."id"=a."customerId" WHERE a."status" IN ('FAILED','EXHAUSTED') ORDER BY CASE WHEN a."status"='EXHAUSTED' THEN 0 ELSE 1 END,a."updatedAt" DESC LIMIT $1`, safeLimit),
      this.prisma.$queryRawUnsafe(`SELECT "id","photoChallengeId","channel","status","errorCode","errorMessage","lastAttemptAt","updatedAt" FROM "PhotoPublication" WHERE LOWER("status")='failed' ORDER BY COALESCE("lastAttemptAt","updatedAt") DESC LIMIT $1`, safeLimit),
      this.prisma.$queryRawUnsafe(`SELECT "id","machineCode","name","location","status","updatedAt" FROM "Machine" WHERE "status" IN ('OFFLINE','ERROR') ORDER BY CASE "status" WHEN 'ERROR' THEN 0 ELSE 1 END,"updatedAt" DESC LIMIT $1`, safeLimit),
      this.prisma.$queryRawUnsafe(`SELECT d."id",d."orderId",d."machineId",d."state",d."commandId",d."requestedAt",d."startedAt",d."updatedAt",m."machineCode",m."name" AS "machineName",m."location" FROM "DispenseRequest" d JOIN "Machine" m ON m."id"=d."machineId" WHERE d."state" IN ('REQUESTED','STARTED') AND COALESCE(d."startedAt",d."requestedAt") <= $1 ORDER BY COALESCE(d."startedAt",d."requestedAt") ASC LIMIT $2`, stuckBefore, safeLimit),
      this.prisma.$queryRawUnsafe(`SELECT d."id",d."orderId",d."machineId",d."state",d."failureReason",d."failedAt",d."updatedAt",m."machineCode",m."name" AS "machineName",m."location" FROM "DispenseRequest" d JOIN "Machine" m ON m."id"=d."machineId" WHERE d."state"='FAILED' AND COALESCE(d."failedAt",d."updatedAt") >= $1 ORDER BY COALESCE(d."failedAt",d."updatedAt") DESC LIMIT $2`, recentFailureAfter, safeLimit),
      this.prisma.$queryRawUnsafe(`SELECT p."machineId",p."tariffStatus",p."currentBalance",p."minimumBalanceThreshold",p."trafficLimitMb",p."trafficRemainingMb",p."lastCheckedAt",p."updatedAt",m."machineCode",m."name" AS "machineName",m."location" FROM "MachineMobilePlan" p JOIN "Machine" m ON m."id"=p."machineId" WHERE p."tariffStatus" IN ('SUSPENDED','BLOCKED') OR (p."currentBalance" IS NOT NULL AND p."minimumBalanceThreshold" IS NOT NULL AND p."currentBalance" < p."minimumBalanceThreshold") OR (p."trafficRemainingMb" IS NOT NULL AND p."trafficLimitMb" IS NOT NULL AND p."trafficRemainingMb" < LEAST(500, p."trafficLimitMb" * 0.1)) OR p."lastCheckedAt" IS NULL OR p."lastCheckedAt" < $1 ORDER BY p."updatedAt" DESC LIMIT $2`, staleConnectivityBefore, safeLimit),
      this.prisma.$queryRawUnsafe(`SELECT s."id",s."machineId",s."physicalQuantity",s."activeReservedQuantity",s."lowStockThreshold",s."updatedAt",i."name" AS "itemName",i."sku",m."machineCode",m."name" AS "machineName",m."location" FROM "InventoryRuntimeStock" s JOIN "InventoryRuntimeItem" i ON i."id"=s."inventoryItemId" JOIN "Machine" m ON m."id"=s."machineId" WHERE s."lowStockThreshold" IS NOT NULL AND (s."physicalQuantity" - s."activeReservedQuantity") <= s."lowStockThreshold" ORDER BY (s."physicalQuantity" - s."activeReservedQuantity") ASC LIMIT $1`, safeLimit),
      this.prisma.$queryRawUnsafe(`SELECT "notificationKey","readAt" FROM "AdminNotificationReceipt" WHERE "adminSubject"=$1`, String(adminSubject)),
    ]);

    const readMap = new Map(receipts.map((row) => [row.notificationKey, row.readAt]));
    const items = [
      ...financial.map((row) => ({ key: `financial:${row.alertKey}`, source: 'FINANCIAL', severity: row.severity || 'WARNING', title: row.title, message: row.message, deepLink: row.deepLink || '#business-analytics', occurredAt: row.lastDetectedAt || row.firstDetectedAt, referenceId: row.id })),
      ...renewals.map((row) => ({ key: `private-renewal:${row.id}:${row.status}`, source: 'PRIVATE_CHANNEL', severity: row.status === 'EXHAUSTED' ? 'CRITICAL' : 'WARNING', title: `${row.channelType || 'Канал'}: проблема автопродления`, message: row.failureMessage || row.failureCode || `Попыток: ${Number(row.attemptCount || 0)}`, deepLink: '#private-channel-recovery', occurredAt: row.updatedAt, referenceId: row.id })),
      ...publications.map((row) => ({ key: `photo-publication:${row.id}:failed`, source: 'PHOTO_PUBLICATION', severity: 'WARNING', title: `Ошибка публикации ${row.channel}`, message: row.errorMessage || row.errorCode || 'Публикация не выполнена.', deepLink: '#photo-verification', occurredAt: row.lastAttemptAt || row.updatedAt, referenceId: row.photoChallengeId })),
      ...machineStates.map((row) => machineStateItem(row)),
      ...dispenseStuck.map((row) => ({ key: `machine:dispense-stuck:${row.id}`, source: 'MACHINE', severity: 'CRITICAL', title: `${machineLabel(row)}: зависла выдача`, message: `Команда ${row.commandId || '—'} находится в состоянии ${row.state} более 10 минут. Заказ: ${row.orderId}.`, deepLink: `#machine-runtime/${row.machineId}`, occurredAt: row.startedAt || row.requestedAt || row.updatedAt, referenceId: row.machineId })),
      ...dispenseFailed.map((row) => ({ key: `machine:dispense-failed:${row.id}`, source: 'MACHINE', severity: 'CRITICAL', title: `${machineLabel(row)}: ошибка выдачи`, message: row.failureReason || `Выдача заказа ${row.orderId} завершилась ошибкой.`, deepLink: `#machine-runtime/${row.machineId}`, occurredAt: row.failedAt || row.updatedAt, referenceId: row.machineId })),
      ...connectivity.flatMap((row) => connectivityItems(row)),
      ...lowStock.map((row) => ({ key: `machine:low-stock:${row.id}`, source: 'MACHINE', severity: availableStock(row) <= 0 ? 'CRITICAL' : 'WARNING', title: `${machineLabel(row)}: низкий остаток`, message: `${row.itemName || row.sku}: доступно ${formatNumber(availableStock(row))}, порог ${formatNumber(row.lowStockThreshold)}.`, deepLink: '#inventory', occurredAt: row.updatedAt, referenceId: row.machineId })),
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

function machineStateItem(row) {
  const isError = String(row.status) === 'ERROR';
  return {
    key: `machine:state:${row.id}:${row.status}`,
    source: 'MACHINE',
    severity: isError ? 'CRITICAL' : 'WARNING',
    title: `${machineLabel(row)}: ${isError ? 'ошибка автомата' : 'автомат не в сети'}`,
    message: row.location ? `Точка: ${row.location}. Текущий статус: ${row.status}.` : `Текущий статус: ${row.status}.`,
    deepLink: `#machine-runtime/${row.id}`,
    occurredAt: row.updatedAt,
    referenceId: row.id,
  };
}

function connectivityItems(row) {
  const items = [];
  const label = machineLabel(row);
  if (['SUSPENDED', 'BLOCKED'].includes(String(row.tariffStatus))) items.push({ key: `machine:connectivity:plan:${row.machineId}:${row.tariffStatus}`, source: 'MACHINE', severity: row.tariffStatus === 'BLOCKED' ? 'CRITICAL' : 'WARNING', title: `${label}: мобильная связь ограничена`, message: `Статус SIM/тарифа: ${row.tariffStatus}.`, deepLink: `#machines/${row.machineId}`, occurredAt: row.updatedAt, referenceId: row.machineId });
  const balance = Number(row.currentBalance); const threshold = Number(row.minimumBalanceThreshold);
  if (Number.isFinite(balance) && Number.isFinite(threshold) && balance < threshold) items.push({ key: `machine:connectivity:balance:${row.machineId}`, source: 'MACHINE', severity: balance <= 0 ? 'CRITICAL' : 'WARNING', title: `${label}: низкий баланс SIM`, message: `Баланс ${formatNumber(balance)}, минимальный порог ${formatNumber(threshold)}.`, deepLink: `#machines/${row.machineId}`, occurredAt: row.updatedAt, referenceId: row.machineId });
  const remaining = Number(row.trafficRemainingMb); const limit = Number(row.trafficLimitMb);
  if (Number.isFinite(remaining) && Number.isFinite(limit) && remaining < Math.min(500, limit * 0.1)) items.push({ key: `machine:connectivity:traffic:${row.machineId}`, source: 'MACHINE', severity: remaining <= 0 ? 'CRITICAL' : 'WARNING', title: `${label}: заканчивается мобильный трафик`, message: `Осталось ${formatNumber(remaining)} МБ из ${formatNumber(limit)} МБ.`, deepLink: `#machines/${row.machineId}`, occurredAt: row.updatedAt, referenceId: row.machineId });
  if (!row.lastCheckedAt || Date.now() - new Date(row.lastCheckedAt).getTime() > 7 * 24 * 60 * 60 * 1000) items.push({ key: `machine:connectivity:stale:${row.machineId}`, source: 'MACHINE', severity: 'WARNING', title: `${label}: данные связи устарели`, message: row.lastCheckedAt ? `Последняя проверка связи: ${new Date(row.lastCheckedAt).toISOString()}.` : 'Связь ещё не была подтверждена внешней проверкой.', deepLink: `#machines/${row.machineId}`, occurredAt: row.lastCheckedAt || row.updatedAt, referenceId: row.machineId });
  return items;
}

function machineLabel(row) { return row.machineName || row.name || row.machineCode || `Автомат ${String(row.machineId || row.id || '').slice(0, 8)}`; }
function availableStock(row) { return Number(row.physicalQuantity || 0) - Number(row.activeReservedQuantity || 0); }
function formatNumber(value) { return Number(value || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 }); }
function severityRank(value) { return value === 'CRITICAL' ? 0 : value === 'WARNING' ? 1 : 2; }
function badRequest(code, message) { const error = new Error(message); error.code = code; error.statusCode = 400; return error; }
module.exports = { AdminNotificationCenterService };
