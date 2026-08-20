CREATE TYPE "SaleFlowState" AS ENUM ('CREATED','AWAITING_PAYMENT','PAID','FULFILLMENT_AUTHORIZED','DISPENSING','COMPLETED','PAYMENT_FAILED','CANCELLED','EXPIRED','FULFILLMENT_FAILED','REFUND_REQUIRED');
CREATE TYPE "SaleFlowRecoveryStatus" AS ENUM ('NONE','SAFE_TO_RESUME','NEEDS_RECONCILIATION','RECOVERING','RECOVERED','MANUAL_REVIEW_REQUIRED');
CREATE TYPE "SaleFlowIdempotencyStatus" AS ENUM ('STARTED','COMPLETED','FAILED');

CREATE TABLE "SaleFlow" (
  "id" TEXT NOT NULL, "flowId" TEXT NOT NULL, "orderId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL, "machineId" TEXT NOT NULL, "organizationId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL, "correlationId" TEXT NOT NULL,
  "currentState" "SaleFlowState" NOT NULL DEFAULT 'CREATED',
  "paymentReference" TEXT, "fulfillmentAuthorizationReference" TEXT,
  "inventoryReservationReference" TEXT, "loyaltyOperationReference" TEXT,
  "refundRequirementReference" TEXT, "completionOperationId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3), "retentionUntil" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 0, "lastProcessedEventId" TEXT,
  "lastErrorCode" TEXT, "lastErrorAt" TIMESTAMP(3),
  "recoveryStatus" "SaleFlowRecoveryStatus" NOT NULL DEFAULT 'NONE', "metadata" JSONB,
  CONSTRAINT "SaleFlow_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SaleFlowIdempotencyKey" (
  "id" TEXT NOT NULL, "flowId" TEXT NOT NULL, "key" TEXT NOT NULL,
  "operationType" TEXT NOT NULL, "source" TEXT NOT NULL, "externalEventId" TEXT,
  "requestHash" TEXT NOT NULL, "status" "SaleFlowIdempotencyStatus" NOT NULL DEFAULT 'STARTED',
  "resultReference" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3),
  CONSTRAINT "SaleFlowIdempotencyKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SaleFlow_flowId_key" ON "SaleFlow"("flowId");
CREATE UNIQUE INDEX "SaleFlow_orderId_key" ON "SaleFlow"("orderId");
CREATE UNIQUE INDEX "SaleFlow_correlationId_key" ON "SaleFlow"("correlationId");
CREATE UNIQUE INDEX "SaleFlow_completionOperationId_key" ON "SaleFlow"("completionOperationId");
CREATE INDEX "SaleFlow_orderId_idx" ON "SaleFlow"("orderId");
CREATE INDEX "SaleFlow_correlationId_idx" ON "SaleFlow"("correlationId");
CREATE INDEX "SaleFlow_currentState_idx" ON "SaleFlow"("currentState");
CREATE INDEX "SaleFlow_recoveryStatus_idx" ON "SaleFlow"("recoveryStatus");
CREATE INDEX "SaleFlow_machineId_idx" ON "SaleFlow"("machineId");
CREATE INDEX "SaleFlow_customerId_idx" ON "SaleFlow"("customerId");
CREATE INDEX "SaleFlow_organizationId_idx" ON "SaleFlow"("organizationId");
CREATE INDEX "SaleFlow_updatedAt_idx" ON "SaleFlow"("updatedAt");
CREATE UNIQUE INDEX "SaleFlowIdempotencyKey_key_key" ON "SaleFlowIdempotencyKey"("key");
CREATE INDEX "SaleFlowIdempotencyKey_flowId_idx" ON "SaleFlowIdempotencyKey"("flowId");
CREATE INDEX "SaleFlowIdempotencyKey_externalEventId_idx" ON "SaleFlowIdempotencyKey"("externalEventId");
CREATE INDEX "SaleFlowIdempotencyKey_operationType_idx" ON "SaleFlowIdempotencyKey"("operationType");
CREATE INDEX "SaleFlowIdempotencyKey_expiresAt_idx" ON "SaleFlowIdempotencyKey"("expiresAt");
