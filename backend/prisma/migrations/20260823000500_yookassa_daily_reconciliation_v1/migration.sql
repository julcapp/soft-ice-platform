CREATE TABLE "YooKassaDailyReport" (
  "id" TEXT PRIMARY KEY,
  "shopId" TEXT,
  "reportDate" DATE NOT NULL,
  "reportType" TEXT NOT NULL,
  "fileName" TEXT,
  "fileHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'IMPORTED',
  "rowsTotal" INTEGER NOT NULL DEFAULT 0,
  "rowsMatched" INTEGER NOT NULL DEFAULT 0,
  "rowsMissingLocal" INTEGER NOT NULL DEFAULT 0,
  "rowsMismatch" INTEGER NOT NULL DEFAULT 0,
  "grossAmountRub" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "netAmountRub" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "commissionRub" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "commissionVatRub" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "refundAmountRub" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "importedBy" TEXT,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reconciledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("fileHash")
);

CREATE INDEX "YooKassaDailyReport_date_type_idx" ON "YooKassaDailyReport"("reportDate", "reportType");

CREATE TABLE "YooKassaReconciliationIssue" (
  "id" TEXT PRIMARY KEY,
  "reportId" TEXT NOT NULL REFERENCES "YooKassaDailyReport"("id") ON DELETE CASCADE,
  "reportType" TEXT NOT NULL,
  "providerOperationId" TEXT,
  "providerPaymentId" TEXT,
  "issueType" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'WARNING',
  "expected" JSONB,
  "actual" JSONB,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "YooKassaReconciliationIssue_status_idx" ON "YooKassaReconciliationIssue"("status", "createdAt");
CREATE INDEX "YooKassaReconciliationIssue_provider_payment_idx" ON "YooKassaReconciliationIssue"("providerPaymentId");
