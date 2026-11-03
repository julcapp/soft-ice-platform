ALTER TABLE "CrmNotificationDelivery"
  ADD COLUMN IF NOT EXISTS "providerResponse" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "CrmNotificationDelivery_channel_status_nextAttemptAt_createdAt_idx"
  ON "CrmNotificationDelivery"("channel", "status", "nextAttemptAt", "createdAt");
