-- P-12: separate editable working version from the version currently serving pricing.
ALTER TABLE "PromotionCampaign"
  ADD COLUMN "effectiveVersionId" TEXT;

ALTER TABLE "PromotionVersion"
  ADD COLUMN "status" VARCHAR(40) NOT NULL DEFAULT 'DRAFT';

CREATE INDEX "PromotionCampaign_effectiveVersionId_idx"
  ON "PromotionCampaign"("effectiveVersionId");

CREATE INDEX "PromotionVersion_campaignId_status_idx"
  ON "PromotionVersion"("campaignId", "status");

ALTER TABLE "PromotionCampaign"
  ADD CONSTRAINT "PromotionCampaign_effectiveVersionId_fkey"
  FOREIGN KEY ("effectiveVersionId") REFERENCES "PromotionVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing ACTIVE/SCHEDULED campaigns were created before the serving pointer existed.
-- Preserve their currently selected version as the effective version during migration.
UPDATE "PromotionCampaign"
SET "effectiveVersionId" = "currentVersionId"
WHERE "status" IN ('ACTIVE','SCHEDULED','PAUSED','PAUSED_BY_SAFETY','PAUSED_BY_BUDGET')
  AND "currentVersionId" IS NOT NULL;

UPDATE "PromotionVersion" v
SET "status" = CASE
  WHEN c."status" = 'ACTIVE' THEN 'ACTIVE'
  WHEN c."status" = 'SCHEDULED' THEN 'SCHEDULED'
  WHEN c."status" IN ('PAUSED','PAUSED_BY_SAFETY','PAUSED_BY_BUDGET') THEN c."status"
  WHEN c."status" = 'READY' THEN 'READY'
  WHEN c."status" = 'VALIDATION_FAILED' THEN 'VALIDATION_FAILED'
  ELSE 'DRAFT'
END
FROM "PromotionCampaign" c
WHERE c."currentVersionId" = v."id";
