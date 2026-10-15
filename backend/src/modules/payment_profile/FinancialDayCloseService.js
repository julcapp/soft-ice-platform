class FinancialDayCloseService {
  constructor({ prisma }) {
    if (!prisma) throw new Error('prisma is required');
    this.prisma = prisma;
  }

  async getDay(reportDate) {
    const date = normalizeDate(reportDate);
    const [reports, expectations, issues, alerts] = await Promise.all([
      this.prisma.$queryRawUnsafe(
        `SELECT "id","shopId","reportDate","reportType","fileName","status","rowsTotal","rowsMatched","rowsMissingLocal","rowsMismatch","grossAmountRub","netAmountRub","commissionRub","commissionVatRub","refundAmountRub","importedAt","reconciledAt"
         FROM "YooKassaDailyReport" WHERE "reportDate"=$1::date ORDER BY "reportType","importedAt" DESC`, date,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT "reportType","status","expectedBy","detectedAt","resolvedAt","lastCheckedAt"
         FROM "YooKassaReportExpectation" WHERE "reportDate"=$1::date ORDER BY "reportType"`, date,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT i."id",i."reportType",i."providerOperationId",i."providerPaymentId",i."issueType",i."severity",i."status",i."createdAt",
                r."fileName"
         FROM "YooKassaReconciliationIssue" i
         JOIN "YooKassaDailyReport" r ON r."id"=i."reportId"
         WHERE r."reportDate"=$1::date AND i."status"='OPEN'
         ORDER BY CASE i."severity" WHEN 'CRITICAL' THEN 0 ELSE 1 END, i."createdAt" DESC`, date,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT "id","alertType","severity","title","body","actionHref","status","detectedAt","lastSeenAt","resolvedAt"
         FROM "FinancialOpsAlert" WHERE "reportDate"=$1::date ORDER BY CASE "status" WHEN 'OPEN' THEN 0 ELSE 1 END, "detectedAt" DESC`, date,
      ).catch(() => []),
    ]);

    const latestByType = {};
    for (const row of reports) if (!latestByType[row.reportType]) latestByType[row.reportType] = row;
    const expectationByType = Object.fromEntries(expectations.map((row) => [row.reportType, row]));
    const payment = latestByType.PAYMENTS || null;
    const refund = latestByType.REFUNDS || null;
    const paymentExpectation = expectationByType.PAYMENTS || null;
    const refundExpectation = expectationByType.REFUNDS || null;

    const paymentsReceived = Boolean(payment);
    const refundsReceived = Boolean(refund);
    const expectationsReceived = paymentExpectation?.status === 'RECEIVED' && refundExpectation?.status === 'RECEIVED';
    const reportsClean = [payment, refund].every((row) => row && row.status === 'RECONCILED');
    const closed = paymentsReceived && refundsReceived && expectationsReceived && reportsClean && issues.length === 0;

    const gross = number(payment?.grossAmountRub);
    const net = number(payment?.netAmountRub);
    const commission = number(payment?.commissionRub);
    const commissionVat = number(payment?.commissionVatRub);
    const refunds = number(refund?.refundAmountRub);

    return {
      reportDate: date,
      status: closed ? 'CLOSED' : 'REVIEW_REQUIRED',
      statusLabel: closed ? 'ЗАКРЫТ' : 'ТРЕБУЕТ ПРОВЕРКИ',
      reports: {
        payments: summarizeReport(payment, paymentExpectation),
        refunds: summarizeReport(refund, refundExpectation),
      },
      totals: {
        grossPaymentsRub: gross,
        processorCommissionRub: commission,
        processorCommissionVatRub: commissionVat,
        processorCostTotalRub: round(commission + commissionVat),
        netSettlementRub: net,
        refundsRub: refunds,
        netCashAfterRefundsRub: round(net - refunds),
      },
      reconciliation: {
        openIssues: issues.length,
        criticalIssues: issues.filter((item) => item.severity === 'CRITICAL').length,
        warningIssues: issues.filter((item) => item.severity !== 'CRITICAL').length,
        issues,
      },
      operationsAlerts: {
        open: alerts.filter((item) => item.status === 'OPEN'),
        resolved: alerts.filter((item) => item.status === 'RESOLVED'),
      },
      checks: {
        paymentsReportReceived: paymentsReceived,
        refundsReportReceived: refundsReceived,
        expectationsReceived,
        reportsReconciledWithoutIssues: reportsClean,
        noOpenIssues: issues.length === 0,
      },
    };
  }
}

function summarizeReport(report, expectation) {
  return {
    received: Boolean(report),
    expectationStatus: expectation?.status || 'UNKNOWN',
    expectedBy: expectation?.expectedBy || null,
    receivedAt: report?.importedAt || null,
    fileName: report?.fileName || null,
    reconciliationStatus: report?.status || null,
    rowsTotal: Number(report?.rowsTotal || 0),
    rowsMatched: Number(report?.rowsMatched || 0),
    rowsMissingLocal: Number(report?.rowsMissingLocal || 0),
    rowsMismatch: Number(report?.rowsMismatch || 0),
    shopId: report?.shopId || null,
  };
}
function number(value) { return Number(value || 0); }
function round(value) { return Number(Number(value || 0).toFixed(2)); }
function normalizeDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
    const error = new Error('reportDate must use YYYY-MM-DD');
    error.code = 'FINANCIAL_DAY_DATE_INVALID'; error.statusCode = 400; throw error;
  }
  return String(value);
}
module.exports = { FinancialDayCloseService };
