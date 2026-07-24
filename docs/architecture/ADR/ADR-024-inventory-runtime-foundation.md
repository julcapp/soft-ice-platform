# ADR-024 — Inventory Runtime owns stock and reservations

Date: 2026-07-23  
Status: Accepted

Inventory Runtime is a separate bounded context and the sole authority for stock movements, reservations, and balance calculation across machine and warehouse locations. Machine Operations and Machine Runtime provide facts through Platform Event Bus or service contracts and cannot write Inventory storage directly. CRM/Admin Console consumes read-only projections.

The ledger is append-only; corrections are new movements. All commands are idempotent and audited. Location and source identifiers are stable, so adding machines, warehouses, durable storage, and external procurement adapters does not require UI or domain rewrites.

The in-memory runtime/repository is a v1 foundation, not a durability claim. Prisma schema and migration establish the persistent model; production activation requires transactional persistence, row/advisory locking, and transactional outbox delivery.
