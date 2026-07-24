CREATE TABLE "EventRecord" (
  "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "organizationId" TEXT,
  "eventId" TEXT NOT NULL UNIQUE, "eventCode" TEXT NOT NULL, "eventVersion" INTEGER NOT NULL,
  "category" TEXT NOT NULL, "severity" TEXT NOT NULL, "sourceDomain" TEXT NOT NULL,
  "sourceService" TEXT, "sourceEventId" TEXT, "subjectType" TEXT NOT NULL, "subjectId" TEXT NOT NULL,
  "subjectDisplayName" TEXT, "actorType" TEXT, "actorId" TEXT, "actorDisplayName" TEXT,
  "machineId" TEXT, "customerId" TEXT, "orderId" TEXT, "paymentId" TEXT,
  "maintenanceRequestId" TEXT, "inventoryOperationId" TEXT, "cameraId" TEXT, "videoIncidentId" TEXT,
  "correlationId" TEXT, "causationId" TEXT, "traceId" TEXT, "title" TEXT NOT NULL, "summary" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL, "receivedAt" TIMESTAMP(3) NOT NULL, "recordedAt" TIMESTAMP(3) NOT NULL,
  "acknowledgementRequired" BOOLEAN NOT NULL DEFAULT false, "payload" JSONB NOT NULL, "metadata" JSONB,
  "retentionUntil" TIMESTAMP(3), "retentionReason" TEXT, "legalHold" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "EventRecord_source_unique" ON "EventRecord" ("sourceDomain", "sourceEventId", "eventCode", "eventVersion");
CREATE INDEX "EventRecord_tenant_occurred_idx" ON "EventRecord" ("tenantId", "occurredAt");
CREATE INDEX "EventRecord_org_occurred_idx" ON "EventRecord" ("organizationId", "occurredAt");
CREATE INDEX "EventRecord_code_occurred_idx" ON "EventRecord" ("eventCode", "occurredAt");
CREATE INDEX "EventRecord_category_severity_occurred_idx" ON "EventRecord" ("category", "severity", "occurredAt");
CREATE INDEX "EventRecord_subject_occurred_idx" ON "EventRecord" ("subjectType", "subjectId", "occurredAt");
CREATE INDEX "EventRecord_machine_occurred_idx" ON "EventRecord" ("machineId", "occurredAt");
CREATE INDEX "EventRecord_customer_occurred_idx" ON "EventRecord" ("customerId", "occurredAt");
CREATE INDEX "EventRecord_correlation_idx" ON "EventRecord" ("correlationId");
CREATE INDEX "EventRecord_retention_idx" ON "EventRecord" ("retentionUntil");
CREATE INDEX "EventRecord_hold_idx" ON "EventRecord" ("legalHold");

CREATE TABLE "EventTypeDefinition" ("id" TEXT PRIMARY KEY, "eventCode" TEXT NOT NULL, "version" INTEGER NOT NULL, "titleTemplate" TEXT NOT NULL, "summaryTemplate" TEXT NOT NULL, "category" TEXT NOT NULL, "defaultSeverity" TEXT NOT NULL, "subjectType" TEXT NOT NULL, "acknowledgementRequired" BOOLEAN NOT NULL DEFAULT false, "retentionDays" INTEGER NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT true, "emissionStatus" TEXT NOT NULL, "schemaReference" TEXT, "sourceDomain" TEXT NOT NULL, "documentationReference" TEXT, "metadata" JSONB);
CREATE UNIQUE INDEX "EventTypeDefinition_code_version_key" ON "EventTypeDefinition" ("eventCode", "version");
CREATE TABLE "EventRelation" ("id" TEXT PRIMARY KEY, "eventRecordId" TEXT NOT NULL, "relationType" TEXT NOT NULL, "targetType" TEXT NOT NULL, "targetId" TEXT NOT NULL, "targetDisplayName" TEXT, "metadata" JSONB);
CREATE TABLE "EventEvidenceReference" ("id" TEXT PRIMARY KEY, "eventRecordId" TEXT NOT NULL, "evidenceType" TEXT NOT NULL, "sourceType" TEXT NOT NULL, "sourceId" TEXT NOT NULL, "storageReference" TEXT, "title" TEXT NOT NULL, "description" TEXT, "checksum" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3), "legalHold" BOOLEAN NOT NULL DEFAULT false, "metadata" JSONB);
CREATE TABLE "EventProcessingState" ("id" TEXT PRIMARY KEY, "eventRecordId" TEXT NOT NULL UNIQUE, "status" TEXT NOT NULL, "seenAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL, "updatedBy" TEXT NOT NULL, "legalHold" BOOLEAN NOT NULL DEFAULT false, "legalHoldReason" TEXT);
CREATE INDEX "EventProcessingState_status_idx" ON "EventProcessingState" ("status");
CREATE TABLE "EventAcknowledgement" ("id" TEXT PRIMARY KEY, "eventRecordId" TEXT NOT NULL, "userId" TEXT NOT NULL, "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "comment" TEXT, "resolutionCode" TEXT, "metadata" JSONB);
CREATE TABLE "EventComment" ("id" TEXT PRIMARY KEY, "eventRecordId" TEXT NOT NULL, "authorId" TEXT NOT NULL, "body" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "editedAt" TIMESTAMP(3), "deletedAt" TIMESTAMP(3));
CREATE TABLE "EventTag" ("id" TEXT PRIMARY KEY, "eventRecordId" TEXT NOT NULL, "value" TEXT NOT NULL, "authorId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "EventTag_event_value_key" ON "EventTag" ("eventRecordId", "value");
CREATE TABLE "EventDeletionAudit" ("id" TEXT PRIMARY KEY, "eventId" TEXT NOT NULL, "retentionReason" TEXT NOT NULL, "deletionResult" TEXT NOT NULL, "deletionAuditId" TEXT, "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "metadata" JSONB);
