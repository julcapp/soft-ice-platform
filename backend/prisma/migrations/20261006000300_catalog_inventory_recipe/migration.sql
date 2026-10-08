CREATE TABLE "CatalogInventoryRecipeItem" (
    "id" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "ingredientType" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogInventoryRecipeItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogInventoryRecipeItem_catalogItemId_inventoryItemId_key"
ON "CatalogInventoryRecipeItem"("catalogItemId", "inventoryItemId");

CREATE INDEX "CatalogInventoryRecipeItem_catalogItemId_active_idx"
ON "CatalogInventoryRecipeItem"("catalogItemId", "active");

CREATE INDEX "CatalogInventoryRecipeItem_inventoryItemId_idx"
ON "CatalogInventoryRecipeItem"("inventoryItemId");

ALTER TABLE "CatalogInventoryRecipeItem"
ADD CONSTRAINT "CatalogInventoryRecipeItem_catalogItemId_fkey"
FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CatalogInventoryRecipeItem"
ADD CONSTRAINT "CatalogInventoryRecipeItem_inventoryItemId_fkey"
FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryRuntimeItem"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
