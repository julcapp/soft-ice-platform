BEGIN;

CREATE TYPE "InventoryReservationItemStatus" AS ENUM ('PENDING','RESERVED','CONSUMED','RELEASED','EXPIRED','FAILED');
CREATE TYPE "InventoryOperationType" AS ENUM ('CUSTOMER_SALE','OPERATOR_TEST','MAINTENANCE_TEST');
ALTER TYPE "InventoryRuntimeReservationStatus" RENAME TO "InventoryRuntimeReservationStatus_old";
CREATE TYPE "InventoryRuntimeReservationStatus" AS ENUM ('PENDING','RESERVED','CONSUMED','RELEASED','EXPIRED','FAILED');
ALTER TABLE "InventoryRuntimeReservation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "InventoryRuntimeReservation" ALTER COLUMN "status" TYPE "InventoryRuntimeReservationStatus" USING (CASE WHEN "status"::text='ACTIVE' THEN 'RESERVED' ELSE "status"::text END)::"InventoryRuntimeReservationStatus";
DROP TYPE "InventoryRuntimeReservationStatus_old";

ALTER TABLE "InventoryRuntimeReservation" ADD COLUMN "reservationId" TEXT, ADD COLUMN "saleFlowId" TEXT, ADD COLUMN "orderId" TEXT, ADD COLUMN "machineId" TEXT, ADD COLUMN "organizationId" TEXT,
ADD COLUMN "operationType" "InventoryOperationType" NOT NULL DEFAULT 'CUSTOMER_SALE', ADD COLUMN "confirmedAt" TIMESTAMP(3), ADD COLUMN "releasedAt" TIMESTAMP(3), ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "reason" TEXT, ADD COLUMN "metadata" JSONB;

-- Derive ownership only from existing active Organization 360 assignments.
-- Missing or ambiguous ownership stops the migration for manual reconciliation.
UPDATE "InventoryRuntimeReservation" r SET "reservationId"=(
  SELECT min(candidate."id")
  FROM "InventoryRuntimeReservation" candidate
  WHERE candidate."locationId"=r."locationId"
    AND candidate."sourceType"=r."sourceType"
    AND candidate."sourceId" IS NOT DISTINCT FROM r."sourceId"
    AND (r."sourceId" IS NOT NULL OR candidate."id"=r."id")
), "machineId"=l."machineId", "organizationId"=a."organizationId",
"expiresAt"=COALESCE(r."expiresAt",r."updatedAt"), "confirmedAt"=CASE WHEN r."status"='CONSUMED' THEN r."completedAt" END,
"releasedAt"=CASE WHEN r."status" IN ('RELEASED','EXPIRED') THEN r."completedAt" END, "reason"=r."purpose",
"metadata"=jsonb_build_object('legacy',true,'sourceType',r."sourceType",'sourceId',r."sourceId",'purpose',r."purpose")
FROM "InventoryRuntimeLocation" l
JOIN "OrganizationMachineAssignment" a ON a."machineId"=l."machineId" AND a."unassignedAt" IS NULL
WHERE r."locationId"=l."id" AND (SELECT count(*) FROM "OrganizationMachineAssignment" ax WHERE ax."machineId"=l."machineId" AND ax."unassignedAt" IS NULL)=1;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM "InventoryRuntimeReservation" WHERE "machineId" IS NULL OR "organizationId" IS NULL) THEN RAISE EXCEPTION 'INVENTORY_LEGACY_RESERVATION_RECONCILIATION_REQUIRED'; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM "InventoryRuntimeReservation" r JOIN "InventoryRuntimeReservation" sibling ON sibling."reservationId"=r."reservationId" AND sibling."id"<>r."id" WHERE sibling."status"<>r."status" OR sibling."actorType"<>r."actorType" OR sibling."actorId"<>r."actorId" OR sibling."correlationId"<>r."correlationId") THEN RAISE EXCEPTION 'INVENTORY_LEGACY_RESERVATION_INCONSISTENT_GROUP'; END IF; END $$;

