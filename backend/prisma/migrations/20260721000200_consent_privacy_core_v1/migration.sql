-- Consent Privacy Core v1: constrained legal purposes, source channels and consent timestamps.

CREATE TYPE "ConsentType" AS ENUM (
    'PERSONAL_DATA',
    'MARKETING',
    'ADVERTISING',
    'PARTNER_OFFERS',
    'PHOTO_USAGE'
);

CREATE TYPE "ConsentSourceChannel" AS ENUM (
    'TELEGRAM',
    'MINI_APP',
    'MACHINE',
    'WEBSITE'
);

ALTER TABLE "CustomerConsent" RENAME COLUMN "grantedAt" TO "consentedAt";
ALTER TABLE "CustomerConsent" RENAME COLUMN "source" TO "sourceChannel";

UPDATE "CustomerConsent"
SET "consentType" = CASE "consentType"
    WHEN 'personal_data_processing' THEN 'PERSONAL_DATA'
    WHEN 'marketing_communications' THEN 'MARKETING'
    WHEN 'photo_processing' THEN 'PHOTO_USAGE'
    ELSE 'PERSONAL_DATA'
END;

UPDATE "CustomerConsent"
SET "sourceChannel" = CASE "sourceChannel"
    WHEN 'telegram_bot' THEN 'TELEGRAM'
    WHEN 'telegram_mini_app' THEN 'MINI_APP'
    WHEN 'terminal' THEN 'MACHINE'
    WHEN 'website' THEN 'WEBSITE'
    ELSE 'MINI_APP'
END;

ALTER TABLE "CustomerConsent"
    ALTER COLUMN "consentType" TYPE "ConsentType" USING "consentType"::"ConsentType",
    ALTER COLUMN "sourceChannel" TYPE "ConsentSourceChannel" USING "sourceChannel"::"ConsentSourceChannel";

DROP INDEX IF EXISTS "CustomerConsent_customerId_consentType_grantedAt_idx";
CREATE INDEX "CustomerConsent_customerId_consentType_consentedAt_idx"
    ON "CustomerConsent"("customerId", "consentType", "consentedAt");
