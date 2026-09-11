CREATE TABLE IF NOT EXISTS "AdminUser" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "login" TEXT NOT NULL UNIQUE,
  "displayName" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "roles" TEXT[] NOT NULL DEFAULT ARRAY['PLATFORM_OWNER']::TEXT[],
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMPTZ,
  "lastLoginAt" TIMESTAMPTZ,
  "passwordChangedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "AdminSession" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "adminUserId" UUID NOT NULL REFERENCES "AdminUser"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "revokedAt" TIMESTAMPTZ,
  "revokedReason" TEXT
);

CREATE INDEX IF NOT EXISTS "AdminSession_adminUserId_idx" ON "AdminSession"("adminUserId");
CREATE INDEX IF NOT EXISTS "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");
CREATE INDEX IF NOT EXISTS "AdminUser_status_idx" ON "AdminUser"("status");
