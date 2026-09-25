# Catalog / price / display rehearsal report — 2026-09-25

## Result

**Fixture rehearsal: PASS. Production release: NO-GO.**

The canonical migration and all automated verification passed in an isolated local PostgreSQL cluster. No real pre-target production-shaped backup is present locally, so this result proves the harness and synthetic drift scenario only. Production was not contacted or changed.

## Environment

- Branch: `release/display-catalog-rehearsal-v1`
- Base/HEAD at start: `e257415ab7c81e4f17f45064e91147180f878eca`
- PostgreSQL server: `16.15`
- Isolated listener: `127.0.0.1:55432`
- Successful database: `soft_ice_rehearsal_fixture_20260925_v2`
- Evidence directory: `.tmp/catalog-rehearsal/soft_ice_rehearsal_fixture_20260925_v2/` (local and ignored)
- Production-shaped backup: absent
- Production/DNS/Nginx/systemd/deploy activity: none
- Real payments / physical dispense: none

## Migrations before / after

- Before: 63 canonical migrations, ending at `20260908000100_gift_notification_outbox_v1`.
- Applied: `20260923000100_catalog_price_reconciliation_v1` through `prisma migrate deploy`.
- After: 64 canonical migrations, ending at `20260923000100_catalog_price_reconciliation_v1`.
- Result: PASS; no `db push`, reset, `DROP`, or `TRUNCATE` was used.

The complete timestamped before/after lists and schema-only dumps are retained in the evidence directory.

## Row counts before / after

| Relation | Before | After | Result |
|---|---:|---:|---|
| `CatalogItem` | 7 | 7 | preserved; two legacy no-option rows reconciled in place |
| `MachineCatalogItem` | 6 | 6 | preserved |
| `PricingQuote` | 1 | 1 | preserved |
| `PricingSnapshot` | 1 | 1 | preserved |
| `PricingSnapshotItem` | 3 | 3 | preserved |

## Constraint and data results

- `CatalogItem` and `MachineCatalogItem` tables reconciled successfully.
- `sprinkle_none` and `topping_none` became active protected system items with explicit `0 RUB`.
- The inactive commercial fixture row with `null` price remained `null`; no commercial null-to-zero substitution occurred.
- Historical `PricingQuote`, `PricingSnapshot`, and `PricingSnapshotItem` row fingerprints were identical before/after.
- Machine A retained vanilla as current flavor; Machine B retained chocolate as current flavor.
- The one-current-flavor unique index is present.
- Active `null` price and unmarked commercial zero-price inserts were rejected by validated checks.
- Foreign keys from machine catalog to machine/catalog are validated.

## Tests and builds

| Check | Result |
|---|---|
| Full backend suite on isolated PostgreSQL | PASS — 609/609 tests, 0 failed, 0 skipped |
| Admin Console tests | PASS — 33/33 tests in 15 files |
| Admin Console build | PASS |
| Mini App / display build | PASS |
| PowerShell parser for all rehearsal scripts | PASS |

Coverage exercised machine-specific current flavors, protected no-option rows, historical snapshot immutability, server-authoritative pricing, add-ons and Promotion Engine. Admin coverage exercised atomic bulk save, dirty state, API failure retention, explicit invalid-price validation retention, and customer preview from the backend machine catalog.

## Problems found

1. The first fixture run correctly failed because the harness initially compared all pre-migration null-price IDs, including legacy `topping_none`, which the migration is required to reconcile from `null` to `0 RUB`. The comparison now excludes only the two protected no-option SKUs and still proves preservation of every commercial null-price row. The failed database was retained and a new database was used for the successful run.
2. No real pre-target production-shaped backup is available locally. Fixture success cannot authorize production release.
3. Docker Desktop was unavailable. A separate repository-local PostgreSQL 16 cluster was used instead; no existing database was reused.

## Rollback / restore plan

1. Preserve a failed rehearsal database and its evidence unchanged.
2. Create a new uniquely named `soft_ice_rehearsal_*` database; never reset, truncate, or drop the failed copy.
3. Restore the same checksum-verified pre-target custom-format backup into the new database.
4. Confirm the pre-target migration head, schema, row counts, commercial null-price IDs, and pricing-history fingerprints.
5. Re-run the full harness and stop on any failed migration, assertion, suite, or build.
6. A future production cutback requires separate approval and must restore into a new database/cluster with controlled application cutback. This harness never changes production.

## Backup required for the final rehearsal

Provide an encrypted PostgreSQL custom-format backup captured by an authorized operator from a read-only production snapshot/replica immediately before the target migration. It must contain all schemas/data, `_prisma_migrations`, catalog/machine/pricing history and dependencies, plus its SHA-256 checksum, capture time, PostgreSQL version, pre-target migration head, and operator identity. Store and transfer it outside Git through an approved access-controlled channel.

Exact capture and restore instructions are in `docs/testing/CATALOG_PRICE_DISPLAY_MIGRATION_REHEARSAL.md`.

## Future production GO / NO-GO checklist

- [ ] Real pre-target production-shaped backup obtained from an authorized read-only snapshot/replica.
- [ ] Backup checksum, capture time, server version, migration head, and operator recorded.
- [ ] Backup restored into access-controlled non-production PostgreSQL.
- [ ] Canonical chain applies through `20260923000100_catalog_price_reconciliation_v1`.
- [ ] Before/after migrations, schema, and row counts reviewed.
- [ ] `sprinkle_none` and `topping_none` are protected `0 RUB` system items.
- [ ] Commercial `null` prices remain `null`; no null-to-zero substitution occurred.
- [ ] Historical `PricingQuote`, `PricingSnapshot`, and `PricingSnapshotItem` fingerprints are unchanged.
- [ ] Different machines retain valid independent current flavors.
- [ ] Admin bulk save, dirty-state, validation errors, and customer preview pass.
- [ ] Server-authoritative price, add-ons, and Promotion Engine pass.
- [ ] Full backend suite passes.
- [ ] Admin Console tests/build pass.
- [ ] Mini App/display build passes.
- [ ] No real payment or physical dispense was invoked.
- [ ] Restore/cutback drill reviewed.
- [ ] Product Owner separately approves production release.
