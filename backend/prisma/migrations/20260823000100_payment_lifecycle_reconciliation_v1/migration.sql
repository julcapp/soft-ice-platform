-- Legacy rows are migrated only from an explicit, validated mapping embedded by
-- an operator in metadata.paymentLifecycleMigration. No tenant/order inference is allowed.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "Payment" p
    LEFT JOIN "Order" o ON o.id=p.metadata->'paymentLifecycleMigration'->>'orderId'
    LEFT JOIN "SaleFlow" sf ON sf."orderId"=p.metadata->'paymentLifecycleMigration'->>'orderId'
      AND sf."organizationId"=p.metadata->'paymentLifecycleMigration'->>'organizationId'
    WHERE NULLIF(p.metadata->'paymentLifecycleMigration'->>'organizationId','') IS NULL
      OR NULLIF(p.metadata->'paymentLifecycleMigration'->>'orderId','') IS NULL
      OR o.id IS NULL OR sf."flowId" IS NULL
      OR (p."customerId" IS NOT NULL AND o."customerId" IS DISTINCT FROM p."customerId")
  ) THEN RAISE EXCEPTION 'PAYMENT_LEGACY_ROWS_REQUIRE_EXPLICIT_VALID_TENANT_AND_ORDER_MAPPING'; END IF;
  IF EXISTS (SELECT 1 FROM "Payment" GROUP BY metadata->'paymentLifecycleMigration'->>'orderId' HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'PAYMENT_LEGACY_MAPPING_DUPLICATE_ORDER';
  END IF;
END $$;

CREATE TYPE "PaymentStatus" AS ENUM ('CREATED','PENDING','AUTHORIZED','SUCCEEDED','FAILED','CANCELED','REFUND_PENDING','REFUNDED');
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED','PENDING','SUCCEEDED','FAILED');
CREATE TYPE "PaymentInboxStatus" AS ENUM ('RECEIVED','PROCESSING','PROCESSED','FAILED');
CREATE TYPE "PaymentReconciliationStatus" AS ENUM ('OPEN','MANUAL_REVIEW','RESOLVED');

DROP INDEX IF EXISTS "Payment_providerPaymentId_key";
ALTER TABLE "Payment"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "orderId" TEXT,
  ADD COLUMN "saleFlowId" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "requestFingerprint" TEXT,
  ADD COLUMN "amount" DECIMAL(18,2),
  ADD COLUMN "lifecycleStatus" "PaymentStatus",
  ADD COLUMN "pendingAt" TIMESTAMP(3),
  ADD COLUMN "authorizedAt" TIMESTAMP(3),
  ADD COLUMN "succeededAt" TIMESTAMP(3),
  ADD COLUMN "failedAt" TIMESTAMP(3),
  ADD COLUMN "refundedAt" TIMESTAMP(3),
  ALTER COLUMN "provider" DROP DEFAULT;

UPDATE "Payment" p SET
  "organizationId" = p.metadata->'paymentLifecycleMigration'->>'organizationId',
  "orderId" = p.metadata->'paymentLifecycleMigration'->>'orderId',
  "idempotencyKey" = COALESCE(NULLIF(p.metadata->'paymentLifecycleMigration'->>'idempotencyKey',''), 'legacy:' || p.id),
  "requestFingerprint" = 'legacy:' || p.id,
  "amount" = ROUND(p."amountRub"::numeric, 2),
  "lifecycleStatus" = CASE lower(p.status)
    WHEN 'pending' THEN 'PENDING'::"PaymentStatus"
    WHEN 'succeeded' THEN 'SUCCEEDED'::"PaymentStatus"
    WHEN 'confirmed' THEN 'SUCCEEDED'::"PaymentStatus"
    WHEN 'failed' THEN 'FAILED'::"PaymentStatus"
    WHEN 'canceled' THEN 'CANCELED'::"PaymentStatus"
    WHEN 'cancelled' THEN 'CANCELED'::"PaymentStatus"
    ELSE 'CREATED'::"PaymentStatus" END;

UPDATE "Payment" SET
  "pendingAt" = CASE WHEN "lifecycleStatus" IN ('PENDING','AUTHORIZED','SUCCEEDED') THEN "createdAt" ELSE NULL END,
  "succeededAt" = CASE WHEN "lifecycleStatus"='SUCCEEDED' THEN COALESCE("confirmedAt","updatedAt","createdAt") ELSE NULL END,
  "failedAt" = CASE WHEN "lifecycleStatus"='FAILED' THEN COALESCE("updatedAt","createdAt") ELSE NULL END,
  "canceledAt" = CASE WHEN "lifecycleStatus"='CANCELED' THEN COALESCE("updatedAt","createdAt") ELSE NULL END;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "Payment" p
    LEFT JOIN "Order" o ON o.id=p."orderId"
    LEFT JOIN "SaleFlow" sf ON sf."orderId"=p."orderId" AND sf."organizationId"=p."organizationId"
    WHERE p."organizationId" IS NULL OR p."orderId" IS NULL OR o.id IS NULL OR sf."flowId" IS NULL
      OR (p."customerId" IS NOT NULL AND o."customerId" IS DISTINCT FROM p."customerId")
  ) THEN RAISE EXCEPTION 'PAYMENT_LEGACY_ROWS_REQUIRE_EXPLICIT_VALID_TENANT_AND_ORDER_MAPPING'; END IF;
  IF EXISTS (SELECT 1 FROM "Payment" GROUP BY "orderId" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'PAYMENT_LEGACY_MAPPING_DUPLICATE_ORDER';
  END IF;
END $$;

UPDATE "Payment" p SET "saleFlowId"=(SELECT sf."flowId" FROM "SaleFlow" sf WHERE sf."orderId"=p."orderId" AND sf."organizationId"=p."organizationId" ORDER BY sf."flowId" LIMIT 1);
ALTER TABLE "Payment"
  DROP COLUMN "amountRub", DROP COLUMN "confirmationUrl", DROP COLUMN "returnUrl", DROP COLUMN "confirmedAt", DROP COLUMN "status";
ALTER TABLE "Payment" RENAME COLUMN "lifecycleStatus" TO "status";
ALTER TABLE "Payment" ALTER COLUMN "organizationId" SET NOT NULL, ALTER COLUMN "orderId" SET NOT NULL, ALTER COLUMN "saleFlowId" SET NOT NULL, ALTER COLUMN "idempotencyKey" SET NOT NULL, ALTER COLUMN "requestFingerprint" SET NOT NULL, ALTER COLUMN "amount" SET NOT NULL, ALTER COLUMN "status" SET NOT NULL, ALTER COLUMN "status" SET DEFAULT 'CREATED';
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_status_temporal_consistent" CHECK (
  ("status"='CREATED' AND "pendingAt" IS NULL AND "authorizedAt" IS NULL AND "succeededAt" IS NULL AND "failedAt" IS NULL AND "canceledAt" IS NULL AND "refundedAt" IS NULL) OR
  ("status"='PENDING' AND "pendingAt" IS NOT NULL AND "succeededAt" IS NULL AND "failedAt" IS NULL AND "canceledAt" IS NULL AND "refundedAt" IS NULL) OR
  ("status"='AUTHORIZED' AND "pendingAt" IS NOT NULL AND "authorizedAt" IS NOT NULL AND "succeededAt" IS NULL AND "failedAt" IS NULL AND "canceledAt" IS NULL AND "refundedAt" IS NULL) OR
  ("status" IN ('SUCCEEDED','REFUND_PENDING') AND "succeededAt" IS NOT NULL AND "failedAt" IS NULL AND "canceledAt" IS NULL AND "refundedAt" IS NULL) OR
  ("status"='FAILED' AND "failedAt" IS NOT NULL AND "succeededAt" IS NULL AND "canceledAt" IS NULL AND "refundedAt" IS NULL) OR
  ("status"='CANCELED' AND "canceledAt" IS NOT NULL AND "succeededAt" IS NULL AND "failedAt" IS NULL AND "refundedAt" IS NULL) OR
  ("status"='REFUNDED' AND "succeededAt" IS NOT NULL AND "refundedAt" IS NOT NULL AND "failedAt" IS NULL AND "canceledAt" IS NULL)
);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "SaleFlow_organizationId_orderId_flowId_key" ON "SaleFlow"("organizationId","orderId","flowId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_orderId_saleFlowId_fkey" FOREIGN KEY ("organizationId","orderId","saleFlowId") REFERENCES "SaleFlow"("organizationId","orderId","flowId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");
CREATE UNIQUE INDEX "Payment_organizationId_id_key" ON "Payment"("organizationId","id");
CREATE UNIQUE INDEX "Payment_organizationId_orderId_saleFlowId_key" ON "Payment"("organizationId","orderId","saleFlowId");
CREATE UNIQUE INDEX "Payment_organizationId_idempotencyKey_key" ON "Payment"("organizationId","idempotencyKey");
CREATE UNIQUE INDEX "Payment_organizationId_provider_providerPaymentId_key" ON "Payment"("organizationId","provider","providerPaymentId");
CREATE UNIQUE INDEX "Payment_provider_providerPaymentId_key" ON "Payment"("provider","providerPaymentId");
CREATE INDEX "Payment_organizationId_status_createdAt_idx" ON "Payment"("organizationId","status","createdAt");
CREATE INDEX "Payment_saleFlowId_idx" ON "Payment"("saleFlowId");
CREATE INDEX "Payment_provider_status_updatedAt_idx" ON "Payment"("provider","status","updatedAt");

CREATE TABLE "PaymentOperation" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "paymentId" TEXT NOT NULL,
  "operationType" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
  "resultReference" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
  CONSTRAINT "PaymentOperation_organizationId_paymentId_fkey" FOREIGN KEY ("organizationId","paymentId") REFERENCES "Payment"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PaymentOperation_organizationId_operationType_idempotencyKe_key" ON "PaymentOperation"("organizationId","operationType","idempotencyKey");
CREATE INDEX "PaymentOperation_organizationId_paymentId_createdAt_idx" ON "PaymentOperation"("organizationId","paymentId","createdAt");

CREATE TABLE "PaymentRefund" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "paymentId" TEXT NOT NULL, "providerRefundId" TEXT,
  "idempotencyKey" TEXT NOT NULL, "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED', "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'RUB', "reason" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "pendingAt" TIMESTAMP(3),
  "succeededAt" TIMESTAMP(3), "failedAt" TIMESTAMP(3), "failureCode" TEXT,
  CONSTRAINT "PaymentRefund_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "PaymentRefund_status_temporal_consistent" CHECK (
    ("status"='REQUESTED' AND "pendingAt" IS NULL AND "succeededAt" IS NULL AND "failedAt" IS NULL) OR
    ("status"='PENDING' AND "pendingAt" IS NOT NULL AND "succeededAt" IS NULL AND "failedAt" IS NULL) OR
    ("status"='SUCCEEDED' AND "succeededAt" IS NOT NULL AND "failedAt" IS NULL) OR
    ("status"='FAILED' AND "failedAt" IS NOT NULL AND "succeededAt" IS NULL)
  ),
  CONSTRAINT "PaymentRefund_organizationId_paymentId_fkey" FOREIGN KEY ("organizationId","paymentId") REFERENCES "Payment"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PaymentRefund_organizationId_idempotencyKey_key" ON "PaymentRefund"("organizationId","idempotencyKey");
