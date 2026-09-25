# Catalog / price / display migration rehearsal

Status: Ready for isolated execution

Target: `20260923000100_catalog_price_reconciliation_v1`

Production changes: forbidden

## Purpose

This rehearsal verifies the canonical Prisma migration chain and the Admin Console → backend catalog → machine catalog → `display.utimoshi.ru` pricing path after PR #18. It never connects to production, deploys an application, changes DNS/Nginx/systemd, performs a real payment, or dispatches a physical machine command.

The harness creates a new PostgreSQL database whose name must start with `soft_ice_rehearsal_`. It refuses to reuse an existing database and contains no `DROP`, `TRUNCATE`, Prisma reset, or `db push` operation.

## Prerequisites

- PostgreSQL 16-compatible server dedicated to local/test use;
- a non-production role with `CREATEDB` and restore/migration rights;
- PostgreSQL client tools (`psql`, `pg_dump`, `pg_restore`);
- backend, Admin Console, and Mini App dependencies already installed;
- PowerShell 7+;
- no production hostname or credentials in the rehearsal environment.

Provide the admin URL only through the process environment. Do not put it in Git, shell history, or a report:

```powershell
$env:REHEARSAL_ADMIN_DATABASE_URL = 'postgresql://rehearsal_user:<password>@127.0.0.1:5432/postgres'
```

If no isolated PostgreSQL is already available, initialize a repository-local PostgreSQL 16 cluster. It listens only on `127.0.0.1:55432`, uses trust authentication only for this local test process, and retains its data when stopped:

```powershell
pwsh ./backend/scripts/catalog-rehearsal/Start-IsolatedPostgres.ps1
$env:REHEARSAL_ADMIN_DATABASE_URL = 'postgresql://rehearsal_admin@127.0.0.1:55432/postgres'
```

After collecting the report, stop it without deleting data:

```powershell
pwsh ./backend/scripts/catalog-rehearsal/Stop-IsolatedPostgres.ps1
```

## Synthetic fixture rehearsal

Use this mode to prove the harness and migration mechanics without claiming production readiness:

```powershell
pwsh ./backend/scripts/catalog-rehearsal/Invoke-CatalogRehearsal.ps1 -Mode Fixture
```

The fixture applies every canonical migration before the target, creates a deliberately drifted pre-target catalog, two machines with different current flavors, paid add-ons, a disabled item with `null` price, and historical quote/snapshot rows. It then applies the full canonical chain.

Fixture facts are synthetic and must never be described as production data. Fixture success remains `NO-GO` for production.

## Final production-shaped rehearsal

The required backup is a PostgreSQL custom-format logical backup from an authorized read-only production snapshot or replica taken immediately before the target migration. It must include:

- all application schemas and data, not only catalog tables;
- `_prisma_migrations` with the complete pre-target chain;
- `Machine`, `CatalogItem`, `MachineCatalogItem`, `PricingQuote`, `PricingSnapshot`, and `PricingSnapshotItem`;
- sequences, types, indexes, constraints, and foreign-key dependencies;
- no completed `20260923000100_catalog_price_reconciliation_v1` row;
- a recorded SHA-256 checksum, capture time, PostgreSQL server version, source migration head, and backup operator;
- encrypted, access-controlled storage outside this repository.

An authorized operator creates it from the read-only snapshot boundary, not from this harness:

```powershell
pg_dump --format=custom --no-owner --no-privileges --dbname $env:AUTHORIZED_READ_ONLY_SNAPSHOT_URL --file C:\secure\soft-ice-pre-catalog-reconciliation.dump
Get-FileHash -Algorithm SHA256 C:\secure\soft-ice-pre-catalog-reconciliation.dump
```

Transfer the archive through the approved secure channel. Never commit it. Then run:

```powershell
$env:REHEARSAL_ADMIN_DATABASE_URL = 'postgresql://rehearsal_user:<password>@127.0.0.1:5432/postgres'
pwsh ./backend/scripts/catalog-rehearsal/Invoke-CatalogRehearsal.ps1 `
  -Mode Backup `
  -BackupPath C:\secure\soft-ice-pre-catalog-reconciliation.dump
```

For an approved remote non-production PostgreSQL host, pass its exact hostname with `-AllowRemoteHost`. Production-looking host/database names are rejected even with that option.

## Evidence produced

Each run writes ignored evidence under `.tmp/catalog-rehearsal/<database-name>/`:

- PostgreSQL server version;
- before/after schema-only dumps;
- before/after `_prisma_migrations` lists;
- before/after row counts;
- before/after IDs whose catalog price is `null`;
- immutable fingerprints for `PricingQuote`, `PricingSnapshot`, and `PricingSnapshotItem`;
- validated constraint definitions;
- migration, backend test, Admin Console test/build, and Mini App/display build logs;
- `REHEARSAL_REPORT.md` with problems, restore plan, and GO/NO-GO checklist.

The assertions prove:

1. `sprinkle_none` and `topping_none` are active protected system items with explicit `0 RUB`;
2. the migration does not replace existing `null` prices with zero;
3. historical pricing rows and their values remain unchanged;
4. at most one current flavor exists per machine, while different machines may have different flavors;
5. active null-price and unmarked zero-price writes are rejected;
6. server pricing ignores client amounts;
7. add-ons resolve before Promotion Engine applies its benefit;
8. Admin Console bulk save, dirty-state retention, validation/API errors, and customer preview pass;
9. the full backend suite and both frontend builds are executed by default.

## Failure and restore policy

Never repair a failed rehearsal database in place. Retain it and its evidence, create another uniquely named database, and restore the same verified backup again. The harness intentionally has no cleanup command because `DROP`, `TRUNCATE`, reset, and destructive rollback are outside this task.

Production remains `NO-GO` until the backup-mode report is fully green, a restore/cutback drill is reviewed, and the Product Owner separately approves release. This rehearsal does not authorize merge or deployment.
