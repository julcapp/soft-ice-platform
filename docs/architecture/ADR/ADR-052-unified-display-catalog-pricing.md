# ADR-052 — Unified Display and Authoritative Catalog Pricing

**Date:** 2026-09-23
**Status:** Accepted

## Context

The vending customer experience had a canonical Mini App terminal mode and a separate experimental `frontend/terminal` implementation on `feature/terminal-ui-v1`. Product and price data could also be read from frontend repositories, while production already contained manually-created additive `CatalogItem` and `MachineCatalogItem` tables.

## Decision

`display.utimoshi.ru` is the only supported vending-machine customer UI. It uses `frontend/miniapp` with `?mode=terminal`; portrait and landscape are CSS adaptations of the same React flow. `feature/terminal-ui-v1` remains reference-only.

PostgreSQL `CatalogItem` and `MachineCatalogItem` are the authoritative base-catalog boundary. A machine has one active current `ICE_CREAM` flavor and its own available `SPRINKLE`/`TOPPING` items. The display fetches this projection, while every payable transition requires a server-created immutable `PricingQuote`/`PricingSnapshot`. Promotion Engine applies only after authoritative base prices resolve.

The reconciliation migration is additive-only and preserves existing tables. It uses `CREATE ... IF NOT EXISTS`, adds missing columns and constraints, never drops or rewrites a table, and fails closed if pre-existing required identity data cannot satisfy the canonical model. It must be rehearsed on a production-shaped test database before release.

## Consequences

- React does not contain commercial product prices or machine/location configuration.
- Missing price for an active commercial item blocks catalog delivery and quoting.
- Zero is allowed only for system/no-option or explicitly free items.
- System no-option items cannot be deactivated or removed through ordinary Admin Console actions.
- Admin catalog mutations require an administrator role and write `AuditEvent` evidence.
- Editing a catalog price changes future quotes only; stored historical snapshots remain immutable.
- Payment and physical dispense success remain owned by Payment Runtime and Machine Runtime.
- `frontend/terminal` and `terminal.utimoshi.ru` are not introduced into the canonical branch.

## Related

- GitHub issue #17
- `docs/DEPLOYMENT_ENDPOINTS.md`
- `docs/architecture/PRICING_ENGINE.md`
- `docs/domain/PRODUCT_CATALOG.md`
