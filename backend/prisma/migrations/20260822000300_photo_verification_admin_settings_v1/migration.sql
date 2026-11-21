-- Admin-controlled Photo Verification settings v1

CREATE TABLE "PhotoVerificationSettings" (
    "scopeKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'manual_only',
    "publishingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "requiredChannels" JSONB NOT NULL DEFAULT '["VK","TELEGRAM","MAX"]'::jsonb,
    "approvalThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.90,
    "rejectionThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.65,
    "maxFraudScore" DOUBLE PRECISION NOT NULL DEFAULT 0.50,
    "duplicateChecksEnabled" BOOLEAN NOT NULL DEFAULT true,
    "metadataChecksEnabled" BOOLEAN NOT NULL DEFAULT true,
    "challengeCodeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "retentionPolicy" TEXT NOT NULL DEFAULT 'delete_after_publication',
    "provider" TEXT,
    "model" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhotoVerificationSettings_pkey" PRIMARY KEY ("scopeKey")
);

ALTER TABLE "PhotoVerificationSettings"
ADD CONSTRAINT "PhotoVerificationSettings_approvalThreshold_check"
CHECK ("approvalThreshold" >= 0 AND "approvalThreshold" <= 1);

ALTER TABLE "PhotoVerificationSettings"
ADD CONSTRAINT "PhotoVerificationSettings_rejectionThreshold_check"
CHECK ("rejectionThreshold" >= 0 AND "rejectionThreshold" <= 1);

ALTER TABLE "PhotoVerificationSettings"
ADD CONSTRAINT "PhotoVerificationSettings_maxFraudScore_check"
CHECK ("maxFraudScore" >= 0 AND "maxFraudScore" <= 1);

INSERT INTO "PhotoVerificationSettings" ("scopeKey") VALUES ('default');