CREATE TABLE "InventoryRuntimeReservationItem" ("id" TEXT NOT NULL,"reservationId" TEXT NOT NULL,"inventoryItemId" TEXT NOT NULL,"ingredientType" TEXT NOT NULL,"quantity" DOUBLE PRECISION NOT NULL,"unit" TEXT NOT NULL,"status" "InventoryReservationItemStatus" NOT NULL DEFAULT 'PENDING',"reservedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,"consumedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,"releasedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "InventoryRuntimeReservationItem_pkey" PRIMARY KEY ("id"),CONSTRAINT "InventoryRuntimeReservationItem_quantity_consistency" CHECK ("quantity">0 AND "quantity"<'Infinity'::double precision AND "reservedQuantity">=0 AND "reservedQuantity"<'Infinity'::double precision AND "reservedQuantity"<="quantity" AND "consumedQuantity">=0 AND "consumedQuantity"<'Infinity'::double precision AND "releasedQuantity">=0 AND "releasedQuantity"<'Infinity'::double precision AND "consumedQuantity"+"releasedQuantity"<="reservedQuantity"));
INSERT INTO "InventoryRuntimeReservationItem" ("id","reservationId","inventoryItemId","ingredientType","quantity","unit","status","reservedQuantity","consumedQuantity","releasedQuantity","createdAt","updatedAt")
SELECT r."id"||':legacy-item',r."reservationId",r."itemId",i."category"::text,r."quantity",r."unit",r."status"::text::"InventoryReservationItemStatus",
CASE WHEN r."status" IN ('RESERVED','CONSUMED','RELEASED','EXPIRED') THEN r."quantity" ELSE 0 END,CASE WHEN r."status"='CONSUMED' THEN r."quantity" ELSE 0 END,CASE WHEN r."status" IN ('RELEASED','EXPIRED') THEN r."quantity" ELSE 0 END,r."createdAt",r."updatedAt"
FROM "InventoryRuntimeReservation" r JOIN "InventoryRuntimeItem" i ON i."id"=r."itemId";
DO $$ BEGIN IF (SELECT count(*) FROM "InventoryRuntimeReservationItem")<>(SELECT count(*) FROM "InventoryRuntimeReservation") THEN RAISE EXCEPTION 'INVENTORY_LEGACY_RESERVATION_ITEM_LOSS'; END IF; END $$;

DELETE FROM "InventoryRuntimeReservation" r WHERE r."id"<>r."reservationId";
DO $$ BEGIN IF EXISTS (SELECT 1 FROM "InventoryRuntimeReservationItem" i LEFT JOIN "InventoryRuntimeReservation" r ON r."reservationId"=i."reservationId" WHERE r."id" IS NULL) OR EXISTS (SELECT 1 FROM "InventoryRuntimeReservation" r LEFT JOIN "InventoryRuntimeReservationItem" i ON i."reservationId"=r."reservationId" WHERE i."id" IS NULL) THEN RAISE EXCEPTION 'INVENTORY_LEGACY_RESERVATION_ITEM_LOSS'; END IF; END $$;

ALTER TABLE "InventoryRuntimeReservation" DROP CONSTRAINT "InventoryRuntimeReservation_itemId_fkey";
DROP INDEX IF EXISTS "InventoryRuntimeReservation_itemId_locationId_status_idx";
DROP INDEX IF EXISTS "InventoryRuntimeReservation_sourceType_sourceId_idx";
ALTER TABLE "InventoryRuntimeReservation" DROP COLUMN "itemId",DROP COLUMN "quantity",DROP COLUMN "unit",DROP COLUMN "purpose",DROP COLUMN "sourceType",DROP COLUMN "sourceId",DROP COLUMN "completedAt";
ALTER TABLE "InventoryRuntimeReservation" ALTER COLUMN "reservationId" SET NOT NULL,ALTER COLUMN "machineId" SET NOT NULL,ALTER COLUMN "organizationId" SET NOT NULL,ALTER COLUMN "expiresAt" SET NOT NULL,ALTER COLUMN "status" SET DEFAULT 'PENDING';
CREATE UNIQUE INDEX "InventoryRuntimeReservation_reservationId_key" ON "InventoryRuntimeReservation"("reservationId");
CREATE INDEX "InventoryRuntimeReservation_organizationId_status_createdAt_idx" ON "InventoryRuntimeReservation"("organizationId","status","createdAt");
CREATE INDEX "InventoryRuntimeReservation_machineId_status_idx" ON "InventoryRuntimeReservation"("machineId","status");
CREATE INDEX "InventoryRuntimeReservation_locationId_status_idx" ON "InventoryRuntimeReservation"("locationId","status");
CREATE INDEX "InventoryRuntimeReservation_saleFlowId_idx" ON "InventoryRuntimeReservation"("saleFlowId");
CREATE INDEX "InventoryRuntimeReservation_orderId_idx" ON "InventoryRuntimeReservation"("orderId");
CREATE UNIQUE INDEX "InventoryRuntimeReservation_one_active_sale_flow" ON "InventoryRuntimeReservation"("saleFlowId") WHERE "saleFlowId" IS NOT NULL AND "status" IN ('PENDING','RESERVED');
CREATE UNIQUE INDEX "InventoryRuntimeReservationItem_reservationId_inventoryItem_key" ON "InventoryRuntimeReservationItem"("reservationId","inventoryItemId");
CREATE INDEX "InventoryRuntimeReservationItem_inventoryItemId_status_idx" ON "InventoryRuntimeReservationItem"("inventoryItemId","status");
ALTER TABLE "InventoryRuntimeReservationItem" ADD CONSTRAINT "InventoryRuntimeReservationItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "InventoryRuntimeReservation"("reservationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryRuntimeReservationItem" ADD CONSTRAINT "InventoryRuntimeReservationItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryRuntimeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "InventoryRuntimeStock" ("id" TEXT NOT NULL,"organizationId" TEXT NOT NULL,"machineId" TEXT NOT NULL,"locationId" TEXT NOT NULL,"inventoryItemId" TEXT NOT NULL,"physicalQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,"activeReservedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,"lowStockThreshold" DOUBLE PRECISION,"version" INTEGER NOT NULL DEFAULT 0,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "InventoryRuntimeStock_pkey" PRIMARY KEY ("id"),CONSTRAINT "InventoryRuntimeStock_non_negative" CHECK ("physicalQuantity">=0 AND "activeReservedQuantity">=0 AND "activeReservedQuantity"<="physicalQuantity"));
CREATE UNIQUE INDEX "InventoryRuntimeStock_organizationId_machineId_locationId_i_key" ON "InventoryRuntimeStock"("organizationId","machineId","locationId","inventoryItemId");
CREATE INDEX "InventoryRuntimeStock_organizationId_locationId_idx" ON "InventoryRuntimeStock"("organizationId","locationId");
CREATE INDEX "InventoryRuntimeStock_machineId_inventoryItemId_idx" ON "InventoryRuntimeStock"("machineId","inventoryItemId");
ALTER TABLE "InventoryRuntimeStock" ADD CONSTRAINT "InventoryRuntimeStock_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryRuntimeLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryRuntimeStock" ADD CONSTRAINT "InventoryRuntimeStock_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryRuntimeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
