const { randomUUID } = require('crypto');

class FinancialOpsAlertService {
  constructor({ prisma, clock = () => new Date() }) {
    if (!prisma) throw new Error('prisma is required');
    this.prisma = prisma;
    this.clock = clock;
  }

  async syncForDay(day) {
    if (!day?.reportDate) throw new Error('financial day is required');
    const now = this.clock();
    const desired = day.status === 'CLOSED' ? [] : buildAlerts(day);
    const desiredKeys = new Set(desired.map((item) => item.alertKey));

    for (const item of desired) await this.#upsert(item, now);

    const existing = await this.prisma.$queryRawUnsafe(
      `SELECT "id","alertKey" FROM "FinancialOpsAlert" WHERE "reportDate"=$1::date AND "status"='OPEN'`,
      day.reportDate,
    );
    for (const row of existing) {
      if (!desiredKeys.has(row.alertKey)) {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "FinancialOpsAlert" SET "status"='RESOLVED',"resolvedAt"=$2,"updatedAt"=$2 WHERE "id"=$1`,
          row.id, now,
        );
      }
    }
    return { createdOrRefreshed: desired.length, open: desired.length, resolved: Math.max(existing.length - desired.length, 0) };
  }

  async listForDay(reportDate) {
    return this.prisma.$queryRawUnsafe(
      `SELECT "id","alertKey","reportDate","alertType","severity","title","body","actionHref","status","detectedAt","lastSeenAt","resolvedAt"
       FROM "FinancialOpsAlert" WHERE "reportDate"=$1::date ORDER BY CASE "status" WHEN 'OPEN' THEN 0 ELSE 1 END, "detectedAt" DESC`,
      reportDate,
    );
  }

  async #upsert(item, now) {
    const rows = await this.prisma.$queryRawUnsafe('SELECT "id" FROM "FinancialOpsAlert" WHERE "alertKey"=$1 LIMIT 1', item.alertKey);
    if (rows[0]) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "FinancialOpsAlert" SET "severity"=$2,"title"=$3,"body"=$4,"actionHref"=$5,"status"='OPEN',"lastSeenAt"=$6,"resolvedAt"=NULL,"updatedAt"=$6 WHERE "id"=$1`,
        rows[0].id, item.severity, item.title, item.body, item.actionHref, now,
      );
      return;
    }
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "FinancialOpsAlert" ("id","alertKey","reportDate","alertType","severity","title","body","actionHref","status","detectedAt","lastSeenAt","createdAt","updatedAt") VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,'OPEN',$9,$9,$9,$9)`,
      randomUUID(), item.alertKey, item.reportDate, item.alertType, item.severity, item.title, item.body, item.actionHref, now,
    );
  }
}

function buildAlerts(day) {
  const alerts = [];
  const href = `#business-analytics?financialDate=${day.reportDate}`;
  if (!day.checks?.paymentsReportReceived) alerts.push(alert(day, 'MISSING_PAYMENTS_REPORT', 'CRITICAL', 'Не получен реестр платежей ЮKassa', `За ${day.reportDate} реестр платежей не получен к контрольному сроку.`, href));
  if (!day.checks?.refundsReportReceived) alerts.push(alert(day, 'MISSING_REFUNDS_REPORT', 'WARNING', 'Не получен реестр возвратов ЮKassa', `За ${day.reportDate} реестр возвратов не получен к контрольному сроку.`, href));
  if (day.checks?.paymentsReportReceived && day.reports?.payments?.reconciliationStatus !== 'RECONCILED') alerts.push(alert(day, 'PAYMENTS_RECONCILIATION_ISSUE', 'CRITICAL', 'Есть расхождения в реестре платежей', `Финансовый день ${day.reportDate}: платежный реестр требует сверки.`, href));
  if (day.checks?.refundsReportReceived && day.reports?.refunds?.reconciliationStatus !== 'RECONCILED') alerts.push(alert(day, 'REFUNDS_RECONCILIATION_ISSUE', 'WARNING', 'Есть расхождения в реестре возвратов', `Финансовый день ${day.reportDate}: реестр возвратов требует сверки.`, href));
  if (Number(day.reconciliation?.openIssues || 0) > 0) alerts.push(alert(day, 'OPEN_RECONCILIATION_ISSUES', Number(day.reconciliation?.criticalIssues || 0) > 0 ? 'CRITICAL' : 'WARNING', 'Открытые финансовые расхождения', `За ${day.reportDate} открыто расхождений: ${day.reconciliation.openIssues}.`, href));
  return alerts;
}
function alert(day, type, severity, title, body, actionHref) {
  return { alertKey: `yookassa:${day.reportDate}:${type}`, reportDate: day.reportDate, alertType: type, severity, title, body, actionHref };
}

module.exports = { FinancialOpsAlertService, buildAlerts };
