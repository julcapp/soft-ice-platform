CREATE TABLE "YooKassaReportExpectation" (
  "id" TEXT PRIMARY KEY,
  "reportDate" DATE NOT NULL,
  "reportType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'EXPECTED',
  "expectedBy" TIMESTAMP(3) NOT NULL,
  "detectedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("reportDate", "reportType")
);

CREATE INDEX "YooKassaReportExpectation_status_idx"
  ON "YooKassaReportExpectation"("status", "reportDate" DESC);
