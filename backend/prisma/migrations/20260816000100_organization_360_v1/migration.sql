CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED', 'BLOCKED');
CREATE TYPE "OrganizationMemberStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "OrganizationLocationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "OrganizationRoleType" AS ENUM ('OWNER', 'ADMINISTRATOR', 'MANAGER', 'OPERATOR', 'SERVICE_SPECIALIST', 'MACHINE_RESPONSIBLE', 'LOCATION_RESPONSIBLE', 'FINANCIALLY_RESPONSIBLE');
CREATE TYPE "OrganizationResponsibilityScope" AS ENUM ('ORGANIZATION', 'UNIT', 'LOCATION', 'MACHINE', 'FINANCE');

CREATE TABLE "Organization" (
  "id" TEXT NOT NULL, "fullName" TEXT NOT NULL, "shortName" TEXT NOT NULL, "organizationType" TEXT NOT NULL,
  "inn" TEXT, "kpp" TEXT, "ogrn" TEXT, "legalAddress" TEXT, "actualAddress" TEXT, "phone" TEXT, "email" TEXT,
  "website" TEXT, "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE', "foundedAt" TIMESTAMP(3),
  "cooperationStartedAt" TIMESTAMP(3), "note" TEXT, "archivedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organization_inn_kpp_key" ON "Organization"("inn", "kpp");
CREATE INDEX "Organization_status_shortName_idx" ON "Organization"("status", "shortName");
CREATE INDEX "Organization_createdAt_idx" ON "Organization"("createdAt");

CREATE TABLE "OrganizationUnit" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "parentId" TEXT, "name" TEXT NOT NULL, "code" TEXT NOT NULL,
  "description" TEXT, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "archivedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "OrganizationUnit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationUnit_organizationId_code_key" ON "OrganizationUnit"("organizationId", "code");
CREATE UNIQUE INDEX "OrganizationUnit_id_organizationId_key" ON "OrganizationUnit"("id", "organizationId");
CREATE INDEX "OrganizationUnit_organizationId_parentId_status_idx" ON "OrganizationUnit"("organizationId", "parentId", "status");

CREATE TABLE "OrganizationMember" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "unitId" TEXT, "platformUserId" TEXT, "fullName" TEXT NOT NULL,
  "position" TEXT NOT NULL, "phone" TEXT, "email" TEXT, "status" "OrganizationMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "employmentStartedAt" TIMESTAMP(3), "employmentEndedAt" TIMESTAMP(3), "responsibilityZone" TEXT, "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationMember_organizationId_platformUserId_key" ON "OrganizationMember"("organizationId", "platformUserId");
CREATE UNIQUE INDEX "OrganizationMember_id_organizationId_key" ON "OrganizationMember"("id", "organizationId");
CREATE INDEX "OrganizationMember_organizationId_unitId_status_idx" ON "OrganizationMember"("organizationId", "unitId", "status");
CREATE INDEX "OrganizationMember_platformUserId_idx" ON "OrganizationMember"("platformUserId");

CREATE TABLE "OrganizationRoleAssignment" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "memberId" TEXT NOT NULL, "role" "OrganizationRoleType" NOT NULL,
  "grantedBy" TEXT NOT NULL, "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "revokedAt" TIMESTAMP(3), "note" TEXT,
  CONSTRAINT "OrganizationRoleAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationRoleAssignment_organizationId_memberId_role_revokedAt_key" ON "OrganizationRoleAssignment"("organizationId", "memberId", "role", "revokedAt");
CREATE INDEX "OrganizationRoleAssignment_organizationId_role_revokedAt_idx" ON "OrganizationRoleAssignment"("organizationId", "role", "revokedAt");
CREATE UNIQUE INDEX "OrganizationRoleAssignment_one_active_role" ON "OrganizationRoleAssignment"("organizationId", "memberId", "role") WHERE "revokedAt" IS NULL;

CREATE TABLE "OrganizationLocation" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "responsibleUnitId" TEXT, "responsibleMemberId" TEXT,
  "name" TEXT NOT NULL, "address" TEXT NOT NULL, "latitude" DECIMAL(9,6), "longitude" DECIMAL(9,6), "openingHours" JSONB,
  "status" "OrganizationLocationStatus" NOT NULL DEFAULT 'ACTIVE', "archivedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "OrganizationLocation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrganizationLocation_organizationId_status_idx" ON "OrganizationLocation"("organizationId", "status");
CREATE UNIQUE INDEX "OrganizationLocation_id_organizationId_key" ON "OrganizationLocation"("id", "organizationId");
CREATE INDEX "OrganizationLocation_organizationId_latitude_longitude_idx" ON "OrganizationLocation"("organizationId", "latitude", "longitude");

CREATE TABLE "OrganizationMachineAssignment" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "machineId" TEXT NOT NULL, "locationId" TEXT,
  "ownerOrganizationId" TEXT NOT NULL, "operatorOrganizationId" TEXT NOT NULL, "responsibleMemberId" TEXT, "serviceSpecialistId" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "unassignedAt" TIMESTAMP(3), "assignedBy" TEXT NOT NULL, "note" TEXT,
  CONSTRAINT "OrganizationMachineAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrganizationMachineAssignment_organizationId_unassignedAt_idx" ON "OrganizationMachineAssignment"("organizationId", "unassignedAt");
CREATE INDEX "OrganizationMachineAssignment_machineId_unassignedAt_idx" ON "OrganizationMachineAssignment"("machineId", "unassignedAt");
CREATE INDEX "OrganizationMachineAssignment_locationId_unassignedAt_idx" ON "OrganizationMachineAssignment"("locationId", "unassignedAt");
CREATE UNIQUE INDEX "OrganizationMachineAssignment_one_active_machine" ON "OrganizationMachineAssignment"("machineId") WHERE "unassignedAt" IS NULL;

CREATE TABLE "OrganizationResponsibility" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "memberId" TEXT NOT NULL, "scope" "OrganizationResponsibilityScope" NOT NULL,
  "unitId" TEXT, "locationId" TEXT, "machineId" TEXT, "description" TEXT, "assignedBy" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "revokedAt" TIMESTAMP(3), CONSTRAINT "OrganizationResponsibility_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "OrganizationResponsibility" ADD CONSTRAINT "OrganizationResponsibility_scope_target_check" CHECK (
  ("scope" = 'UNIT' AND "unitId" IS NOT NULL AND "locationId" IS NULL AND "machineId" IS NULL) OR
  ("scope" = 'LOCATION' AND "unitId" IS NULL AND "locationId" IS NOT NULL AND "machineId" IS NULL) OR
  ("scope" = 'MACHINE' AND "unitId" IS NULL AND "locationId" IS NULL AND "machineId" IS NOT NULL) OR
  ("scope" IN ('ORGANIZATION', 'FINANCE') AND "unitId" IS NULL AND "locationId" IS NULL AND "machineId" IS NULL)
);
CREATE INDEX "OrganizationResponsibility_organizationId_scope_revokedAt_idx" ON "OrganizationResponsibility"("organizationId", "scope", "revokedAt");
CREATE INDEX "OrganizationResponsibility_memberId_revokedAt_idx" ON "OrganizationResponsibility"("memberId", "revokedAt");
CREATE INDEX "OrganizationResponsibility_machineId_revokedAt_idx" ON "OrganizationResponsibility"("machineId", "revokedAt");

