ALTER TABLE "MachineDispenseAttempt"
  ADD COLUMN "recoveryLockedAt" TIMESTAMP(3),
  ADD COLUMN "recoveryLockedBy" TEXT,
  ADD COLUMN "recoveryAttemptCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "MachineDispenseAttempt_recovery_claim_idx"
  ON "MachineDispenseAttempt"("status", "recoveryLockedAt", "updatedAt");

ALTER TABLE "MachineDispenseAttempt"
  DROP CONSTRAINT "MachineDispenseAttempt_inventory_ownership_fkey";

CREATE UNIQUE INDEX "InventoryReservation_machine_scope_key"
  ON "InventoryRuntimeReservation"("organizationId", "reservationId", "machineId", "locationId");

ALTER TABLE "MachineDispenseAttempt"
  ADD CONSTRAINT "MachineDispenseAttempt_inventory_ownership_fkey"
  FOREIGN KEY ("organizationId", "inventoryReservationId", "machineId", "locationId")
  REFERENCES "InventoryRuntimeReservation"("organizationId", "reservationId", "machineId", "locationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MachineDispenseAttempt" ADD CONSTRAINT "MachineDispenseAttempt_terminal_fact_check" CHECK (
  ("status" <> 'DISPENSED' OR ("completedAt" IS NOT NULL AND "failedAt" IS NULL))
  AND ("status" <> 'FAILED' OR ("failedAt" IS NOT NULL AND "completedAt" IS NULL))
  AND ("completedAt" IS NULL OR "failedAt" IS NULL)
);

ALTER TABLE "MachineReconciliation" ADD CONSTRAINT "MachineReconciliation_resolution_check" CHECK (
  ("status" = 'RESOLVED' AND "resolvedAt" IS NOT NULL AND "resolutionNote" IS NOT NULL)
  OR ("status" <> 'RESOLVED' AND "resolvedAt" IS NULL)
);
