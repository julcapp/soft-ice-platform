\set ON_ERROR_STOP on

-- Synthetic, production-shaped pre-target drift for local rehearsal only.
-- The canonical migration chain before 20260923000100 must already be applied.

DO $$ BEGIN
  CREATE TYPE "CatalogCategory" AS ENUM ('ICE_CREAM', 'SPRINKLE', 'TOPPING');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "CatalogItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sku" TEXT NOT NULL,
  "category" "CatalogCategory" NOT NULL,
  "nameRu" TEXT NOT NULL,
  "basePrice" DECIMAL(12,2),
  "currency" TEXT,
  "active" BOOLEAN,
  "systemItem" BOOLEAN,
  "freeItem" BOOLEAN
);

CREATE TABLE "MachineCatalogItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "machineId" TEXT NOT NULL,
  "catalogItemId" TEXT NOT NULL,
  "available" BOOLEAN,
  "isCurrentFlavor" BOOLEAN
);

INSERT INTO "Machine" ("id", "machineCode", "name", "status", "createdAt", "updatedAt") VALUES
  ('rehearsal-machine-a', 'REHEARSAL-A', 'Rehearsal machine A', 'ONLINE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rehearsal-machine-b', 'REHEARSAL-B', 'Rehearsal machine B', 'ONLINE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "CatalogItem" (
  "id", "sku", "category", "nameRu", "basePrice", "currency", "active", "systemItem", "freeItem"
) VALUES
  ('rehearsal-flavor-vanilla', 'flavor_vanilla_rehearsal', 'ICE_CREAM', 'Ваниль rehearsal', 150, 'RUB', true, false, false),
  ('rehearsal-flavor-chocolate', 'flavor_chocolate_rehearsal', 'ICE_CREAM', 'Шоколад rehearsal', 165, 'RUB', true, false, false),
  ('rehearsal-sprinkle-paid', 'sprinkle_paid_rehearsal', 'SPRINKLE', 'Посыпка rehearsal', 15, 'RUB', true, false, false),
  ('rehearsal-topping-paid', 'topping_paid_rehearsal', 'TOPPING', 'Топпинг rehearsal', 25, 'RUB', true, false, false),
  ('rehearsal-null-price', 'topping_null_rehearsal', 'TOPPING', 'Неактивная позиция без цены', NULL, 'RUB', false, false, false),
  ('rehearsal-sprinkle-none-drift', 'sprinkle_none', 'SPRINKLE', 'Legacy no sprinkle', 9, 'USD', false, false, false),
  ('rehearsal-topping-none-drift', 'topping_none', 'TOPPING', 'Legacy no topping', NULL, NULL, NULL, NULL, NULL);

INSERT INTO "MachineCatalogItem" (
  "id", "machineId", "catalogItemId", "available", "isCurrentFlavor"
) VALUES
  ('rehearsal-a-vanilla', 'rehearsal-machine-a', 'rehearsal-flavor-vanilla', true, true),
  ('rehearsal-a-sprinkle', 'rehearsal-machine-a', 'rehearsal-sprinkle-paid', true, false),
  ('rehearsal-a-topping', 'rehearsal-machine-a', 'rehearsal-topping-paid', true, false),
  ('rehearsal-b-chocolate', 'rehearsal-machine-b', 'rehearsal-flavor-chocolate', true, true),
  ('rehearsal-b-sprinkle', 'rehearsal-machine-b', 'rehearsal-sprinkle-paid', true, false),
  ('rehearsal-b-topping', 'rehearsal-machine-b', 'rehearsal-topping-paid', true, false);

INSERT INTO "PricingQuote" (
  "id", "machineId", "channel", "currency", "baseAmount", "giftAmount",
  "promotionDiscountAmount", "finalAmount", "bonusPaymentAllowed",
  "partialBonusPaymentAllowed", "transferAllowed", "paymentRequired",
  "createdAt", "lockedUntil", "metadata"
) VALUES (
  'rehearsal-historical-quote', 'rehearsal-machine-a', 'TERMINAL', 'RUB', 190, 0,
  19, 171, true, true, true, true,
  '2026-09-22T10:00:00Z', '2026-09-22T10:05:00Z', '{"fixture":"pre-target"}'::jsonb
);

INSERT INTO "PricingSnapshot" (
  "id", "quoteId", "currency", "baseAmount", "giftAmount",
  "promotionDiscountAmount", "bonusAmount", "finalAmount",
  "pricingRuleVersion", "createdAt", "lockedUntil", "rules", "metadata"
) VALUES (
  'rehearsal-historical-snapshot', 'rehearsal-historical-quote', 'RUB', 190, 0,
  19, 0, 171, 'pricing-v1', '2026-09-22T10:00:00Z', '2026-09-22T10:05:00Z',
  '{"promotion":"fixture-10-percent"}'::jsonb, '{"fixture":"pre-target"}'::jsonb
);

INSERT INTO "PricingSnapshotItem" (
  "id", "pricingSnapshotId", "itemId", "sku", "name", "quantity",
  "baseAmount", "giftAmount", "promotionDiscountAmount", "finalAmount", "giftApplied", "metadata"
) VALUES
  ('rehearsal-historical-item-flavor', 'rehearsal-historical-snapshot', 'rehearsal-flavor-vanilla', 'flavor_vanilla_rehearsal', 'Ваниль rehearsal', 1, 150, 0, 15, 135, false, '{"fixture":"pre-target"}'::jsonb),
  ('rehearsal-historical-item-addon', 'rehearsal-historical-snapshot', 'rehearsal-topping-paid', 'topping_paid_rehearsal', 'Топпинг rehearsal', 1, 25, 0, 2.5, 22.5, false, '{"fixture":"pre-target"}'::jsonb),
  ('rehearsal-historical-item-sprinkle', 'rehearsal-historical-snapshot', 'rehearsal-sprinkle-paid', 'sprinkle_paid_rehearsal', 'Посыпка rehearsal', 1, 15, 0, 1.5, 13.5, false, '{"fixture":"pre-target"}'::jsonb);
