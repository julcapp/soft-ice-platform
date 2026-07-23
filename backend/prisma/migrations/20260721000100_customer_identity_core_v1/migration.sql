-- Customer Identity Core v1: verified phone, provider boundaries and idempotent consent decisions.

ALTER TABLE "Customer"
    ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3),
    ADD COLUMN "primaryIdentityProvider" TEXT;

ALTER TABLE "CustomerConsent"
    ADD COLUMN "decisionId" TEXT,
    ADD COLUMN "correlationId" TEXT;

UPDATE "CustomerConsent"
SET "decisionId" = 'legacy:' || "id"
WHERE "decisionId" IS NULL;

ALTER TABLE "CustomerConsent" ALTER COLUMN "decisionId" SET NOT NULL;

CREATE UNIQUE INDEX "DocumentVersion_documentType_version_key"
    ON "DocumentVersion"("documentType", "version");

CREATE UNIQUE INDEX "CustomerConsent_customerId_decisionId_key"
    ON "CustomerConsent"("customerId", "decisionId");

CREATE INDEX "CustomerConsent_customerId_consentType_grantedAt_idx"
    ON "CustomerConsent"("customerId", "consentType", "grantedAt");
