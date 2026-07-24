CREATE TABLE "CustomerPreference" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "source" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerPreference_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CustomerPromotionParticipation" (
  "id" TEXT NOT NULL, "customerId" TEXT NOT NULL, "promotionCode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ELIGIBLE', "source" TEXT NOT NULL, "metadata" JSONB,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3), CONSTRAINT "CustomerPromotionParticipation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CustomerGameActivity" (
  "id" TEXT NOT NULL, "customerId" TEXT NOT NULL, "gameCode" TEXT NOT NULL,
  "activityType" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'STARTED', "score" INTEGER,
  "rewardType" TEXT, "rewardValue" INTEGER, "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerGameActivity_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CustomerAiProfile" (
  "id" TEXT NOT NULL, "customerId" TEXT NOT NULL, "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'FOUNDATION_ONLY', "featureSnapshot" JSONB, "summary" JSONB,
  "modelReference" TEXT, "calculatedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CustomerAiProfile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CustomerTimelineEvent" (
  "id" TEXT NOT NULL, "customerId" TEXT NOT NULL, "eventType" TEXT NOT NULL,
  "category" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT,
  "sourceDomain" TEXT NOT NULL, "sourceEntityType" TEXT, "sourceEntityId" TEXT,
  "correlationId" TEXT, "metadata" JSONB, "occurredAt" TIMESTAMP(3) NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerTimelineEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CustomerPreference_customerId_category_key_key" ON "CustomerPreference"("customerId", "category", "key");
CREATE INDEX "CustomerPreference_customerId_updatedAt_idx" ON "CustomerPreference"("customerId", "updatedAt");
CREATE UNIQUE INDEX "CustomerPromotionParticipation_customerId_promotionCode_key" ON "CustomerPromotionParticipation"("customerId", "promotionCode");
CREATE INDEX "CustomerPromotionParticipation_customerId_status_joinedAt_idx" ON "CustomerPromotionParticipation"("customerId", "status", "joinedAt");
CREATE INDEX "CustomerGameActivity_customerId_occurredAt_idx" ON "CustomerGameActivity"("customerId", "occurredAt");
CREATE INDEX "CustomerGameActivity_gameCode_status_idx" ON "CustomerGameActivity"("gameCode", "status");
CREATE UNIQUE INDEX "CustomerAiProfile_customerId_key" ON "CustomerAiProfile"("customerId");
CREATE UNIQUE INDEX "CustomerTimelineEvent_customerId_sourceDomain_sourceEntityType_sourceEntityId_eventType_key" ON "CustomerTimelineEvent"("customerId", "sourceDomain", "sourceEntityType", "sourceEntityId", "eventType");
CREATE INDEX "CustomerTimelineEvent_customerId_occurredAt_idx" ON "CustomerTimelineEvent"("customerId", "occurredAt");
CREATE INDEX "CustomerTimelineEvent_category_occurredAt_idx" ON "CustomerTimelineEvent"("category", "occurredAt");
ALTER TABLE "CustomerPreference" ADD CONSTRAINT "CustomerPreference_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerPromotionParticipation" ADD CONSTRAINT "CustomerPromotionParticipation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerGameActivity" ADD CONSTRAINT "CustomerGameActivity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerAiProfile" ADD CONSTRAINT "CustomerAiProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerTimelineEvent" ADD CONSTRAINT "CustomerTimelineEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
