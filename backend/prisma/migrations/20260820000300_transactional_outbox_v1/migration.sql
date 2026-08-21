CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'RETRY', 'DEAD_LETTER');

CREATE TABLE "TransactionalOutboxEvent" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "eventVersion" INTEGER NOT NULL DEFAULT 1,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "machineId" TEXT,
  "saleFlowId" TEXT,
  "payload" JSONB NOT NULL,
  "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "publishedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "correlationId" TEXT,
  "causationId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  CONSTRAINT "TransactionalOutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransactionalOutboxEvent_eventId_key" ON "TransactionalOutboxEvent"("eventId");
CREATE UNIQUE INDEX "TransactionalOutboxEvent_idempotencyKey_key" ON "TransactionalOutboxEvent"("idempotencyKey");
CREATE INDEX "TransactionalOutboxEvent_status_availableAt_createdAt_idx" ON "TransactionalOutboxEvent"("status", "availableAt", "createdAt");
CREATE INDEX "TransactionalOutboxEvent_organizationId_status_createdAt_idx" ON "TransactionalOutboxEvent"("organizationId", "status", "createdAt");
CREATE INDEX "TransactionalOutboxEvent_machineId_status_createdAt_idx" ON "TransactionalOutboxEvent"("machineId", "status", "createdAt");
CREATE INDEX "TransactionalOutboxEvent_eventType_createdAt_idx" ON "TransactionalOutboxEvent"("eventType", "createdAt");
CREATE INDEX "TransactionalOutboxEvent_saleFlowId_createdAt_idx" ON "TransactionalOutboxEvent"("saleFlowId", "createdAt");
CREATE INDEX "TransactionalOutboxEvent_lockedAt_idx" ON "TransactionalOutboxEvent"("lockedAt");
ALTER TABLE "TransactionalOutboxEvent" ADD CONSTRAINT "TransactionalOutboxEvent_saleFlowId_fkey" FOREIGN KEY ("saleFlowId") REFERENCES "SaleFlow"("flowId") ON DELETE RESTRICT ON UPDATE CASCADE;
