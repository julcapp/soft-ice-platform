\set ON_ERROR_STOP on

DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT count(*) INTO invalid_count
  FROM "CatalogItem"
  WHERE "sku" IN ('sprinkle_none', 'topping_none')
    AND NOT (
      "basePrice" = 0
      AND "currency" = 'RUB'
      AND "active" = true
      AND "systemItem" = true
      AND "freeItem" = false
    );
  IF invalid_count <> 0 THEN
    RAISE EXCEPTION 'protected no-option rows were not reconciled';
  END IF;

  IF (SELECT count(*) FROM "CatalogItem" WHERE "sku" IN ('sprinkle_none', 'topping_none')) <> 2 THEN
    RAISE EXCEPTION 'protected no-option rows are missing or duplicated';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "MachineCatalogItem" assignment
    JOIN "CatalogItem" item ON item."id" = assignment."catalogItemId"
    WHERE assignment."isCurrentFlavor" = true
      AND (item."category" <> 'ICE_CREAM' OR item."active" = false OR item."basePrice" IS NULL)
  ) THEN
    RAISE EXCEPTION 'invalid current flavor assignment remains';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "MachineCatalogItem"
    WHERE "isCurrentFlavor" = true
    GROUP BY "machineId"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'a machine has more than one current flavor';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename = 'MachineCatalogItem'
      AND indexname = 'MachineCatalogItem_one_current_flavor_idx'
  ) THEN
    RAISE EXCEPTION 'one-current-flavor unique index is missing';
  END IF;
END $$;

-- Prove the validated constraints reject new invalid data without retaining it.
DO $$
BEGIN
  BEGIN
    INSERT INTO "CatalogItem" (
      "id", "sku", "category", "nameRu", "basePrice", "currency",
      "active", "systemItem", "freeItem", "sortOrder", "createdAt", "updatedAt"
    ) VALUES (
      'rehearsal-invalid-null', 'rehearsal_invalid_null', 'TOPPING', 'Invalid null', NULL, 'RUB',
      true, false, false, 9999, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );
    RAISE EXCEPTION 'active null price unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "CatalogItem" (
      "id", "sku", "category", "nameRu", "basePrice", "currency",
      "active", "systemItem", "freeItem", "sortOrder", "createdAt", "updatedAt"
    ) VALUES (
      'rehearsal-invalid-zero', 'rehearsal_invalid_zero', 'TOPPING', 'Invalid zero', 0, 'RUB',
      true, false, false, 9999, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );
    RAISE EXCEPTION 'unmarked zero price unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END $$;

SELECT
  con.conname AS constraint_name,
  con.convalidated AS validated,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname IN ('CatalogItem', 'MachineCatalogItem')
ORDER BY rel.relname, con.conname;

SELECT
  assignment."machineId",
  item."sku" AS current_flavor_sku
FROM "MachineCatalogItem" assignment
JOIN "CatalogItem" item ON item."id" = assignment."catalogItemId"
WHERE assignment."isCurrentFlavor" = true
ORDER BY assignment."machineId";

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = current_schema()
  AND tablename = 'MachineCatalogItem'
  AND indexname = 'MachineCatalogItem_one_current_flavor_idx';
