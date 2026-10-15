-- Promotion Engine foundation v1
-- First runtime campaign: HAPPY_HOUR / «Час выгоды».
-- Money values use DECIMAL; server-side pricing remains the source of truth.

CREATE TABLE "PromotionCampaign" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "currentVersionId" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "PromotionCampaign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromotionCampaign_code_key" ON "PromotionCampaign"("code");
CREATE INDEX "PromotionCampaign_status_createdAt_idx" ON "PromotionCampaign"("status", "createdAt");

CREATE TABLE "PromotionVersion" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "benefitType" TEXT NOT NULL,
  "benefitValue" DECIMAL(12,4),
  "priority" INTEGER NOT NULL DEFAULT 0,
  "stackingMode" TEXT NOT NULL DEFAULT 'BEST_PRICE',
  "exclusiveGroup" TEXT,
  "priceLockSeconds" INTEGER NOT NULL DEFAULT 300,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
  "approvalPolicy" TEXT NOT NULL DEFAULT 'SINGLE_APPROVAL',
  "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
  "budgetAmount" DECIMAL(14,2),
  "budgetAction" TEXT NOT NULL DEFAULT 'STOP',
  "maxApplications" INTEGER,
  "maxApplicationsPerCustomer" INTEGER,
  "minimumFinalPrice" DECIMAL(12,2),
  "metadata" JSONB,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromotionVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PromotionVersion_version_check" CHECK ("version" > 0),
  CONSTRAINT "PromotionVersion_priceLockSeconds_check" CHECK ("priceLockSeconds" > 0),
  CONSTRAINT "PromotionVersion_budgetAmount_check" CHECK ("budgetAmount" IS NULL OR "budgetAmount" >= 0),
  CONSTRAINT "PromotionVersion_minimumFinalPrice_check" CHECK ("minimumFinalPrice" IS NULL OR "minimumFinalPrice" >= 0)
);

CREATE UNIQUE INDEX "PromotionVersion_campaignId_version_key" ON "PromotionVersion"("campaignId", "version");
CREATE INDEX "PromotionVersion_campaignId_createdAt_idx" ON "PromotionVersion"("campaignId", "createdAt");
CREATE INDEX "PromotionVersion_startsAt_endsAt_idx" ON "PromotionVersion"("startsAt", "endsAt");

CREATE TABLE "PromotionSchedule" (
  "id" TEXT NOT NULL,
  "promotionVersionId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TIME(0) NOT NULL,
  "endTime" TIME(0) NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "windowOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromotionSchedule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PromotionSchedule_dayOfWeek_check" CHECK ("dayOfWeek" BETWEEN 1 AND 7)
);

CREATE INDEX "PromotionSchedule_version_day_enabled_idx" ON "PromotionSchedule"("promotionVersionId", "dayOfWeek", "isEnabled");

CREATE TABLE "PromotionMachineGroup" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromotionMachineGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromotionMachineGroup_code_key" ON "PromotionMachineGroup"("code");
CREATE INDEX "PromotionMachineGroup_active_name_idx" ON "PromotionMachineGroup"("active", "name");

CREATE TABLE "PromotionMachineGroupMember" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "machineId" TEXT NOT NULL,
  "addedBy" TEXT NOT NULL,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "PromotionMachineGroupMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromotionMachineGroupMember_group_active_idx" ON "PromotionMachineGroupMember"("groupId", "removedAt");
CREATE INDEX "PromotionMachineGroupMember_machine_active_idx" ON "PromotionMachineGroupMember"("machineId", "removedAt");
CREATE UNIQUE INDEX "PromotionMachineGroupMember_active_unique" ON "PromotionMachineGroupMember"("groupId", "machineId") WHERE "removedAt" IS NULL;

