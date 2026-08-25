CREATE TYPE "MachineDispenseStatus" AS ENUM ('CREATED','AUTHORIZED','QUEUED','SENT','ACCEPTED','DISPENSING','DISPENSED','FAILED','TIMED_OUT','CANCELED','RECONCILIATION_REQUIRED');
CREATE TYPE "MachineDispenseOperationType" AS ENUM ('CUSTOMER_SALE','OPERATOR_TEST','MAINTENANCE_TEST');
CREATE TYPE "MachineCallbackInboxStatus" AS ENUM ('RECEIVED','PROCESSING','PROCESSED','FAILED');
CREATE TYPE "MachineReconciliationStatus" AS ENUM ('OPEN','MANUAL_REVIEW','RESOLVED');

CREATE UNIQUE INDEX "InventoryRuntimeReservation_organizationId_reservationId_key" ON "InventoryRuntimeReservation"("organizationId","reservationId");

CREATE TABLE "MachineDispenseAttempt" (
  "id" TEXT NOT NULL, "dispenseAttemptId" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "machineId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL, "orderId" TEXT NOT NULL, "saleFlowId" TEXT NOT NULL, "inventoryReservationId" TEXT NOT NULL,
  "operationType" "MachineDispenseOperationType" NOT NULL DEFAULT 'CUSTOMER_SALE', "commandId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "status" "MachineDispenseStatus" NOT NULL DEFAULT 'CREATED', "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3), "acceptedAt" TIMESTAMP(3), "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "failedAt" TIMESTAMP(3), "timedOutAt" TIMESTAMP(3),
  "provider" TEXT NOT NULL, "providerCommandId" TEXT, "providerEventId" TEXT, "failureCode" TEXT, "failureMessageSafe" TEXT,
  "correlationId" TEXT NOT NULL, "causationId" TEXT, "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MachineDispenseAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MachineDispenseAttempt_dispenseAttemptId_key" ON "MachineDispenseAttempt"("dispenseAttemptId");
CREATE UNIQUE INDEX "MachineDispenseAttempt_commandId_key" ON "MachineDispenseAttempt"("commandId");
CREATE UNIQUE INDEX "MachineDispenseAttempt_organizationId_id_key" ON "MachineDispenseAttempt"("organizationId","id");
CREATE UNIQUE INDEX "MachineDispenseAttempt_organizationId_idempotencyKey_key" ON "MachineDispenseAttempt"("organizationId","idempotencyKey");
CREATE UNIQUE INDEX "MachineDispenseAttempt_organizationId_orderId_saleFlowId_key" ON "MachineDispenseAttempt"("organizationId","orderId","saleFlowId");
CREATE INDEX "MachineDispenseAttempt_machineId_status_idx" ON "MachineDispenseAttempt"("machineId","status");
CREATE INDEX "MachineDispenseAttempt_orderId_idx" ON "MachineDispenseAttempt"("orderId");
CREATE INDEX "MachineDispenseAttempt_saleFlowId_idx" ON "MachineDispenseAttempt"("saleFlowId");
CREATE INDEX "MachineDispenseAttempt_status_createdAt_idx" ON "MachineDispenseAttempt"("status","createdAt");
CREATE INDEX "MachineDispenseAttempt_provider_providerCommandId_idx" ON "MachineDispenseAttempt"("provider","providerCommandId");
CREATE INDEX "MachineDispenseAttempt_correlationId_idx" ON "MachineDispenseAttempt"("correlationId");

CREATE TABLE "MachineCallbackInbox" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "dispenseAttemptId" TEXT, "provider" TEXT NOT NULL, "providerEventId" TEXT NOT NULL,
  "machineId" TEXT NOT NULL, "providerCommandId" TEXT NOT NULL, "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3), "status" "MachineCallbackInboxStatus" NOT NULL DEFAULT 'RECEIVED', "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "payloadSafe" JSONB NOT NULL, "correlationId" TEXT, "lastFailureCode" TEXT, CONSTRAINT "MachineCallbackInbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MachineCallbackInbox_provider_providerEventId_key" ON "MachineCallbackInbox"("provider","providerEventId");
