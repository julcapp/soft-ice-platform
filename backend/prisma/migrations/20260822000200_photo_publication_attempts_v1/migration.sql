-- Durable, retry-safe publication state for VK / Telegram / MAX.
ALTER TABLE "PhotoPublication"
ADD COLUMN "targetId" TEXT,
ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "PhotoPublication_photoChallengeId_channel_key"
ON "PhotoPublication"("photoChallengeId", "channel");

CREATE UNIQUE INDEX "PhotoPublication_idempotencyKey_key"
ON "PhotoPublication"("idempotencyKey");

CREATE INDEX "PhotoPublication_status_lastAttemptAt_idx"
ON "PhotoPublication"("status", "lastAttemptAt");