CREATE TABLE "PromotionTarget" (
  "id" TEXT NOT NULL,
  "promotionVersionId" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromotionTarget_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromotionTarget_version_type_idx" ON "PromotionTarget"("promotionVersionId", "targetType");
CREATE INDEX "PromotionTarget_type_target_idx" ON "PromotionTarget"("targetType", "targetId");

CREATE TABLE "PromotionAudience" (
  "id" TEXT NOT NULL,
  "promotionVersionId" TEXT NOT NULL,
  "audienceType" TEXT NOT NULL,
  "audienceReference" TEXT,
  "segmentId" TEXT,
  "criteria" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromotionAudience_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromotionAudience_version_type_idx" ON "PromotionAudience"("promotionVersionId", "audienceType");
CREATE INDEX "PromotionAudience_segmentId_idx" ON "PromotionAudience"("segmentId");

CREATE TABLE "PromotionRule" (
  "id" TEXT NOT NULL,
  "promotionVersionId" TEXT NOT NULL,
  "ruleType" TEXT NOT NULL,
  "operator" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromotionRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromotionRule_version_type_priority_idx" ON "PromotionRule"("promotionVersionId", "ruleType", "priority");

CREATE TABLE "PromotionChannel" (
  "id" TEXT NOT NULL,
  "promotionVersionId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "popupEnabled" BOOLEAN NOT NULL DEFAULT false,
  "countdownEnabled" BOOLEAN NOT NULL DEFAULT true,
  "preNotificationMinutes" INTEGER,
  "startMessageTemplate" TEXT,
  "activeMessageTemplate" TEXT,
  "endMessageTemplate" TEXT,
  "ctaLabel" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromotionChannel_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PromotionChannel_preNotificationMinutes_check" CHECK ("preNotificationMinutes" IS NULL OR "preNotificationMinutes" >= 0)
);

CREATE UNIQUE INDEX "PromotionChannel_version_channel_key" ON "PromotionChannel"("promotionVersionId", "channel");
CREATE INDEX "PromotionChannel_channel_enabled_idx" ON "PromotionChannel"("channel", "enabled");

CREATE TABLE "PromotionApproval" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "promotionVersionId" TEXT NOT NULL,
  "approvalPolicy" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requestedBy" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedBy" TEXT,
  "decidedAt" TIMESTAMP(3),
  "reason" TEXT,
  "metadata" JSONB,
  CONSTRAINT "PromotionApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromotionApproval_campaign_status_idx" ON "PromotionApproval"("campaignId", "status", "requestedAt");
CREATE INDEX "PromotionApproval_version_status_idx" ON "PromotionApproval"("promotionVersionId", "status");

CREATE TABLE "PromotionEvent" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "promotionVersionId" TEXT,
  "eventType" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT,
  "correlationId" TEXT,
  "idempotencyKey" TEXT,
  "oldValue" JSONB,
  "newValue" JSONB,
  "reason" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromotionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromotionEvent_idempotencyKey_key" ON "PromotionEvent"("idempotencyKey");
CREATE INDEX "PromotionEvent_campaign_occurredAt_idx" ON "PromotionEvent"("campaignId", "occurredAt");
CREATE INDEX "PromotionEvent_version_occurredAt_idx" ON "PromotionEvent"("promotionVersionId", "occurredAt");
CREATE INDEX "PromotionEvent_correlationId_idx" ON "PromotionEvent"("correlationId");

CREATE TABLE "PromotionApplication" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "machineId" TEXT,
  "campaignId" TEXT NOT NULL,
  "promotionVersionId" TEXT NOT NULL,
  "baseAmount" DECIMAL(12,2) NOT NULL,
  "discountAmount" DECIMAL(12,2) NOT NULL,
  "finalAmount" DECIMAL(12,2) NOT NULL,
  "pricingSnapshotId" TEXT,
  "appliedItems" JSONB,
  "reason" TEXT,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  CONSTRAINT "PromotionApplication_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PromotionApplication_amounts_check" CHECK (
    "baseAmount" >= 0 AND "discountAmount" >= 0 AND "finalAmount" >= 0
  )
);

CREATE UNIQUE INDEX "PromotionApplication_order_version_key" ON "PromotionApplication"("orderId", "promotionVersionId");
CREATE INDEX "PromotionApplication_campaign_appliedAt_idx" ON "PromotionApplication"("campaignId", "appliedAt");
CREATE INDEX "PromotionApplication_machine_appliedAt_idx" ON "PromotionApplication"("machineId", "appliedAt");
CREATE INDEX "PromotionApplication_customer_appliedAt_idx" ON "PromotionApplication"("customerId", "appliedAt");

ALTER TABLE "PromotionVersion"
  ADD CONSTRAINT "PromotionVersion_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "PromotionCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromotionCampaign"
  ADD CONSTRAINT "PromotionCampaign_currentVersionId_fkey"
  FOREIGN KEY ("currentVersionId") REFERENCES "PromotionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PromotionSchedule"
  ADD CONSTRAINT "PromotionSchedule_promotionVersionId_fkey"
  FOREIGN KEY ("promotionVersionId") REFERENCES "PromotionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromotionMachineGroupMember"
  ADD CONSTRAINT "PromotionMachineGroupMember_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "PromotionMachineGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromotionMachineGroupMember"
  ADD CONSTRAINT "PromotionMachineGroupMember_machineId_fkey"
  FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromotionTarget"
  ADD CONSTRAINT "PromotionTarget_promotionVersionId_fkey"
  FOREIGN KEY ("promotionVersionId") REFERENCES "PromotionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromotionAudience"
  ADD CONSTRAINT "PromotionAudience_promotionVersionId_fkey"
  FOREIGN KEY ("promotionVersionId") REFERENCES "PromotionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromotionAudience"
  ADD CONSTRAINT "PromotionAudience_segmentId_fkey"
  FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PromotionRule"
  ADD CONSTRAINT "PromotionRule_promotionVersionId_fkey"
  FOREIGN KEY ("promotionVersionId") REFERENCES "PromotionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromotionChannel"
  ADD CONSTRAINT "PromotionChannel_promotionVersionId_fkey"
  FOREIGN KEY ("promotionVersionId") REFERENCES "PromotionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromotionApproval"
  ADD CONSTRAINT "PromotionApproval_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "PromotionCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromotionApproval"
  ADD CONSTRAINT "PromotionApproval_promotionVersionId_fkey"
  FOREIGN KEY ("promotionVersionId") REFERENCES "PromotionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromotionEvent"
  ADD CONSTRAINT "PromotionEvent_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "PromotionCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromotionEvent"
  ADD CONSTRAINT "PromotionEvent_promotionVersionId_fkey"
  FOREIGN KEY ("promotionVersionId") REFERENCES "PromotionVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PromotionApplication"
  ADD CONSTRAINT "PromotionApplication_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromotionApplication"
  ADD CONSTRAINT "PromotionApplication_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromotionApplication"
  ADD CONSTRAINT "PromotionApplication_machineId_fkey"
  FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PromotionApplication"
  ADD CONSTRAINT "PromotionApplication_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "PromotionCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromotionApplication"
  ADD CONSTRAINT "PromotionApplication_promotionVersionId_fkey"
  FOREIGN KEY ("promotionVersionId") REFERENCES "PromotionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
