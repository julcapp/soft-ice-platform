CREATE TYPE "InventoryRuntimeItemCategory" AS ENUM ('INGREDIENT', 'CONSUMABLE', 'SERVICE_MATERIAL');
CREATE TYPE "InventoryRuntimeLocationType" AS ENUM ('WAREHOUSE', 'MACHINE');
CREATE TYPE "InventoryRuntimeMovementType" AS ENUM ('RECEIPT', 'CONSUMPTION', 'TEST_CONSUMPTION', 'MAINTENANCE', 'INVENTORY_COUNT', 'ADJUSTMENT');
CREATE TYPE "InventoryRuntimeReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONSUMED', 'EXPIRED');

CREATE TABLE "InventoryRuntimeItem" (
  "id" TEXT NOT NULL, "sku" TEXT NOT NULL, "name" TEXT NOT NULL,
  "category" "InventoryRuntimeItemCategory" NOT NULL, "baseUnit" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryRuntimeItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InventoryRuntimeItem_sku_key" ON "InventoryRuntimeItem"("sku");

CREATE TABLE "InventoryRuntimeLocation" (
  "id" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "locationType" "InventoryRuntimeLocationType" NOT NULL, "machineId" TEXT, "warehouseId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryRuntimeLocation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InventoryRuntimeLocation_code_key" ON "InventoryRuntimeLocation"("code");
CREATE INDEX "InventoryRuntimeLocation_locationType_active_idx" ON "InventoryRuntimeLocation"("locationType", "active");
CREATE INDEX "InventoryRuntimeLocation_machineId_idx" ON "InventoryRuntimeLocation"("machineId");
CREATE INDEX "InventoryRuntimeLocation_warehouseId_idx" ON "InventoryRuntimeLocation"("warehouseId");

CREATE TABLE "InventoryRuntimeMovement" (
  "id" TEXT NOT NULL, "itemId" TEXT NOT NULL, "locationId" TEXT NOT NULL,
  "movementType" "InventoryRuntimeMovementType" NOT NULL, "quantity" DOUBLE PRECISION NOT NULL,
  "delta" DOUBLE PRECISION NOT NULL, "unit" TEXT NOT NULL, "reason" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL, "sourceId" TEXT, "sourceEventId" TEXT, "actorType" TEXT NOT NULL,
  "actorId" TEXT NOT NULL, "correlationId" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL, "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "metadata" JSONB,
  CONSTRAINT "InventoryRuntimeMovement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InventoryRuntimeMovement_sourceEventId_key" ON "InventoryRuntimeMovement"("sourceEventId");
CREATE UNIQUE INDEX "InventoryRuntimeMovement_idempotencyKey_key" ON "InventoryRuntimeMovement"("idempotencyKey");
CREATE INDEX "InventoryRuntimeMovement_itemId_locationId_occurredAt_idx" ON "InventoryRuntimeMovement"("itemId", "locationId", "occurredAt");
CREATE INDEX "InventoryRuntimeMovement_sourceType_sourceId_idx" ON "InventoryRuntimeMovement"("sourceType", "sourceId");
CREATE INDEX "InventoryRuntimeMovement_correlationId_idx" ON "InventoryRuntimeMovement"("correlationId");

CREATE TABLE "InventoryRuntimeReservation" (
  "id" TEXT NOT NULL, "itemId" TEXT NOT NULL, "locationId" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL, "unit" TEXT NOT NULL,
  "status" "InventoryRuntimeReservationStatus" NOT NULL DEFAULT 'ACTIVE', "purpose" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL, "sourceId" TEXT, "actorType" TEXT NOT NULL, "actorId" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL, "expiresAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "InventoryRuntimeReservation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InventoryRuntimeReservation_idempotencyKey_key" ON "InventoryRuntimeReservation"("idempotencyKey");
CREATE INDEX "InventoryRuntimeReservation_itemId_locationId_status_idx" ON "InventoryRuntimeReservation"("itemId", "locationId", "status");
CREATE INDEX "InventoryRuntimeReservation_sourceType_sourceId_idx" ON "InventoryRuntimeReservation"("sourceType", "sourceId");
CREATE INDEX "InventoryRuntimeReservation_expiresAt_status_idx" ON "InventoryRuntimeReservation"("expiresAt", "status");

ALTER TABLE "InventoryRuntimeMovement" ADD CONSTRAINT "InventoryRuntimeMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryRuntimeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryRuntimeMovement" ADD CONSTRAINT "InventoryRuntimeMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryRuntimeLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryRuntimeReservation" ADD CONSTRAINT "InventoryRuntimeReservation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryRuntimeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryRuntimeReservation" ADD CONSTRAINT "InventoryRuntimeReservation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryRuntimeLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
