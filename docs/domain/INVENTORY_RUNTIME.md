# Inventory Runtime Foundation v1

Status: Implemented foundation  
Version: 1.0  
Date: 2026-07-23

## Boundary

Inventory Runtime is the authoritative bounded context for physical stock, reservations, calculated balances, and the immutable movement journal. It has no direct dependency on CRM, Orders, Payments, or Machine Operations databases. Integrations publish or consume facts through Platform Event Bus and stable service/API contracts.

Machine Operations owns human work records and may emit inventory facts. Machine Runtime owns machine execution state and emits consumption facts. Admin Console is a read-only projection and never changes stock.

## Model

- `InventoryRuntimeItem`: ingredient, consumable, or service material; stable semantic ID, SKU, name, and base unit.
- `InventoryRuntimeLocation`: warehouse or machine location. Each balance belongs to one item and one location, enabling multiple warehouses and machines.
- `InventoryRuntimeMovement`: append-only ledger fact with type, signed delta, source, actor, correlation ID, idempotency key, event reference, and timestamps.
- `InventoryRuntimeReservation`: active hold or terminal released/consumed record. Reservations reduce available stock but not on-hand stock.
- Balance is calculated: `on_hand = sum(delta)`, `reserved = active non-expired reservations`, `available = on_hand - reserved`.

## Movements

| Type | Balance effect |
| --- | --- |
| `RECEIPT` | positive |
| `CONSUMPTION` | negative |
| `TEST_CONSUMPTION` | negative |
| `MAINTENANCE` | negative |
| `INVENTORY_COUNT` | delta to declared physical count |
| `ADJUSTMENT` | explicit signed correction |

Negative on-hand stock is denied by default. A movement contains a reason and audit identity. Historical movements are never updated or deleted.

## Idempotency and events

Every command requires `Idempotency-Key`. Repeating an identical command returns the original result; reuse with a different payload returns `IDEMPOTENCY_KEY_REUSED`. Event subscribers derive their key from `event_id`. Runtime publishes `Inventory.ItemCreated`, `Inventory.LocationCreated`, `Inventory.MovementRecorded`, `Inventory.StockReserved`, `Inventory.ReservationConsumed`, and `Inventory.ReservationReleased`.

V1 repository wiring is in-memory, matching the current Platform Event Bus foundation. Prisma models and migration define the durable target schema. Production enablement requires a transactional Prisma repository/outbox and concurrency locking for balance-changing commands.
