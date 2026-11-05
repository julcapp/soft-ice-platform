ALTER TABLE "CrmNotificationDelivery"
  ADD COLUMN IF NOT EXISTS "providerResponse" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "CrmNotificationDelivery_channel_status_nextAttemptAt_createdAt_idx"
  ON "CrmNotificationDelivery"("channel", "status", "nextAttemptAt", "createdAt");

UPDATE "CrmNotificationDelivery"
SET "status"='PENDING',
    "nextAttemptAt"=COALESCE("nextAttemptAt", CURRENT_TIMESTAMP),
    "updatedAt"=CURRENT_TIMESTAMP
WHERE UPPER("channel")='EMAIL' AND "status"='QUEUED';

UPDATE "CrmNotificationDelivery" d
SET "recipientAddress"=(
      SELECT v."email"
      FROM "CustomerEmailVerification" v
      WHERE v."customerId"=d."customerId"
        AND v."status" IN ('PENDING','VERIFIED')
      ORDER BY
        CASE WHEN v."status"='PENDING' THEN 0 ELSE 1 END,
        v."createdAt" DESC
      LIMIT 1
    ),
    "updatedAt"=CURRENT_TIMESTAMP
WHERE UPPER(d."channel")='EMAIL'
  AND d."recipientAddress" IS NULL;

UPDATE "CrmNotificationDelivery"
SET "body"=REPLACE(
      "body",
      'https://app.utimoshi.ru/?mode=verify-email',
      'https://miniapp.utimoshi.ru/?mode=verify-email'
    ),
    "updatedAt"=CURRENT_TIMESTAMP
WHERE UPPER("channel")='EMAIL'
  AND "status" IN ('PENDING','QUEUED','FAILED')
  AND "body" LIKE '%https://app.utimoshi.ru/?mode=verify-email%';
