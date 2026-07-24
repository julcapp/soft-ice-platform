# ADR-020: Digital Twin Source-of-Truth Boundaries

Date: 2026-07-23  
Status: Accepted

## Decision

Machine identity stays in Machine Domain; telemetry in Machine Gateway or its
normalized store; operator actions and maintenance in Machine Operations;
inventory in Inventory/Machine Operations; orders in Orders; payments in
Payment Platform; menus in Product Catalog; placements in Advertising.

Machine Digital Twin is never authoritative for those facts. Its adapters are
read-only and its `sourceStatus` declares availability without claiming
authority. It cannot directly mutate a source domain.

## Consequences

No Digital Twin command API exists in v1. Demo facts are visibly labeled and
cannot be accepted as production identities. Future prediction remains advisory
and cannot initiate operator or machine action.
