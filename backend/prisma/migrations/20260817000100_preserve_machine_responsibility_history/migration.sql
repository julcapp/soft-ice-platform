-- Machine-scoped responsibility history must retain its machine target.
-- SET NULL conflicts with OrganizationResponsibility_scope_target_check.

ALTER TABLE "OrganizationResponsibility"
  DROP CONSTRAINT "OrganizationResponsibility_machineId_fkey";

ALTER TABLE "OrganizationResponsibility"
  ADD CONSTRAINT "OrganizationResponsibility_machineId_fkey"
  FOREIGN KEY ("machineId") REFERENCES "Machine"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
