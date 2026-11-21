CREATE TABLE IF NOT EXISTS "FinancialOpsAlert" (
  "id" TEXT PRIMARY KEY,
  "alertKey" TEXT NOT NULL UNIQUE,
  "reportDate" DATE NOT NULL,
  "alertType" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'WARNING',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "actionHref" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "detectedAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "FinancialOpsAlert_reportDate_status_idx"
  ON "FinancialOpsAlert" ("reportDate", "status");

CREATE INDEX IF NOT EXISTS "FinancialOpsAlert_status_detectedAt_idx"
  ON "FinancialOpsAlert" ("status", "detectedAt" DESC);