CREATE INDEX "MachineCallbackInbox_organizationId_machineId_receivedAt_idx" ON "MachineCallbackInbox"("organizationId","machineId","receivedAt");
CREATE INDEX "MachineCallbackInbox_status_receivedAt_idx" ON "MachineCallbackInbox"("status","receivedAt");
CREATE INDEX "MachineCallbackInbox_provider_providerCommandId_idx" ON "MachineCallbackInbox"("provider","providerCommandId");

CREATE TABLE "MachineReconciliation" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "dispenseAttemptId" TEXT NOT NULL, "category" TEXT NOT NULL, "fingerprint" TEXT NOT NULL,
  "status" "MachineReconciliationStatus" NOT NULL DEFAULT 'OPEN', "localStatus" TEXT NOT NULL, "providerStatus" TEXT, "detailsSafe" JSONB,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "resolvedAt" TIMESTAMP(3), "resolutionNote" TEXT,
  CONSTRAINT "MachineReconciliation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MachineReconciliation_organizationId_fingerprint_key" ON "MachineReconciliation"("organizationId","fingerprint");
CREATE INDEX "MachineReconciliation_organizationId_status_detectedAt_idx" ON "MachineReconciliation"("organizationId","status","detectedAt");

CREATE TABLE "MachineDispenseAuditEntry" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "dispenseAttemptId" TEXT NOT NULL, "action" TEXT NOT NULL, "actorType" TEXT NOT NULL,
  "actorId" TEXT, "correlationId" TEXT, "detailsSafe" JSONB, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MachineDispenseAuditEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MachineDispenseAuditEntry_organizationId_dispenseAttemptId__idx" ON "MachineDispenseAuditEntry"("organizationId","dispenseAttemptId","occurredAt");

ALTER TABLE "MachineDispenseAttempt" ADD CONSTRAINT "MachineDispenseAttempt_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MachineDispenseAttempt" ADD CONSTRAINT "MachineDispenseAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MachineDispenseAttempt" ADD CONSTRAINT "MachineDispenseAttempt_organizationId_orderId_saleFlowId_fkey" FOREIGN KEY ("organizationId","orderId","saleFlowId") REFERENCES "SaleFlow"("organizationId","orderId","flowId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MachineDispenseAttempt" ADD CONSTRAINT "MachineDispenseAttempt_organizationId_inventoryReservation_fkey" FOREIGN KEY ("organizationId","inventoryReservationId") REFERENCES "InventoryRuntimeReservation"("organizationId","reservationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MachineCallbackInbox" ADD CONSTRAINT "MachineCallbackInbox_organizationId_dispenseAttemptId_fkey" FOREIGN KEY ("organizationId","dispenseAttemptId") REFERENCES "MachineDispenseAttempt"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MachineCallbackInbox" ADD CONSTRAINT "MachineCallbackInbox_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MachineReconciliation" ADD CONSTRAINT "MachineReconciliation_organizationId_dispenseAttemptId_fkey" FOREIGN KEY ("organizationId","dispenseAttemptId") REFERENCES "MachineDispenseAttempt"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MachineDispenseAuditEntry" ADD CONSTRAINT "MachineDispenseAuditEntry_organizationId_dispenseAttemptId_fkey" FOREIGN KEY ("organizationId","dispenseAttemptId") REFERENCES "MachineDispenseAttempt"("organizationId","id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MachineDispenseAttempt" ADD CONSTRAINT "MachineDispenseAttempt_terminal_timestamps_check" CHECK (
  ("status" <> 'DISPENSED' OR "completedAt" IS NOT NULL) AND ("status" <> 'FAILED' OR "failedAt" IS NOT NULL) AND ("status" <> 'TIMED_OUT' OR "timedOutAt" IS NOT NULL)
);
