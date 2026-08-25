ALTER TABLE "MachineDispenseAttempt"
  ADD COLUMN "requestedByActorType" TEXT,
  ADD COLUMN "requestedByActorId" TEXT,
  ADD COLUMN "operationReason" TEXT,
  ADD COLUMN "serviceContextSafe" JSONB,
  ALTER COLUMN "orderId" DROP NOT NULL,
  ALTER COLUMN "saleFlowId" DROP NOT NULL;

ALTER TABLE "MachineDispenseAttempt" DROP CONSTRAINT "MachineDispenseAttempt_inventory_ownership_fkey";
ALTER TABLE "MachineDispenseAttempt" ADD CONSTRAINT "MachineDispenseAttempt_inventory_ownership_fkey"
  FOREIGN KEY ("organizationId", "inventoryReservationId")
  REFERENCES "InventoryRuntimeReservation"("organizationId", "reservationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MachineDispenseAttempt" ADD CONSTRAINT "MachineDispenseAttempt_operation_scope_check" CHECK (
  ("operationType" = 'CUSTOMER_SALE' AND "orderId" IS NOT NULL AND "saleFlowId" IS NOT NULL)
  OR
  ("operationType" IN ('OPERATOR_TEST','MAINTENANCE_TEST') AND "orderId" IS NULL AND "saleFlowId" IS NULL
    AND "requestedByActorId" IS NOT NULL AND "operationReason" IS NOT NULL)
);