ALTER TABLE "OrganizationUnit" ADD CONSTRAINT "OrganizationUnit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationUnit" ADD CONSTRAINT "OrganizationUnit_parentId_organizationId_fkey" FOREIGN KEY ("parentId", "organizationId") REFERENCES "OrganizationUnit"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_unitId_organizationId_fkey" FOREIGN KEY ("unitId", "organizationId") REFERENCES "OrganizationUnit"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganizationRoleAssignment" ADD CONSTRAINT "OrganizationRoleAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationRoleAssignment" ADD CONSTRAINT "OrganizationRoleAssignment_memberId_organizationId_fkey" FOREIGN KEY ("memberId", "organizationId") REFERENCES "OrganizationMember"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationLocation" ADD CONSTRAINT "OrganizationLocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationLocation" ADD CONSTRAINT "OrganizationLocation_responsibleUnitId_organizationId_fkey" FOREIGN KEY ("responsibleUnitId", "organizationId") REFERENCES "OrganizationUnit"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationLocation" ADD CONSTRAINT "OrganizationLocation_responsibleMemberId_organizationId_fkey" FOREIGN KEY ("responsibleMemberId", "organizationId") REFERENCES "OrganizationMember"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationMachineAssignment" ADD CONSTRAINT "OrganizationMachineAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationMachineAssignment" ADD CONSTRAINT "OrganizationMachineAssignment_ownerOrganizationId_fkey" FOREIGN KEY ("ownerOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationMachineAssignment" ADD CONSTRAINT "OrganizationMachineAssignment_operatorOrganizationId_fkey" FOREIGN KEY ("operatorOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationMachineAssignment" ADD CONSTRAINT "OrganizationMachineAssignment_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationMachineAssignment" ADD CONSTRAINT "OrganizationMachineAssignment_locationId_organizationId_fkey" FOREIGN KEY ("locationId", "organizationId") REFERENCES "OrganizationLocation"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationMachineAssignment" ADD CONSTRAINT "OrganizationMachineAssignment_responsibleMemberId_organizationId_fkey" FOREIGN KEY ("responsibleMemberId", "organizationId") REFERENCES "OrganizationMember"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationMachineAssignment" ADD CONSTRAINT "OrganizationMachineAssignment_serviceSpecialistId_organizationId_fkey" FOREIGN KEY ("serviceSpecialistId", "organizationId") REFERENCES "OrganizationMember"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationResponsibility" ADD CONSTRAINT "OrganizationResponsibility_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationResponsibility" ADD CONSTRAINT "OrganizationResponsibility_memberId_organizationId_fkey" FOREIGN KEY ("memberId", "organizationId") REFERENCES "OrganizationMember"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationResponsibility" ADD CONSTRAINT "OrganizationResponsibility_unitId_organizationId_fkey" FOREIGN KEY ("unitId", "organizationId") REFERENCES "OrganizationUnit"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationResponsibility" ADD CONSTRAINT "OrganizationResponsibility_locationId_organizationId_fkey" FOREIGN KEY ("locationId", "organizationId") REFERENCES "OrganizationLocation"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationResponsibility" ADD CONSTRAINT "OrganizationResponsibility_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
