ALTER TABLE "AdminUser"
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "maxUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "maxVerifiedAt" TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS "AdminSecurityChallenge" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "adminUserId" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "purpose" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "newPasswordHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "consumedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "AdminSecurityChallenge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminSecurityChallenge_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AdminSecurityChallenge_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AdminSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AdminSecurityChallenge_channel_check" CHECK ("channel" IN ('MAX','EMAIL')),
  CONSTRAINT "AdminSecurityChallenge_purpose_check" CHECK ("purpose" IN ('PASSWORD_CHANGE'))
);

CREATE INDEX IF NOT EXISTS "AdminSecurityChallenge_user_created_idx"
  ON "AdminSecurityChallenge"("adminUserId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AdminSecurityChallenge_expires_idx"
  ON "AdminSecurityChallenge"("expiresAt") WHERE "consumedAt" IS NULL;