CREATE UNIQUE INDEX "PaymentRefund_organizationId_providerRefundId_key" ON "PaymentRefund"("organizationId","providerRefundId");
CREATE INDEX "PaymentRefund_organizationId_paymentId_status_idx" ON "PaymentRefund"("organizationId","paymentId","status");

CREATE TABLE "PaymentProviderInbox" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "paymentId" TEXT, "provider" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL, "eventType" TEXT NOT NULL, "payload" JSONB NOT NULL,
  "status" "PaymentInboxStatus" NOT NULL DEFAULT 'RECEIVED', "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3), "attemptCount" INTEGER NOT NULL DEFAULT 0, "maxAttempts" INTEGER NOT NULL DEFAULT 10, "lastFailureCode" TEXT, "nextAttemptAt" TIMESTAMP(3), "lockedAt" TIMESTAMP(3), "lockedBy" TEXT,
  CONSTRAINT "PaymentProviderInbox_organizationId_paymentId_fkey" FOREIGN KEY ("organizationId","paymentId") REFERENCES "Payment"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PaymentProviderInbox_provider_providerEventId_key" ON "PaymentProviderInbox"("provider","providerEventId");
CREATE UNIQUE INDEX "PaymentProviderInbox_organizationId_id_key" ON "PaymentProviderInbox"("organizationId","id");
CREATE INDEX "PaymentProviderInbox_status_nextAttemptAt_receivedAt_idx" ON "PaymentProviderInbox"("status","nextAttemptAt","receivedAt");
CREATE INDEX "PaymentProviderInbox_organizationId_paymentId_receivedAt_idx" ON "PaymentProviderInbox"("organizationId","paymentId","receivedAt");

