CREATE TABLE IF NOT EXISTS "AdminMaxLinkCandidate" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "maxUserId" TEXT NOT NULL,
  "chatId" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "username" TEXT,
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "confirmedByAdminUserId" UUID,
  "confirmedAt" TIMESTAMPTZ,
  "consumedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "AdminMaxLinkCandidate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminMaxLinkCandidate_confirmedByAdminUserId_fkey" FOREIGN KEY ("confirmedByAdminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AdminMaxLinkCandidate_created_idx"
  ON "AdminMaxLinkCandidate"("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "AdminMaxLinkCandidate_user_idx"
  ON "AdminMaxLinkCandidate"("maxUserId", "createdAt" DESC);
