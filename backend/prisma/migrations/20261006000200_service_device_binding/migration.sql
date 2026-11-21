CREATE TABLE "ServiceDeviceBinding" (
  "id" UUID PRIMARY KEY,
  "memberId" TEXT NOT NULL REFERENCES "OrganizationMember"("id") ON DELETE RESTRICT,
  "manufacturer" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "androidVersion" TEXT NOT NULL,
  "appVersion" TEXT NOT NULL,
  "publicKey" TEXT NOT NULL,
  "keyFingerprint" TEXT NOT NULL,
  "createdBy" UUID NOT NULL REFERENCES "AdminUser"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "revokedAt" TIMESTAMPTZ,
  "revokedBy" UUID REFERENCES "AdminUser"("id") ON DELETE RESTRICT,
  "revokeReason" TEXT
);
CREATE UNIQUE INDEX "ServiceDeviceBinding_one_active_member" ON "ServiceDeviceBinding"("memberId") WHERE "revokedAt" IS NULL;
CREATE UNIQUE INDEX "ServiceDeviceBinding_one_active_key" ON "ServiceDeviceBinding"("keyFingerprint") WHERE "revokedAt" IS NULL;
CREATE TABLE "ServiceDeviceProofChallenge" (
  "id" UUID PRIMARY KEY,
  "bindingId" UUID NOT NULL REFERENCES "ServiceDeviceBinding"("id") ON DELETE RESTRICT,
  "nonceHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "consumedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "ServiceDeviceProofChallenge_expiry" ON "ServiceDeviceProofChallenge"("expiresAt");