CREATE TABLE "PaymentReconciliation" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "paymentId" TEXT, "provider" TEXT NOT NULL,
  "providerPaymentId" TEXT, "category" TEXT NOT NULL, "fingerprint" TEXT NOT NULL, "status" "PaymentReconciliationStatus" NOT NULL DEFAULT 'OPEN',
  "localStatus" TEXT, "providerStatus" TEXT, "localAmount" DECIMAL(18,2), "providerAmount" DECIMAL(18,2),
  "details" JSONB, "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "resolvedAt" TIMESTAMP(3), "resolutionNote" TEXT,
  CONSTRAINT "PaymentReconciliation_organizationId_paymentId_fkey" FOREIGN KEY ("organizationId","paymentId") REFERENCES "Payment"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PaymentReconciliation_organizationId_status_detectedAt_idx" ON "PaymentReconciliation"("organizationId","status","detectedAt");
CREATE INDEX "PaymentReconciliation_provider_providerPaymentId_idx" ON "PaymentReconciliation"("provider","providerPaymentId");
CREATE UNIQUE INDEX "PaymentReconciliation_organizationId_fingerprint_key" ON "PaymentReconciliation"("organizationId","fingerprint");

CREATE TABLE "PaymentAuditEntry" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "paymentId" TEXT NOT NULL, "action" TEXT NOT NULL,
  "actorType" TEXT NOT NULL, "actorId" TEXT, "correlationId" TEXT, "details" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAuditEntry_organizationId_paymentId_fkey" FOREIGN KEY ("organizationId","paymentId") REFERENCES "Payment"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PaymentAuditEntry_organizationId_paymentId_occurredAt_idx" ON "PaymentAuditEntry"("organizationId","paymentId","occurredAt");
