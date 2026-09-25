# Backend Database

## Catalog reconciliation for issue #17

`20260923000100_catalog_price_reconciliation_v1` is an additive reconciliation migration for production drift where `CatalogItem` and `MachineCatalogItem` may already exist. It does not use `DROP`, does not use `prisma db push`, and does not include the experimental RetailPriceList/Recipe/CatalogPublication migration from `feature/terminal-ui-v1`.

The migration reconciles the stable `sprinkle_none` and `topping_none` system rows to an explicit `0 RUB` price. It does not assign them to machines automatically; machine availability remains an audited Admin Console action.

Release order:

1. Restore a production-shaped backup into an isolated test PostgreSQL instance.
2. Inventory existing columns, constraints and duplicate current-flavor assignments.
3. Run the canonical migration chain and confirm it either succeeds without data loss or fails closed on incomplete identity/business data.
4. Validate Prisma, catalog API, new quotes and unchanged historical snapshots.
5. Back up production and apply the reviewed migration only during an explicitly approved release window.
6. Keep catalog/display feature traffic disabled until acceptance completes.

Never run `db push` against production.

The MVP backend uses PostgreSQL through Prisma.

This directory owns the current migration structure:

```text
backend/prisma/
  schema.prisma
  migrations/
```

Foundation rules:

- `DATABASE_URL` is loaded from backend runtime environment.
- PostgreSQL is the only configured backend datasource.
- Migrations are committed as source-controlled infrastructure changes.
- Business logic is not implemented in migrations.
- Provider secrets, Telegram secrets and real payment credentials are not stored here.

The current foundation does not add new domain tables. Future schema changes must follow
module ownership from `docs/architecture/MVP_BACKEND_ARCHITECTURE.md`.
