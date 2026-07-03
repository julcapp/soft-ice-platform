# ORDER-004 Order Events

Status: Architecture documented
Version: 0.1
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-03
Last updated: 2026-07-03

Related documents:

- `AGENTS.md`
- `PROJECT_MEMORY.md`
- `docs/architecture/ORDER_PLATFORM.md`
- `docs/architecture/EVENT_PLATFORM.md`
- `docs/architecture/CHECKOUT.md`
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/architecture/BONUS_ENGINE.md`
- `docs/architecture/LEDGER.md`
- `docs/tasks/EPIC-230_ORDER_PLATFORM.md`
- `docs/tasks/ORDER-001_ORDER_DOMAIN.md`
- `docs/tasks/ORDER-002_CHECKOUT_PIPELINE.md`
- `docs/tasks/ORDER-003_ORDER_STATE_MACHINE.md`

---

# Goal

Document the domain events emitted by Order Platform.

ORDER-004 is documentation only. It defines the Order event catalog, payload principles, versioning, ordering, idempotency, consumers, producers, failure handling, replay strategy and audit requirements before implementation starts.

Core rule:

```text
Every accepted Order state transition emits exactly one Order business event.
```

Duplicate commands, retries, rejected commands and event publication retries must not create additional business events for the same accepted Order transition.

---

# 1. Event Catalog

The Order Platform emits order-scoped business events with `source_domain = "order"` and `aggregate_type = "order"`.

These event names are canonical for Order Platform v1 contracts:

| Event | Version | From | To | Meaning |
|---|---:|---|---|---|
| `OrderCreated` | 1 | none | `Draft` | Order aggregate was created from accepted checkout context. |
| `OrderConfigured` | 1 | `Draft` | `Configured` | Product and option configuration snapshot was accepted. |
| `OrderValidated` | 1 | `Configured` | `Configured` | Order validation, availability and eligibility context was accepted before pricing. |
| `PriceCalculated` | 1 | `Configured` | `Priced` | Pricing snapshot was accepted from Pricing Engine result. |
| `DiscountApplied` | 1 | `Priced` | `Discounted` | Discount result, including zero-discount decision, and payable amount were accepted. |
| `BonusReserved` | 1 | `Discounted` | `BonusReserved` | Bonus reservation reference was accepted for the order. |
| `PaymentStarted` | 1 | `Discounted` or `BonusReserved` | `PaymentPending` | Payment settlement may start from accepted payable amount. |
| `PaymentConfirmed` | 1 | `PaymentPending` | `Paid` | Payment completion was accepted according to Payment and Ledger policy. |
| `OrderQueued` | 1 | `Paid` | `Queued` | Machine fulfillment queue entry was accepted. |
| `PreparationStarted` | 1 | `Queued` | `Preparing` | Machine preparation start was accepted for the order. |
| `DispensingStarted` | 1 | `Preparing` | `Dispensing` | Machine dispensing start was accepted for the order. |
| `OrderCompleted` | 1 | `Dispensing` | `Completed` | Product delivery or approved fulfillment closure completed the order. |
| `OrderCancelled` | 1 | unpaid active state | `Cancelled` | Order was stopped before captured payment existed. |
| `RefundStarted` | 1 | paid active state | `RefundPending` | Refund compensation was started for a paid order. |
| `RefundCompleted` | 1 | `RefundPending` | `Refunded` | Refund compensation was completed and the order was closed as refunded. |
| `OrderExpired` | 1 | unpaid active state | `Expired` | Order expired before captured payment existed. |

Unpaid active states are:

- `Draft`;
- `Configured`;
- `Priced`;
- `Discounted`;
- `BonusReserved`;
- `PaymentPending` when reconciliation confirms no captured payment exists.

Paid active states are:

- `Paid`;
- `Queued`;
- `Preparing`;
- `Dispensing`.

`OrderValidated` is a same-state business checkpoint. It increments the Order event sequence and records validation acceptance without adding a separate canonical Order state.

Retry scheduling, rejected transitions and reconciliation requests are audit or operational records in ORDER-004. They are not Order business events unless a later approved task promotes them to the event catalog.

---

# 2. Payload Principles

Order events use the Event Platform envelope from `docs/architecture/EVENT_PLATFORM.md`.

Required envelope fields:

| Field | Rule |
|---|---|
| `event_id` | Stable unique ID for this accepted business event. |
| `event_name` | Canonical event name in English PascalCase. |
| `event_version` | Integer event contract version. |
| `event_type` | `domain` for Order Platform events. |
| `source_domain` | `order`. |
| `occurred_at` | UTC timestamp when the Order fact was accepted. |
| `aggregate_type` | `order`. |
| `aggregate_id` | Stable `order_id`. |
| `correlation_id` | Checkout, order or support flow ID. |
| `causation_id` | Command ID, external event ID or previous platform event ID that caused this event. |
| `actor` | Customer, system, machine, provider adapter, operator or support actor. |
| `payload` | Event-specific business payload. |
| `metadata` | Technical metadata such as producer, schema and outbox details. |

Common Order payload fields:

| Field | Rule |
|---|---|
| `order_id` | Required in every Order event. |
| `order_number` | Included when assigned. |
| `customer_id` | Included when known and allowed by privacy policy. |
| `channel` | Customer channel such as `miniapp`, terminal, bot, web or CRM. |
| `machine_id` | Included when the order is tied to a machine. |
| `from_state` | Previous Order state; `null` for `OrderCreated`. |
| `to_state` | Resulting Order state. |
| `state_version` | Monotonic Order state or checkpoint version. |
| `state_reason` | Stable reason code for the accepted transition. |
| `currency` | Required for financial events. |
| `gross_amount` | Included after pricing is accepted. |
| `discount_amount` | Included after discount is accepted. |
| `payable_amount` | Included before payment starts and after payment/refund facts. |
| `configuration_snapshot_id` | Included after configuration is accepted. |
| `pricing_snapshot_id` | Included after pricing is accepted. |
| `discount_snapshot_id` | Included after discount is accepted. |
| `bonus_reservation_id` | Included when bonuses are reserved. |
| `payment_id` | Included after payment binding exists. |
| `refund_id` | Included for refund events when available. |
| `fulfillment_id` | Included after fulfillment context exists. |
| `machine_operation_id` | Included after machine queue or machine operation is accepted. |
| `idempotency_key` | Required for deduplication and retry safety. |

Payload rules:

- payloads are contracts, not UI state;
- payload fields use snake_case;
- payload values use stable semantic IDs, snapshot IDs and platform IDs;
- payloads include immutable snapshot references, not mutable catalog lookups as historical truth;
- payloads include amounts only after the corresponding accepted snapshot exists;
- payloads must not include provider secrets, raw card data, access tokens, raw webhook payloads or unnecessary personal data;
- payloads must be sufficient for consumers to build projections without calling Order internals;
- payment facts are referenced by platform `payment_id`, not provider credentials;
- machine facts are referenced by `machine_id` and machine operation IDs, not hardware command internals;
- support and operator actions must include actor and reason metadata.

Minimal example:

```json
{
  "event_id": "evt_01JZ0000000000000000000000",
  "event_name": "PaymentConfirmed",
  "event_version": 1,
  "event_type": "domain",
  "source_domain": "order",
  "occurred_at": "2026-07-03T00:00:00Z",
  "aggregate_type": "order",
  "aggregate_id": "order_01JZ0000000000000000000000",
  "correlation_id": "checkout_01JZ0000000000000000000000",
  "causation_id": "evt_payment_completed_01JZ0000000000000000",
  "actor": {
    "actor_type": "system",
    "actor_id": "payment_engine"
  },
  "payload": {
    "order_id": "order_01JZ0000000000000000000000",
    "order_number": "UTM-20260703-000001",
    "customer_id": "customer_01JZ0000000000000000000000",
    "channel": "miniapp",
    "from_state": "PaymentPending",
    "to_state": "Paid",
    "state_version": 7,
    "state_reason": "payment_confirmed",
    "payment_id": "payment_01JZ0000000000000000000000",
    "gross_amount": 130,
    "discount_amount": 20,
    "payable_amount": 110,
    "currency": "RUB",
    "idempotency_key": "order_01JZ_payment_confirmed_payment_01JZ"
  },
  "metadata": {
    "schema_name": "PaymentConfirmed",
    "schema_version": 1,
    "producer": "OrderPlatform"
  }
}
```

---

# 3. Event Versioning

Event contracts are versioned independently.

Version identity:

```text
event_name + event_version
```

Examples:

```text
PaymentConfirmed v1
PaymentConfirmed v2
```

Versioning rules:

- v1 is the initial contract version for every ORDER-004 event;
- producers must publish the version declared in the envelope;
- consumers must declare supported event names and versions;
- backward-compatible additions can stay in the same version;
- breaking changes require a new event version;
- producers may publish old and new versions during migration;
- deprecated versions remain documented until all consumers are migrated.

Backward-compatible changes:

- adding an optional field;
- adding a nullable metadata field;
- adding a new enum value only when consumers are required to ignore unknown values;
- adding an optional nested object that consumers can ignore.

Breaking changes:

- removing a field;
- renaming a field;
- changing a field type;
- changing field meaning;
- changing event semantics;
- making an optional field required;
- changing state transition meaning;
- changing amount or currency interpretation.

Event names must not be reused with a different meaning.

---

# 4. Event Ordering

Ordering is guaranteed only inside one Order aggregate when the implementation supports it.

Per-order ordering keys:

- `order_id`;
- `state_version`;
- `occurred_at`;
- `event_id`.

Successful flow order:

```text
OrderCreated
-> OrderConfigured
-> OrderValidated
-> PriceCalculated
-> DiscountApplied
-> BonusReserved when bonuses are used
-> PaymentStarted
-> PaymentConfirmed
-> OrderQueued
-> PreparationStarted
-> DispensingStarted
-> OrderCompleted
```

Successful flow without bonuses:

```text
OrderCreated
-> OrderConfigured
-> OrderValidated
-> PriceCalculated
-> DiscountApplied
-> PaymentStarted
-> PaymentConfirmed
-> OrderQueued
-> PreparationStarted
-> DispensingStarted
-> OrderCompleted
```

Cancellation and expiration order:

```text
OrderCreated
-> one or more accepted unpaid checkpoints
-> OrderCancelled or OrderExpired
```

Refund order:

```text
PaymentConfirmed
-> RefundStarted
-> RefundCompleted
```

Ordering rules:

- consumers must not depend on global event ordering across orders;
- consumers must tolerate duplicate and delayed events;
- consumers should use `state_version` to detect missing or out-of-order events for one order;
- out-of-order events should be buffered, reconciled or moved to support review according to consumer policy;
- event order must reflect accepted Order facts, not UI progress timers;
- machine and payment events from other domains can arrive before or after Order events and must be correlated by IDs.

---

# 5. Idempotency

Order event publishing is idempotent.

Recommended event idempotency key:

```text
order_id + state_version + event_name
```

Recommended command-to-event idempotency key:

```text
order_id + operation_type + accepted_payload_hash
```

Rules:

- duplicate commands with the same idempotency key and same semantic payload return the already accepted result and event reference;
- duplicate commands with the same idempotency key and conflicting payload are rejected and audited;
- event publication retries reuse the same `event_id`;
- the same accepted state transition must never publish a second business event;
- consumers deduplicate by `event_id`;
- consumers may also deduplicate by `order_id + state_version + event_name`;
- external facts are deduplicated by their external event ID plus platform correlation IDs;
- idempotency keys must not include credentials, tokens or secrets.

Idempotency examples:

| Scenario | Required behavior |
|---|---|
| Customer taps payment button twice | One `PaymentStarted` event for the accepted transition. |
| Payment callback is replayed | One `PaymentConfirmed` event if payment was already accepted. |
| Machine sends duplicate preparation start | One `PreparationStarted` event for the accepted transition. |
| Event bus publish times out | Retry the same event ID through Event Platform policy. |
| Refund completion callback repeats | One `RefundCompleted` event for the accepted transition. |

---

# 6. Event Consumers

Consumers build projections, trigger side effects or support operations from Order events. Consumers must not mutate Order state directly from event handling.

Primary consumers:

| Consumer | Events | Purpose |
|---|---|---|
| Checkout and customer channels | All current-order events | Show customer-visible order progress from facts. |
| Payment Engine | `PaymentStarted`, refund-related events by command correlation | Execute or reconcile settlement through approved commands and payment facts. |
| Bonus Engine | `BonusReserved`, `PaymentConfirmed`, `OrderCancelled`, `OrderExpired`, `RefundStarted`, `RefundCompleted` | Reserve, redeem, release or compensate bonus rights according to Bonus policy. |
| Machine Platform | `PaymentConfirmed`, `OrderQueued` by command correlation | Queue and execute machine fulfillment through approved machine contracts. |
| CRM Platform | All Order events | Build customer history, support timeline, segmentation and operator views. |
| Notification Engine | `PaymentConfirmed`, `OrderQueued`, `PreparationStarted`, `DispensingStarted`, `OrderCompleted`, `OrderCancelled`, `OrderExpired`, `RefundCompleted` | Send approved customer or operator messages. |
| Analytics and AI modules | All Order events | Build funnel, revenue, fulfillment, failure and prediction datasets. |
| Finance read models | `DiscountApplied`, `PaymentStarted`, `PaymentConfirmed`, `RefundStarted`, `RefundCompleted` | Correlate accepted order facts with Payment, Wallet, Bonus and Ledger facts. |
| Audit and support tools | All Order events | Reconstruct order timeline and support decisions. |

Consumer rules:

- consumers must be idempotent;
- consumers must declare supported event versions;
- consumers must not assume exactly-once delivery;
- consumers must not rely on global ordering;
- consumers must not call private Order internals;
- consumers must not recalculate historical prices from live catalog data;
- side-effect consumers must reconcile current domain state before issuing external effects;
- replay consumers must suppress non-replay-safe side effects.

---

# 7. Event Producers

Order Platform is the producer of every event in this catalog.

Producer rule:

```text
External fact or command
-> Order validates and accepts state/checkpoint change
-> Order persists state, snapshot and audit
-> Order publishes exactly one business event
```

Primary causal producers:

| Causal source | Causes Order to emit |
|---|---|
| Checkout orchestration | `OrderCreated`, `OrderConfigured`, `OrderValidated`, `PaymentStarted`, `OrderCancelled`, `OrderExpired` |
| Configuration Engine result | `OrderConfigured` |
| Availability or validation policy | `OrderValidated` |
| Pricing Engine result | `PriceCalculated` |
| Discount Engine result | `DiscountApplied` |
| Bonus Engine reservation fact | `BonusReserved` |
| Payment Engine and Ledger-backed facts | `PaymentConfirmed`, `RefundStarted`, `RefundCompleted`, `OrderCancelled`, `OrderExpired` |
| Machine Platform queue and operation facts | `OrderQueued`, `PreparationStarted`, `DispensingStarted`, `OrderCompleted`, `RefundStarted` |
| Timeout controller | `OrderExpired` |
| Customer, operator or support command | `OrderCancelled`, `RefundStarted` |

Producer responsibilities:

- validate the transition against the Order State Machine;
- persist the Order state and snapshots before publishing;
- use a transactional outbox or equivalent reliable publish pattern when implemented;
- reuse the same event ID when retrying publication;
- include correlation, causation, actor and idempotency metadata;
- publish only facts the Order Platform has accepted;
- never publish provider secrets, payment credentials or raw machine hardware payloads.

---

# 8. Failure Handling

Failure handling must preserve one event per accepted transition.

Rules:

- invalid transitions are rejected and audited, but they do not publish lifecycle business events;
- failed validation keeps the order out of pricing and payment events;
- payment ambiguity requires reconciliation before `PaymentConfirmed`, `OrderCancelled` or `OrderExpired`;
- paid order failure must move to `RefundStarted` only after refund compensation is required by policy;
- machine ambiguity requires reconciliation before `PreparationStarted`, `DispensingStarted`, `OrderCompleted` or `RefundStarted`;
- event publication failure retries the same event ID;
- repeated publication failure moves the event to dead-letter or support handling without duplicating the Order transition;
- consumer failure is handled by Event Platform retry and dead-letter policy;
- support correction is a new explicit operation and event, not a silent edit to historical snapshots.

Failure matrix:

| Failure | Event behavior |
|---|---|
| Configuration invalid | No Order lifecycle event after `OrderCreated` unless the order is cancelled or expired. |
| Validation fails before pricing | No `OrderValidated`; order may later emit `OrderCancelled` or `OrderExpired`. |
| Pricing fails | No `PriceCalculated`; order remains before pricing or closes by cancellation/expiration policy. |
| Discount fails | No `DiscountApplied`; order remains before discount or closes by cancellation/expiration policy. |
| Bonus reservation fails | No `BonusReserved`; checkout can continue without bonuses only through a new accepted discount/payment path. |
| Payment provider status unknown | No terminal payment Order event until Payment Engine reconciles. |
| Captured payment cannot fulfill | Emit `RefundStarted` after compensation decision is accepted. |
| Refund completion delayed | Keep `RefundPending`; emit `RefundCompleted` only after accepted completion. |
| Machine event duplicated | Deduplicate and do not emit duplicate fulfillment events. |
| Event bus unavailable | Retry same event ID through outbox/Event Platform policy. |

---

# 9. Replay Strategy

Event replay rebuilds projections and audit views from stored events.

Replay targets:

- customer order history;
- CRM support timeline;
- checkout progress projections;
- notification eligibility projections;
- analytics datasets;
- AI training and monitoring datasets;
- finance correlation reports;
- machine fulfillment history.

Replay rules:

- replay must process events in per-order `state_version` order when rebuilding order projections;
- replay must not create new payments, refunds, bonus movements, wallet movements or machine commands;
- consumers must know when they are running in replay mode;
- replay should use event contract versions supported by the consumer;
- unsupported event versions must be skipped, transformed or sent to support tooling according to consumer policy;
- replay must preserve original `occurred_at`, `event_id`, `correlation_id` and `causation_id`;
- replay can rebuild read models but does not replace the Order repository as the current aggregate store;
- Event Storage does not replace Finance Ledger for financial truth.

Recommended replay controls:

- replay batch ID;
- replay source event range;
- consumer version;
- dry-run mode for sensitive consumers;
- side-effect suppression flag;
- replay audit log.

---

# 10. Audit

Every Order event is an audit-relevant fact.

Required audit fields:

- `event_id`;
- `event_name`;
- `event_version`;
- `order_id`;
- `from_state`;
- `to_state`;
- `state_version`;
- `state_reason`;
- `actor`;
- `channel`;
- `machine_id` when applicable;
- `payment_id` when applicable;
- `refund_id` when applicable;
- `bonus_reservation_id` when applicable;
- `command_id`;
- `correlation_id`;
- `causation_id`;
- `idempotency_key`;
- accepted snapshot IDs and hashes when applicable;
- external event ID when applicable;
- `occurred_at`;
- `recorded_at`;
- producer identity;
- publication status;
- operator ID and support reason for operator actions.

Audit rules:

- audit records are append-only;
- event payload and audit metadata must be enough to reconstruct the business timeline;
- rejected security-sensitive commands are audited even when no business event is emitted;
- operator and support actions require actor ID and reason;
- machine-originated facts require trusted machine or adapter identity;
- payment-originated facts require verified Payment Engine facts;
- audit records must not contain provider secrets, raw card data, access tokens or unnecessary personal data;
- terminal events preserve final closure reason and compensation references;
- audit and event storage retention must follow legal, privacy and business requirements.

---

# 11. Acceptance Criteria

ORDER-004 is complete when:

- event catalog is documented;
- event payload principles are documented;
- event versioning is documented;
- event ordering is documented;
- idempotency is documented;
- event consumers are documented;
- event producers are documented;
- failure handling is documented;
- replay strategy is documented;
- audit requirements are documented;
- mandatory events are included: `OrderCreated`, `OrderConfigured`, `OrderValidated`, `PriceCalculated`, `DiscountApplied`, `BonusReserved`, `PaymentStarted`, `PaymentConfirmed`, `OrderQueued`, `PreparationStarted`, `DispensingStarted`, `OrderCompleted`, `OrderCancelled`, `RefundStarted`, `RefundCompleted`, `OrderExpired`;
- every accepted Order state transition emits exactly one business event;
- documentation remains architecture-only;
- no application code is modified.

---

# 12. Out of Scope

ORDER-004 does not include:

- JavaScript implementation;
- frontend changes;
- React component changes;
- database migrations;
- event bus implementation;
- cloud infrastructure;
- payment provider integration;
- machine hardware commands;
- CRM screens;
- notification templates;
- analytics pipeline implementation;
- AI model implementation.
