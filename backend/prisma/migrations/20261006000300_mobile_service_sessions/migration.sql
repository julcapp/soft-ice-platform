CREATE TABLE "ServiceMobileSession" (
 "id" UUID PRIMARY KEY,
 "adminUserId" UUID NOT NULL REFERENCES "AdminUser"("id") ON DELETE RESTRICT,
 "bindingId" UUID NOT NULL REFERENCES "ServiceDeviceBinding"("id") ON DELETE RESTRICT,
 "tokenHash" TEXT NOT NULL UNIQUE,
 "activeRole" TEXT CHECK ("activeRole" IN ('SERVICE_SPECIALIST','MACHINE_RESPONSIBLE')),
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 "expiresAt" TIMESTAMPTZ NOT NULL,
 "revokedAt" TIMESTAMPTZ
);
ALTER TABLE "ServiceDeviceProofChallenge" ADD COLUMN "sessionId" UUID REFERENCES "ServiceMobileSession"("id"), ADD COLUMN "requestHash" TEXT;
ALTER TABLE "ServiceVisit" ADD COLUMN "actingRole" TEXT CHECK ("actingRole" IN ('SERVICE_SPECIALIST','MACHINE_RESPONSIBLE'));
CREATE INDEX "ServiceMobileSession_binding" ON "ServiceMobileSession"("bindingId");
