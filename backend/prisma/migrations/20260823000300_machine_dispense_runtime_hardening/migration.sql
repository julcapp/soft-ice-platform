ALTER TYPE "MachineDispenseStatus" ADD VALUE IF NOT EXISTS 'DISPATCHING' AFTER 'QUEUED';

ALTER TABLE "MachineCallbackInbox" ADD COLUMN "payloadFingerprint" TEXT, ADD COLUMN "callbackStatus" TEXT;
UPDATE "MachineCallbackInbox" SET "payloadFingerprint" = md5("payloadSafe"::text), "callbackStatus" = COALESCE("payloadSafe"->>'status', 'UNKNOWN');
ALTER TABLE "MachineCallbackInbox" ALTER COLUMN "payloadFingerprint" SET NOT NULL, ALTER COLUMN "callbackStatus" SET NOT NULL;

DROP INDEX "MachineDispenseAttempt_provider_providerCommandId_idx";
CREATE UNIQUE INDEX "MachineDispenseAttempt_provider_providerCommandId_key" ON "MachineDispenseAttempt"("provider", "providerCommandId");
CREATE UNIQUE INDEX "MachineDispenseAttempt_organizationId_id_machineId_key" ON "MachineDispenseAttempt"("organizationId", "id", "machineId");
CREATE UNIQUE INDEX "OrgMachineAssignment_dispense_scope_key" ON "OrganizationMachineAssignment"("id", "organizationId", "machineId", "locationId");
CREATE UNIQUE INDEX "InventoryReservation_dispense_scope_key" ON "InventoryRuntimeReservation"("organizationId", "reservationId", "machineId", "locationId", "orderId", "saleFlowId");

ALTER TABLE "MachineCallbackInbox" DROP CONSTRAINT "MachineCallbackInbox_organizationId_dispenseAttemptId_fkey",
  ADD CONSTRAINT "MachineCallbackInbox_attempt_machine_fkey" FOREIGN KEY ("organizationId", "dispenseAttemptId", "machineId") REFERENCES "MachineDispenseAttempt"("organizationId", "id", "machineId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MachineDispenseAttempt" DROP CONSTRAINT "MachineDispenseAttempt_organizationId_inventoryReservation_fkey",
  ADD CONSTRAINT "MachineDispenseAttempt_inventory_ownership_fkey" FOREIGN KEY ("organizationId", "inventoryReservationId", "machineId", "locationId", "orderId", "saleFlowId") REFERENCES "InventoryRuntimeReservation"("organizationId", "reservationId", "machineId", "locationId", "orderId", "saleFlowId") ON DELETE RESTRICT ON UPDATE CASCADE;
