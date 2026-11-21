-- Photo Verification Agent persistence v1
-- Extends the existing PhotoChallenge lifecycle without storing binary image data in PostgreSQL.

CREATE TABLE "PhotoVerificationResult" (
    "id" TEXT NOT NULL,
    "photoChallengeId" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "decision" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "fraudScore" DOUBLE PRECISION,
    "reasonCode" TEXT,
    "checks" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "aiResponse" JSONB,
    "metadataResult" JSONB,
    "antifraudResult" JSONB,
    "promptVersion" TEXT,
    "rulesVersion" TEXT,
    "agentVersion" TEXT NOT NULL DEFAULT '0.1',
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhotoVerificationResult_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PhotoVerificationResult_photoChallengeId_fkey" FOREIGN KEY ("photoChallengeId") REFERENCES "PhotoChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PhotoVerificationResult_photoChallengeId_processedAt_idx"
ON "PhotoVerificationResult"("photoChallengeId", "processedAt");

CREATE TABLE "PhotoVerificationEvent" (
    "id" TEXT NOT NULL,
    "photoChallengeId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventSource" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "actorId" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhotoVerificationEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PhotoVerificationEvent_photoChallengeId_fkey" FOREIGN KEY ("photoChallengeId") REFERENCES "PhotoChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PhotoVerificationEvent_photoChallengeId_createdAt_idx"
ON "PhotoVerificationEvent"("photoChallengeId", "createdAt");
CREATE INDEX "PhotoVerificationEvent_correlationId_idx"
ON "PhotoVerificationEvent"("correlationId");

CREATE TABLE "PhotoFingerprint" (
    "id" TEXT NOT NULL,
    "photoChallengeId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "pHash" TEXT,
    "dHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhotoFingerprint_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PhotoFingerprint_photoChallengeId_fkey" FOREIGN KEY ("photoChallengeId") REFERENCES "PhotoChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PhotoFingerprint_photoChallengeId_key" ON "PhotoFingerprint"("photoChallengeId");
CREATE INDEX "PhotoFingerprint_sha256_idx" ON "PhotoFingerprint"("sha256");
CREATE INDEX "PhotoFingerprint_pHash_idx" ON "PhotoFingerprint"("pHash");

CREATE TABLE "PhotoPublication" (
    "id" TEXT NOT NULL,
    "photoChallengeId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "externalPublicationId" TEXT,
    "publicationUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhotoPublication_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PhotoPublication_photoChallengeId_fkey" FOREIGN KEY ("photoChallengeId") REFERENCES "PhotoChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PhotoPublication_photoChallengeId_status_idx"
ON "PhotoPublication"("photoChallengeId", "status");
CREATE UNIQUE INDEX "PhotoPublication_channel_externalPublicationId_key"
ON "PhotoPublication"("channel", "externalPublicationId");

CREATE TABLE "PhotoSourceDeletion" (
    "id" TEXT NOT NULL,
    "photoChallengeId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "deleteReason" TEXT NOT NULL DEFAULT 'publication_confirmed',
    "requestedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhotoSourceDeletion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PhotoSourceDeletion_photoChallengeId_fkey" FOREIGN KEY ("photoChallengeId") REFERENCES "PhotoChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PhotoSourceDeletion_photoChallengeId_key"
ON "PhotoSourceDeletion"("photoChallengeId");

ALTER TABLE "PhotoVerificationResult"
ADD CONSTRAINT "PhotoVerificationResult_confidence_check"
CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));

ALTER TABLE "PhotoVerificationResult"
ADD CONSTRAINT "PhotoVerificationResult_fraudScore_check"
CHECK ("fraudScore" IS NULL OR ("fraudScore" >= 0 AND "fraudScore" <= 1));
