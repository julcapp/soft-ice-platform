-- Catalog and machine availability reconciliation for issue #17.
-- This migration is intentionally additive: production may already contain
-- manually-created CatalogItem and MachineCatalogItem tables.

DO $$ BEGIN
  CREATE TYPE "CatalogCategory" AS ENUM ('ICE_CREAM', 'SPRINKLE', 'TOPPING');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CatalogItem" (
  "id" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "category" "CatalogCategory" NOT NULL,
  "nameRu" TEXT NOT NULL,
  "descriptionRu" TEXT,
  "basePrice" DECIMAL(12,2),
  "currency" TEXT NOT NULL DEFAULT 'RUB',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "systemItem" BOOLEAN NOT NULL DEFAULT false,
  "freeItem" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "mediaPath" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "sku" TEXT;
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "category" "CatalogCategory";
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "nameRu" TEXT;
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "descriptionRu" TEXT;
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "basePrice" DECIMAL(12,2);
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'RUB';
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "active" BOOLEAN DEFAULT true;
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "systemItem" BOOLEAN DEFAULT false;
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "freeItem" BOOLEAN DEFAULT false;
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER DEFAULT 0;
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "mediaPath" TEXT;
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CatalogItem" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "MachineCatalogItem" (
  "id" TEXT NOT NULL,
  "machineId" TEXT NOT NULL,
  "catalogItemId" TEXT NOT NULL,
  "available" BOOLEAN NOT NULL DEFAULT true,
  "isCurrentFlavor" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MachineCatalogItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MachineCatalogItem" ADD COLUMN IF NOT EXISTS "machineId" TEXT;
ALTER TABLE "MachineCatalogItem" ADD COLUMN IF NOT EXISTS "catalogItemId" TEXT;
ALTER TABLE "MachineCatalogItem" ADD COLUMN IF NOT EXISTS "available" BOOLEAN DEFAULT true;
ALTER TABLE "MachineCatalogItem" ADD COLUMN IF NOT EXISTS "isCurrentFlavor" BOOLEAN DEFAULT false;
ALTER TABLE "MachineCatalogItem" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "MachineCatalogItem" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Fail safely rather than inventing business data when pre-existing drift has
-- incomplete required values. Defaults can be reconciled without data loss.
UPDATE "CatalogItem" SET "currency" = 'RUB' WHERE "currency" IS NULL;
UPDATE "CatalogItem" SET "active" = true WHERE "active" IS NULL;
UPDATE "CatalogItem" SET "systemItem" = false WHERE "systemItem" IS NULL;
UPDATE "CatalogItem" SET "freeItem" = false WHERE "freeItem" IS NULL;
UPDATE "CatalogItem" SET "sortOrder" = 0 WHERE "sortOrder" IS NULL;
UPDATE "CatalogItem" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "CatalogItem" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
UPDATE "MachineCatalogItem" SET "available" = true WHERE "available" IS NULL;
UPDATE "MachineCatalogItem" SET "isCurrentFlavor" = false WHERE "isCurrentFlavor" IS NULL;
UPDATE "MachineCatalogItem" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "MachineCatalogItem" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;

ALTER TABLE "CatalogItem" ALTER COLUMN "currency" SET NOT NULL;
ALTER TABLE "CatalogItem" ALTER COLUMN "sku" SET NOT NULL;
ALTER TABLE "CatalogItem" ALTER COLUMN "category" SET NOT NULL;
ALTER TABLE "CatalogItem" ALTER COLUMN "nameRu" SET NOT NULL;
ALTER TABLE "CatalogItem" ALTER COLUMN "active" SET NOT NULL;
ALTER TABLE "CatalogItem" ALTER COLUMN "systemItem" SET NOT NULL;
ALTER TABLE "CatalogItem" ALTER COLUMN "freeItem" SET NOT NULL;
ALTER TABLE "CatalogItem" ALTER COLUMN "sortOrder" SET NOT NULL;
ALTER TABLE "CatalogItem" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "CatalogItem" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "MachineCatalogItem" ALTER COLUMN "available" SET NOT NULL;
ALTER TABLE "MachineCatalogItem" ALTER COLUMN "machineId" SET NOT NULL;
ALTER TABLE "MachineCatalogItem" ALTER COLUMN "catalogItemId" SET NOT NULL;
ALTER TABLE "MachineCatalogItem" ALTER COLUMN "isCurrentFlavor" SET NOT NULL;
ALTER TABLE "MachineCatalogItem" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "MachineCatalogItem" ALTER COLUMN "updatedAt" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "CatalogItem_sku_key" ON "CatalogItem"("sku");
CREATE INDEX IF NOT EXISTS "CatalogItem_category_active_sortOrder_idx" ON "CatalogItem"("category", "active", "sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "MachineCatalogItem_machineId_catalogItemId_key" ON "MachineCatalogItem"("machineId", "catalogItemId");
CREATE INDEX IF NOT EXISTS "MachineCatalogItem_machineId_available_idx" ON "MachineCatalogItem"("machineId", "available");
CREATE UNIQUE INDEX IF NOT EXISTS "MachineCatalogItem_one_current_flavor_idx"
  ON "MachineCatalogItem"("machineId") WHERE "isCurrentFlavor" = true;

DO $$ BEGIN
  ALTER TABLE "CatalogItem" ADD CONSTRAINT "catalog_item_nonnegative_price" CHECK ("basePrice" IS NULL OR "basePrice" >= 0) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CatalogItem" ADD CONSTRAINT "catalog_item_active_price_required" CHECK (NOT "active" OR "basePrice" IS NOT NULL) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CatalogItem" ADD CONSTRAINT "catalog_item_zero_price_requires_reason" CHECK ("basePrice" IS NULL OR "basePrice" <> 0 OR "systemItem" OR "freeItem") NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CatalogItem" ADD CONSTRAINT "catalog_item_system_price_is_zero" CHECK (NOT "systemItem" OR "basePrice" = 0) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MachineCatalogItem" ADD CONSTRAINT "MachineCatalogItem_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MachineCatalogItem" ADD CONSTRAINT "MachineCatalogItem_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Canonical no-option records are reconciled by stable SKU. These rows make
-- the zero price explicit; assignment to a machine remains an audited admin
-- action and is intentionally not invented by the migration.
INSERT INTO "CatalogItem" (
  "id", "sku", "category", "nameRu", "basePrice", "currency",
  "active", "systemItem", "freeItem", "sortOrder", "createdAt", "updatedAt"
) VALUES
  ('catalog_sprinkle_none', 'sprinkle_none', 'SPRINKLE', 'Без посыпки', 0, 'RUB', true, true, false, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('catalog_topping_none', 'topping_none', 'TOPPING', 'Без топпинга', 0, 'RUB', true, true, false, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("sku") DO UPDATE SET
  "category" = EXCLUDED."category",
  "nameRu" = EXCLUDED."nameRu",
  "basePrice" = 0,
  "currency" = 'RUB',
  "active" = true,
  "systemItem" = true,
  "freeItem" = false,
  "updatedAt" = CURRENT_TIMESTAMP;
