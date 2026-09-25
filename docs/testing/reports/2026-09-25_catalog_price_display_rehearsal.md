# Catalog / price / display rehearsal report — 2026-09-25

## Result

**Migration: PASS. Next stage: NO-GO.**

The checksum-verified staging-shaped backup from `utimoshi_crm_v036_stage` restored into an isolated local PostgreSQL 16 cluster and accepted `20260923000100_catalog_price_reconciliation_v1`. Schema/data preservation assertions, catalog/pricing integration, Admin Console tests/build, and Mini App/display build passed. The next stage remains blocked by migration-history drift, an unconfigured commercial machine catalog/current flavor, and 27 PostgreSQL payment tests that cannot run under the rehearsal's explicit no-`DROP` rule.

Production and `78.140.15.84` were not contacted or changed. No deploy, real payment, or physical dispense occurred.

## Backup and environment

- Backup: external secure path supplied by the operator; not copied into Git.
- SHA-256: `9D5D761990FDEF040FE5456BCF0B911D9C50994E18CDC01B94C9DEC42D9FA440` — PASS.
- Archive: PostgreSQL custom format, 1075 TOC entries, gzip compression.
- Archive created: `2026-09-22 06:16:33` from `utimoshi_crm_v036_stage`.
- Dumped from/by PostgreSQL `16.14`; restore client/server `16.15`.
- Branch/HEAD at start: `release/display-catalog-rehearsal-v1` / `c38d229`.
- Successful evidence database: `soft_ice_rehearsal_stage_20260925_v3`.
- Evidence: `.tmp/catalog-rehearsal/soft_ice_rehearsal_stage_20260925_v3/` (local, ignored, retained).
- Earlier failed harness-evidence databases: `..._v1` and `..._v2`; retained, not reset or dropped.

## Migration chain and drift

- Backup before target: 66 completed migration rows.
- Repository: 64 migration directories including the target.
- Applied in rehearsal: `20260923000100_catalog_price_reconciliation_v1`.
- After: 67 completed migration rows.
- `prisma migrate status` reports the schema up to date, but an explicit name comparison found three applied staging migrations absent from the branch:
  - `20260911000100_admin_owner_auth_v1`
  - `20260911093000_admin_security_otp_v1`
  - `20260911104500_admin_max_security_link_v1`

This is migration-history drift. It was not repaired or marked resolved. Safe correction: locate the exact canonical SQL/checksums and source commits for these three migrations, restore those migration directories to the task branch through normal review, then repeat the rehearsal from a newly restored database. Do not edit `_prisma_migrations` or the source backup.

## Before / after data

| Relation | Before | After | Result |
|---|---:|---:|---|
| `Machine` | 1 | 1 | row and fingerprint preserved |
| `CatalogItem` | absent / 0 | 2 | only protected no-option rows created |
| `MachineCatalogItem` | absent / 0 | 0 | table created; no assignment invented |
| current-flavor assignments | 0 | 0 | unchanged; operational blocker |
| `PricingQuote` | 33 | 33 | fingerprint unchanged |
| `PricingSnapshot` | 33 | 33 | fingerprint unchanged |
| `PricingSnapshotItem` | 33 | 33 | fingerprint unchanged |

Pricing fingerprints before/after were identical:

- `PricingQuote`: `fdada97446c1fa9953baf59013e6688b`
- `PricingSnapshot`: `09a0530bc42c604af6f081be944a0d13`
- `PricingSnapshotItem`: `1fd4cbb855289834002121d00de41f71`

There were no pre-existing commercial catalog rows, so there were no commercial `null` prices to transform; the commercial-null identity set remained empty. The migration created only `sprinkle_none` and `topping_none`, both active protected system items at explicit `0 RUB`.

## Schema and constraints

- `CatalogCategory`, `CatalogItem`, and `MachineCatalogItem` were added.
- Schema diff: 121 inserted lines and 2 changed lines in the schema-only snapshot.
- All eight catalog/machine constraints are validated.
- Foreign keys to `Machine` and `CatalogItem` are validated with `RESTRICT` delete behavior.
- `MachineCatalogItem_one_current_flavor_idx` exists and is partial/unique.
- Invalid active-null and unmarked commercial zero-price inserts were rejected inside rollback-safe assertion blocks.
- Existing `Machine` and historical pricing fingerprints were unchanged.

## Tests and builds

| Check | Result |
|---|---|
| Backend Prisma merge check | PASS |
| Backend suite excluding the SQL-`DROP` payment file | PASS — 584/584 |
| `postgresPayment.test.js` | SAFETY SKIP — 27/27 skipped; its cleanup executes forbidden `DROP TRIGGER/FUNCTION` |
| PostgreSQL catalog/pricing integration | PASS — 1/1 |
| Admin Console tests, including «Каталог и цены» | PASS — 33/33 in 15 files |
| Admin Console build (`pnpm@10.15.1`) | PASS |
| Mini App/display build (`pnpm@10.15.1`) | PASS |
| Rehearsal PowerShell parser | PASS |

The passing backend coverage includes server-authoritative pricing, add-ons, Promotion Engine, protected no-option behavior, machine-specific current-flavor contracts, and historical snapshot immutability. No external payment provider or equipment command was invoked.

## Blockers and decision

1. **Migration-history drift:** three completed staging migrations are absent from the branch migration directory.
2. **Catalog readiness:** the staging-shaped data has one machine but no commercial catalog item and no current flavor. The migration correctly refuses to invent business assignments, so display is not operational from this data alone.
3. **Full backend database pass incomplete:** 27 payment PostgreSQL tests are safety-skipped because executing them would violate the explicit no-`DROP` requirement.

Therefore the migration execution itself is **PASS**, but the next release stage is **NO-GO**. Rehearse again only after the three canonical migration directories are restored and an approved, audited catalog/current-flavor initialization plan exists. Resolve the payment-test conflict either by Product Owner approval for those isolated `DROP TRIGGER/FUNCTION` cleanup statements or by a separately reviewed non-destructive test-harness change.

## Safety record

- No production database connection.
- `78.140.15.84` unchanged.
- No `db push`, reset, database/table `DROP`, or `TRUNCATE`.
- No deployment, real payment, or physical dispense.
- Backup remained outside Git and unchanged.
- Failed/superseded rehearsal databases and evidence were retained rather than repaired in place.
