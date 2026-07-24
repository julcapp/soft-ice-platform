CREATE TYPE "MaintenancePlanType" AS ENUM ('PREVENTIVE', 'CORRECTIVE');
CREATE TYPE "MaintenanceSessionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "MaintenanceCheckStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'NOT_APPLICABLE');

CREATE TABLE "MaintenancePlanV1" (
  "id" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "type" "MaintenancePlanType" NOT NULL,
  "version" INTEGER NOT NULL, "machineIds" JSONB NOT NULL, "intervalDays" INTEGER,
  "checklistTemplate" JSONB NOT NULL, "requiredPhotoCount" INTEGER NOT NULL DEFAULT 0,
  "requireTestDispense" BOOLEAN NOT NULL DEFAULT true, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaintenancePlanV1_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MaintenancePlanV1_code_version_key" ON "MaintenancePlanV1"("code", "version");
CREATE INDEX "MaintenancePlanV1_active_type_idx" ON "MaintenancePlanV1"("active", "type");

CREATE TABLE "MaintenanceSessionV1" (
  "id" TEXT NOT NULL, "machineId" TEXT NOT NULL, "machineCode" TEXT NOT NULL, "planId" TEXT,
  "type" "MaintenancePlanType" NOT NULL, "status" "MaintenanceSessionStatus" NOT NULL DEFAULT 'OPEN',
  "operatorId" TEXT NOT NULL, "issue" TEXT, "summary" TEXT, "runtimeSessionId" TEXT,
  "requiredPhotoCount" INTEGER NOT NULL DEFAULT 0, "requireTestDispense" BOOLEAN NOT NULL DEFAULT true,
  "startedAt" TIMESTAMP(3) NOT NULL, "submittedAt" TIMESTAMP(3), "approvedAt" TIMESTAMP(3),
  "approvedBy" TEXT, "approvalNote" TEXT, "rejectedAt" TIMESTAMP(3), "rejectedBy" TEXT,
  "rejectionReason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaintenanceSessionV1_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MaintenanceSessionV1_machineId_status_startedAt_idx" ON "MaintenanceSessionV1"("machineId", "status", "startedAt");
CREATE INDEX "MaintenanceSessionV1_operatorId_status_idx" ON "MaintenanceSessionV1"("operatorId", "status");
CREATE INDEX "MaintenanceSessionV1_status_submittedAt_idx" ON "MaintenanceSessionV1"("status", "submittedAt");
ALTER TABLE "MaintenanceSessionV1" ADD CONSTRAINT "MaintenanceSessionV1_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MaintenancePlanV1"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MaintenanceChecklistResultV1" (
  "id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "itemCode" TEXT NOT NULL, "label" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true, "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
  "status" "MaintenanceCheckStatus" NOT NULL DEFAULT 'PENDING', "note" TEXT,
  "completedAt" TIMESTAMP(3), "completedBy" TEXT,
  CONSTRAINT "MaintenanceChecklistResultV1_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MaintenanceChecklistResultV1_sessionId_itemCode_key" ON "MaintenanceChecklistResultV1"("sessionId", "itemCode");
ALTER TABLE "MaintenanceChecklistResultV1" ADD CONSTRAINT "MaintenanceChecklistResultV1_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MaintenanceSessionV1"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "MaintenancePhotoEvidenceV1" (
  "id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "storageKey" TEXT NOT NULL, "contentType" TEXT NOT NULL,
  "checksumSha256" TEXT NOT NULL, "capturedAt" TIMESTAMP(3) NOT NULL, "attachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "operatorId" TEXT NOT NULL, CONSTRAINT "MaintenancePhotoEvidenceV1_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MaintenancePhotoEvidenceV1_storageKey_key" ON "MaintenancePhotoEvidenceV1"("storageKey");
CREATE INDEX "MaintenancePhotoEvidenceV1_sessionId_capturedAt_idx" ON "MaintenancePhotoEvidenceV1"("sessionId", "capturedAt");
ALTER TABLE "MaintenancePhotoEvidenceV1" ADD CONSTRAINT "MaintenancePhotoEvidenceV1_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MaintenanceSessionV1"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "MaintenanceConsumableReplacementV1" (
  "id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "itemId" TEXT NOT NULL, "locationId" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL, "reason" TEXT NOT NULL, "lotReference" TEXT, "inventoryMovementId" TEXT,
  "replacedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaintenanceConsumableReplacementV1_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MaintenanceConsumableReplacementV1_sessionId_replacedAt_idx" ON "MaintenanceConsumableReplacementV1"("sessionId", "replacedAt");
CREATE INDEX "MaintenanceConsumableReplacementV1_inventoryMovementId_idx" ON "MaintenanceConsumableReplacementV1"("inventoryMovementId");
ALTER TABLE "MaintenanceConsumableReplacementV1" ADD CONSTRAINT "MaintenanceConsumableReplacementV1_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MaintenanceSessionV1"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "MaintenanceTestDispenseV1" (
  "id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "status" "TestRunStatus" NOT NULL,
  "dispenseReference" TEXT NOT NULL, "notes" TEXT, "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaintenanceTestDispenseV1_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MaintenanceTestDispenseV1_sessionId_performedAt_idx" ON "MaintenanceTestDispenseV1"("sessionId", "performedAt");
ALTER TABLE "MaintenanceTestDispenseV1" ADD CONSTRAINT "MaintenanceTestDispenseV1_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MaintenanceSessionV1"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "MaintenanceAuditEntryV1" (
  "id" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "eventId" TEXT NOT NULL, "eventType" TEXT NOT NULL,
  "actorId" TEXT NOT NULL, "actorRoles" JSONB NOT NULL, "correlationId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "payload" JSONB NOT NULL, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaintenanceAuditEntryV1_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MaintenanceAuditEntryV1_eventId_key" ON "MaintenanceAuditEntryV1"("eventId");
CREATE INDEX "MaintenanceAuditEntryV1_sessionId_occurredAt_idx" ON "MaintenanceAuditEntryV1"("sessionId", "occurredAt");
ALTER TABLE "MaintenanceAuditEntryV1" ADD CONSTRAINT "MaintenanceAuditEntryV1_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MaintenanceSessionV1"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
