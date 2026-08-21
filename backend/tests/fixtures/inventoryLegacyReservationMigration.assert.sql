DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "InventoryRuntimeReservation" WHERE "organizationId" <> 'legacy-org' OR "machineId" <> 'legacy-machine') THEN RAISE EXCEPTION 'LEGACY_OWNERSHIP_MISMATCH'; END IF;
  IF EXISTS (SELECT 1 FROM "InventoryRuntimeReservationItem" WHERE "quantity" <= 0 OR "reservedQuantity" < 0 OR "consumedQuantity" < 0 OR "releasedQuantity" < 0 OR "consumedQuantity" + "releasedQuantity" > "reservedQuantity" OR "reservedQuantity" > "quantity") THEN RAISE EXCEPTION 'LEGACY_QUANTITY_INVARIANT_FAILED'; END IF;
  IF (SELECT count(*) FROM "InventoryRuntimeReservation" WHERE "status"='RESERVED') <> 1 THEN RAISE EXCEPTION 'LEGACY_ACTIVE_FAILED'; END IF;
  IF (SELECT count(*) FROM "InventoryRuntimeReservation" WHERE "status"='CONSUMED') <> 2 THEN RAISE EXCEPTION 'LEGACY_CONSUMED_FAILED'; END IF;
  IF (SELECT count(*) FROM "InventoryRuntimeReservation" WHERE "status"='RELEASED') <> 1 THEN RAISE EXCEPTION 'LEGACY_RELEASED_FAILED'; END IF;
  IF (SELECT count(*) FROM "InventoryRuntimeReservation" WHERE "status"='EXPIRED') <> 1 THEN RAISE EXCEPTION 'LEGACY_EXPIRED_FAILED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "InventoryRuntimeReservation" r JOIN "InventoryRuntimeReservationItem" i ON i."reservationId"=r."reservationId" WHERE r."metadata"->>'sourceId'='consumed-multi' GROUP BY r."reservationId" HAVING count(*)=2 AND sum(i."quantity")=5 AND sum(i."reservedQuantity")=5 AND sum(i."consumedQuantity")=5) THEN RAISE EXCEPTION 'LEGACY_MULTI_ITEM_FAILED'; END IF;
END $$;
