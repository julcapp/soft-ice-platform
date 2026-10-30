ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "organizationMemberId" TEXT REFERENCES "OrganizationMember"("id") ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS "AdminUser_organizationMemberId_idx" ON "AdminUser"("organizationMemberId");

CREATE TABLE "ServiceVisit" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "machineId" TEXT NOT NULL REFERENCES "Machine"("id") ON DELETE RESTRICT,
  "adminUserId" UUID NOT NULL REFERENCES "AdminUser"("id") ON DELETE RESTRICT,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK ("status" IN ('IN_PROGRESS','COMPLETED')),
  "summary" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completedAt" TIMESTAMPTZ
);
CREATE UNIQUE INDEX "ServiceVisit_active_machine_idx" ON "ServiceVisit"("machineId") WHERE "status"='IN_PROGRESS';
CREATE INDEX "ServiceVisit_admin_machine_idx" ON "ServiceVisit"("adminUserId","machineId","createdAt");
CREATE TABLE "ServicePhoto" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "visitId" UUID NOT NULL REFERENCES "ServiceVisit"("id") ON DELETE RESTRICT,
  "stage" TEXT NOT NULL CHECK ("stage" IN ('BEFORE','AFTER')),
  "storageKey" TEXT NOT NULL UNIQUE,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);
CREATE INDEX "ServicePhoto_visit_idx" ON "ServicePhoto"("visitId");
