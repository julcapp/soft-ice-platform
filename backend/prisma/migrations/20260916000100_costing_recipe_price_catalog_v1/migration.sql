-- Costing / recipe / published machine catalog foundation v1
-- InventoryRuntimeItem remains the source of truth for ingredients and consumables.
-- Purchase cost changes NEVER mutate published retail prices automatically.

CREATE TYPE "CommercialRecordStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "PriceListStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "PriceScopeType" AS ENUM ('NETWORK', 'ORGANIZATION', 'LOCATION', 'MACHINE');
CREATE TYPE "CatalogPublicationStatus" AS ENUM ('PUBLISHED', 'REVOKED');

CREATE TABLE "InventoryItemPurchaseCost" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "supplierName" TEXT,
    "supplierSku" TEXT,
    "packageQuantity" DECIMAL(14,4) NOT NULL,
    "packageUnit" TEXT NOT NULL,
    "packagePrice" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "unitCost" DECIMAL(16,6) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" "CommercialRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InventoryItemPurchaseCost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductRecipe" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "saleSku" TEXT NOT NULL,
    "status" "CommercialRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "wastePercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductRecipe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductRecipeItem" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductRecipeItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RetailPriceList" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "status" "PriceListStatus" NOT NULL DEFAULT 'DRAFT',
    "scopeType" "PriceScopeType" NOT NULL DEFAULT 'NETWORK',
    "scopeId" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "publishedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RetailPriceList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RetailPriceItem" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "saleSku" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "retailPrice" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RetailPriceItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MachineCatalogPublication" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "catalogVersion" INTEGER NOT NULL,
    "status" "CatalogPublicationStatus" NOT NULL DEFAULT 'PUBLISHED',
    "catalogPayload" JSONB NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "MachineCatalogPublication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductRecipe_code_version_key" ON "ProductRecipe"("code", "version");
CREATE INDEX "ProductRecipe_saleSku_status_idx" ON "ProductRecipe"("saleSku", "status");
CREATE UNIQUE INDEX "ProductRecipeItem_recipeId_inventoryItemId_key" ON "ProductRecipeItem"("recipeId", "inventoryItemId");
CREATE INDEX "InventoryItemPurchaseCost_item_effective_idx" ON "InventoryItemPurchaseCost"("inventoryItemId", "effectiveFrom");
CREATE UNIQUE INDEX "RetailPriceList_code_version_key" ON "RetailPriceList"("code", "version");
CREATE INDEX "RetailPriceList_scope_status_idx" ON "RetailPriceList"("scopeType", "scopeId", "status");
CREATE UNIQUE INDEX "RetailPriceItem_priceListId_saleSku_key" ON "RetailPriceItem"("priceListId", "saleSku");
CREATE UNIQUE INDEX "MachineCatalogPublication_machine_version_key" ON "MachineCatalogPublication"("machineId", "catalogVersion");
CREATE INDEX "MachineCatalogPublication_machine_status_published_idx" ON "MachineCatalogPublication"("machineId", "status", "publishedAt");

ALTER TABLE "InventoryItemPurchaseCost" ADD CONSTRAINT "InventoryItemPurchaseCost_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryRuntimeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductRecipeItem" ADD CONSTRAINT "ProductRecipeItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "ProductRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductRecipeItem" ADD CONSTRAINT "ProductRecipeItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryRuntimeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetailPriceItem" ADD CONSTRAINT "RetailPriceItem_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "RetailPriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MachineCatalogPublication" ADD CONSTRAINT "MachineCatalogPublication_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MachineCatalogPublication" ADD CONSTRAINT "MachineCatalogPublication_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "RetailPriceList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariants enforced at DB level where possible.
ALTER TABLE "InventoryItemPurchaseCost" ADD CONSTRAINT "purchase_cost_positive_package_qty" CHECK ("packageQuantity" > 0);
ALTER TABLE "InventoryItemPurchaseCost" ADD CONSTRAINT "purchase_cost_nonnegative_price" CHECK ("packagePrice" >= 0 AND "unitCost" >= 0);
ALTER TABLE "ProductRecipeItem" ADD CONSTRAINT "recipe_item_positive_quantity" CHECK ("quantity" > 0);
ALTER TABLE "ProductRecipe" ADD CONSTRAINT "recipe_waste_percent_range" CHECK ("wastePercent" >= 0 AND "wastePercent" < 100);
ALTER TABLE "RetailPriceItem" ADD CONSTRAINT "retail_price_nonnegative" CHECK ("retailPrice" >= 0);
