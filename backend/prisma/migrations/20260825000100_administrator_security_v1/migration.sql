CREATE TYPE "AdministratorStatus" AS ENUM ('ACTIVE', 'DISABLED', 'REVOKED');
CREATE TYPE "AdministratorSessionStatus" AS ENUM ('ACTIVE', 'REVOKED');

ALTER TABLE "AuditEvent" ADD COLUMN "organizationId" TEXT,
ADD COLUMN "sessionId" TEXT,
ADD COLUMN "idempotencyKey" TEXT;
CREATE INDEX "AuditEvent_organizationId_occurredAt_idx" ON "AuditEvent"("organizationId", "occurredAt");
CREATE FUNCTION "reject_administrator_audit_mutation"() RETURNS trigger AS $$ BEGIN
  IF OLD."eventType" LIKE 'administrator.%' AND current_setting('soft_ice.audit_maintenance', true) IS DISTINCT FROM 'on' THEN RAISE EXCEPTION 'administrator security audit is append-only'; END IF;
  RETURN OLD;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "AuditEvent_administrator_append_only" BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION "reject_administrator_audit_mutation"();

CREATE TABLE "Administrator" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "memberId" TEXT NOT NULL,
  "status" "AdministratorStatus" NOT NULL DEFAULT 'ACTIVE', "disabledAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Administrator_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Administrator_status_dates_check" CHECK (("status"='ACTIVE' AND "disabledAt" IS NULL AND "revokedAt" IS NULL) OR ("status"='DISABLED' AND "disabledAt" IS NOT NULL AND "revokedAt" IS NULL) OR ("status"='REVOKED' AND "revokedAt" IS NOT NULL))
);
CREATE UNIQUE INDEX "Administrator_memberId_key" ON "Administrator"("memberId");
CREATE UNIQUE INDEX "Administrator_id_organizationId_key" ON "Administrator"("id", "organizationId");
CREATE UNIQUE INDEX "Administrator_memberId_organizationId_key" ON "Administrator"("memberId", "organizationId");
CREATE INDEX "Administrator_organizationId_status_idx" ON "Administrator"("organizationId", "status");
ALTER TABLE "Administrator" ADD CONSTRAINT "Administrator_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Administrator" ADD CONSTRAINT "Administrator_memberId_organizationId_fkey" FOREIGN KEY ("memberId", "organizationId") REFERENCES "OrganizationMember"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AdministratorSession" (
  "id" TEXT NOT NULL, "administratorId" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "accessTokenHash" TEXT NOT NULL,
  "status" "AdministratorSessionStatus" NOT NULL DEFAULT 'ACTIVE', "authenticationMethod" TEXT NOT NULL, "authenticationMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL, "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "revokedAt" TIMESTAMP(3),
  CONSTRAINT "AdministratorSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdministratorSession_time_check" CHECK ("expiresAt">"createdAt" AND "lastSeenAt">="createdAt"),
  CONSTRAINT "AdministratorSession_revocation_check" CHECK (("status"='ACTIVE' AND "revokedAt" IS NULL) OR ("status"='REVOKED' AND "revokedAt" IS NOT NULL))
);
CREATE UNIQUE INDEX "AdministratorSession_accessTokenHash_key" ON "AdministratorSession"("accessTokenHash");
CREATE INDEX "AdministratorSession_administratorId_status_expiresAt_idx" ON "AdministratorSession"("administratorId", "status", "expiresAt");
CREATE INDEX "AdministratorSession_organizationId_status_expiresAt_idx" ON "AdministratorSession"("organizationId", "status", "expiresAt");
ALTER TABLE "AdministratorSession" ADD CONSTRAINT "AdministratorSession_administratorId_organizationId_fkey" FOREIGN KEY ("administratorId", "organizationId") REFERENCES "Administrator"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdministratorSession" ADD CONSTRAINT "AdministratorSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AdministratorRoleBinding" ("id" TEXT NOT NULL, "administratorId" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "role" TEXT NOT NULL, "grantedBy" TEXT NOT NULL, "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "revokedAt" TIMESTAMP(3), CONSTRAINT "AdministratorRoleBinding_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AdministratorRoleBinding_administratorId_revokedAt_idx" ON "AdministratorRoleBinding"("administratorId", "revokedAt");
CREATE UNIQUE INDEX "AdministratorRoleBinding_administratorId_organizationId_rol_key" ON "AdministratorRoleBinding"("administratorId", "organizationId", "role", "revokedAt");
ALTER TABLE "AdministratorRoleBinding" ADD CONSTRAINT "AdministratorRoleBinding_administratorId_organizationId_fkey" FOREIGN KEY ("administratorId", "organizationId") REFERENCES "Administrator"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdministratorRoleBinding" ADD CONSTRAINT "AdministratorRoleBinding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AdministratorPermissionBinding" ("id" TEXT NOT NULL, "administratorId" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "permission" TEXT NOT NULL, "effect" TEXT NOT NULL DEFAULT 'ALLOW', "grantedBy" TEXT NOT NULL, "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "revokedAt" TIMESTAMP(3), CONSTRAINT "AdministratorPermissionBinding_pkey" PRIMARY KEY ("id"), CONSTRAINT "AdministratorPermissionBinding_effect_check" CHECK ("effect" IN ('ALLOW','DENY')));
CREATE INDEX "AdministratorPermissionBinding_administratorId_revokedAt_idx" ON "AdministratorPermissionBinding"("administratorId", "revokedAt");
CREATE UNIQUE INDEX "AdministratorPermissionBinding_administratorId_organization_key" ON "AdministratorPermissionBinding"("administratorId", "organizationId", "permission", "effect", "revokedAt");
ALTER TABLE "AdministratorPermissionBinding" ADD CONSTRAINT "AdministratorPermissionBinding_administratorId_organizatio_fkey" FOREIGN KEY ("administratorId", "organizationId") REFERENCES "Administrator"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdministratorPermissionBinding" ADD CONSTRAINT "AdministratorPermissionBinding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AdministratorApproval" ("id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "requesterAdministratorId" TEXT NOT NULL, "approverAdministratorId" TEXT, "action" TEXT NOT NULL, "targetType" TEXT NOT NULL, "targetId" TEXT NOT NULL, "requestFingerprint" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "reason" TEXT NOT NULL, "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "decidedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AdministratorApproval_pkey" PRIMARY KEY ("id"), CONSTRAINT "AdministratorApproval_status_check" CHECK ("status" IN ('PENDING','APPROVED','REJECTED','EXPIRED')), CONSTRAINT "AdministratorApproval_decision_check" CHECK (("status"='PENDING' AND "approverAdministratorId" IS NULL AND "decidedAt" IS NULL) OR ("status" IN ('APPROVED','REJECTED') AND "approverAdministratorId" IS NOT NULL AND "decidedAt" IS NOT NULL) OR ("status"='EXPIRED' AND "approverAdministratorId" IS NULL AND "decidedAt" IS NOT NULL)), CONSTRAINT "AdministratorApproval_separation_check" CHECK ("approverAdministratorId" IS NULL OR "approverAdministratorId"<>"requesterAdministratorId"), CONSTRAINT "AdministratorApproval_time_check" CHECK ("expiresAt">"requestedAt" AND ("decidedAt" IS NULL OR "decidedAt">="requestedAt")));
CREATE UNIQUE INDEX "AdministratorApproval_organizationId_requestFingerprint_key" ON "AdministratorApproval"("organizationId", "requestFingerprint");
CREATE INDEX "AdministratorApproval_organizationId_status_expiresAt_idx" ON "AdministratorApproval"("organizationId", "status", "expiresAt");
ALTER TABLE "AdministratorApproval" ADD CONSTRAINT "AdministratorApproval_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdministratorApproval" ADD CONSTRAINT "AdministratorApproval_requesterAdministratorId_organizatio_fkey" FOREIGN KEY ("requesterAdministratorId", "organizationId") REFERENCES "Administrator"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdministratorApproval" ADD CONSTRAINT "AdministratorApproval_approverAdministratorId_organization_fkey" FOREIGN KEY ("approverAdministratorId", "organizationId") REFERENCES "Administrator"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AdministratorBreakGlassGrant" ("id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "administratorId" TEXT NOT NULL, "reason" TEXT NOT NULL, "permissions" JSONB NOT NULL, "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3), CONSTRAINT "AdministratorBreakGlassGrant_pkey" PRIMARY KEY ("id"), CONSTRAINT "AdministratorBreakGlassGrant_time_check" CHECK ("expiresAt">"activatedAt"));
CREATE INDEX "AdministratorBreakGlassGrant_administratorId_expiresAt_revo_idx" ON "AdministratorBreakGlassGrant"("administratorId", "expiresAt", "revokedAt");
ALTER TABLE "AdministratorBreakGlassGrant" ADD CONSTRAINT "AdministratorBreakGlassGrant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdministratorBreakGlassGrant" ADD CONSTRAINT "AdministratorBreakGlassGrant_administratorId_organizationI_fkey" FOREIGN KEY ("administratorId", "organizationId") REFERENCES "Administrator"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
