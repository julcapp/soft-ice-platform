# Event Platform

Status: Draft
Version: 0.1
Project: Soft ICE Platform
Task: EPIC-210

## 1. Purpose of Event Platform

Event Platform defines how Soft ICE Platform records, names, publishes, stores and consumes events across domains.

An event is a formal fact that something already happened in the platform.

Every meaningful state change should eventually produce a formal event. Events are not UI analytics clicks only, and they are not direct service calls. They are domain contracts that allow Product, Finance, Machine, CRM, AI, Notification and future modules to react to state changes without importing each other directly.

This document is architecture-only. It does not introduce JavaScript implementation, dependencies, package changes or UI changes.

## 2. Role in Soft ICE Platform

Event Platform is part of Platform Core.

It provides the shared event language for:

- order lifecycle;
- product configuration lifecycle;
- pricing and financial lifecycle;
- payment lifecycle;
- vending machine lifecycle;
- customer and CRM lifecycle;
- notification lifecycle;
- analytics and AI training signals;
- audit and operational traceability.

Event Platform does not own Product, Finance, Machine, CRM or Notification business rules. Each domain remains responsible for its own state and only publishes facts after its own state transition is accepted.

## 3. Event Bus

Event Bus is the logical routing layer for events.

Responsibilities:

- accept valid events from producer domains;
- validate event envelope and event contract version;
- route events to subscribed consumers;
- preserve correlation and causation metadata;
- support retries, dead-letter handling and replay in future implementations;
- hide local or cloud transport details from domains.

Architecture rule:

```text
Domain -> Event Bus -> Consumer
```

Never:

```text
Domain -> Other Domain Service
```

The first implementation may use a local adapter or an in-process bus behind a stable interface. Future implementations may replace the transport with a durable cloud event bus without changing domain contracts.

## 4. Domain Events

Domain Events describe facts that happened inside one bounded context.

Examples:

- `ProductCatalogUpdated`
- `ConfigurationCreated`
- `RecipeCalculated`
- `PriceCalculated`
- `OrderCreated`
- `WalletDeposited`
- `BonusAccrued`
- `MachinePreparationStarted`
- `CustomerProfileUpdated`

Rules:

- domain events are emitted only after the domain state change is valid;
- domain events use stable English names;
- event payloads must use semantic IDs, not UI labels;
- a domain event must not require consumers to understand internal UI or repository details;
- a domain event can be internal or promoted to a public integration event.

## 5. Integration Events

Integration Events are public events intended for other domains, external adapters or future cloud services.

Examples:

- `OrderConfirmed`
- `PaymentCompleted`
- `PaymentFailed`
- `RefundCompleted`
- `ProductDelivered`
- `MachineErrorReported`
- `NotificationRequested`
- `NotificationSent`

Rules:

- integration events are stable contracts;
- consumers must rely only on the published contract, not producer internals;
- producers must preserve backward compatibility for active versions;
- external provider events must be translated into Soft ICE Platform event contracts before entering the platform.

## 6. Event Contracts

An event contract defines the event envelope, payload schema, version and compatibility rules.

Wire-level event fields use snake_case. Language-specific adapters may map fields internally, but public event contracts remain stable.

Base event envelope:

```json
{
  "event_id": "evt_01JZ0000000000000000000000",
  "event_name": "PaymentCompleted",
  "event_version": 1,
  "event_type": "integration",
  "source_domain": "finance.payment",
  "occurred_at": "2026-07-02T00:00:00Z",
  "aggregate_type": "payment",
  "aggregate_id": "payment_01JZ0000000000000000000000",
  "correlation_id": "order_01JZ0000000000000000000000",
  "causation_id": "evt_01JY0000000000000000000000",
  "actor": {
    "actor_type": "customer",
    "actor_id": "customer_01JZ0000000000000000000000"
  },
  "payload": {},
  "metadata": {
    "schema_name": "PaymentCompleted",
    "schema_version": 1,
    "producer": "PaymentEngine"
  }
}
```

Required envelope fields:

| Field | Purpose |
|---|---|
| `event_id` | Unique event identifier. |
| `event_name` | Stable English event name in PascalCase. |
| `event_version` | Integer contract version. |
| `event_type` | `domain` or `integration`. |
| `source_domain` | Producing domain or engine. |
| `occurred_at` | UTC timestamp when the fact happened. |
| `aggregate_type` | Business object type affected by the event. |
| `aggregate_id` | Stable ID of the affected business object. |
| `correlation_id` | Business flow identifier, often order ID. |
| `causation_id` | Event or command that caused this event, if known. |
| `actor` | Customer, machine, operator, system or provider that caused the change. |
| `payload` | Versioned event-specific data. |
| `metadata` | Technical metadata that is not business state. |

Payload rules:

- payloads are contracts;
- payloads must be minimal but sufficient for consumers;
- payloads must include stable IDs instead of translated labels;
- payloads must not include secrets;
- personal data is included only when required by the contract and allowed by consent and law;
- removing or changing the meaning of a payload field requires a new event version.

## 7. Event Naming Standard

Event names use stable English PascalCase.

Format:

```text
DomainObjectActionPast
```

Examples:

```text
OrderCreated
OrderConfirmed
PaymentCompleted
PaymentFailed
BonusAccrued
MachineErrorReported
NotificationSent
```

Naming rules:

- event names describe facts in past tense;
- event names do not describe commands, screens or buttons;
- event names do not include channel-specific prefixes unless the channel is the business fact;
- event names do not use Russian words, abbreviations or UI copy;
- event names are never reused with a different meaning;
- deprecated event names remain documented until all consumers are migrated.

Allowed status words:

- `Created`
- `Updated`
- `Calculated`
- `Confirmed`
- `Cancelled`
- `Started`
- `Completed`
- `Failed`
- `Expired`
- `Requested`
- `Sent`
- `Delivered`
- `Reported`

## 8. Event Versioning

Event contracts are versioned independently.

Version format:

```text
event_name + event_version
```

Example:

```text
PaymentCompleted v1
PaymentCompleted v2
```

Backward-compatible changes:

- adding an optional field;
- adding a nullable metadata field;
- adding a new enum value only when consumers are designed to ignore unknown values.

Breaking changes:

- removing a field;
- renaming a field;
- changing field meaning;
- changing field type;
- making an optional field required;
- changing event semantics.

Breaking changes require a new event version. Producers may publish multiple versions during migration. Consumers must declare which event versions they support.

## 9. Event Delivery

Target delivery model:

```text
At-least-once delivery with idempotent consumers.
```

Delivery rules:

- consumers must handle duplicate events by `event_id`;
- ordering is guaranteed only within one aggregate when the implementation supports it;
- cross-domain workflows must not depend on global ordering;
- failed delivery must be retried;
- poison events must move to a dead-letter queue or equivalent store;
- event replay must be possible for read models, CRM history, analytics and AI pipelines;
- exactly-once delivery is not assumed.

Event delivery must not become a hidden synchronous dependency between domains.

## 10. Event Storage

Event Storage is the durable record of platform events.

Responsibilities:

- append events immutably;
- preserve event envelope and payload;
- support audit queries;
- support replay for projections and analytics;
- support future retention policies by event category;
- separate platform event storage from business repositories.

Event Storage is not the same as Finance Ledger.

Finance Ledger is the authoritative financial journal for financial transactions. Event Storage records platform events for integration, audit, replay and observability. Financial events may reference ledger entries, but Event Storage does not replace the Ledger.

Future storage options:

- PostgreSQL append-only event table;
- transactional outbox per domain;
- dedicated event store;
- cloud event archive.

## 11. Event Security

Security rules:

- events must not contain credentials, tokens or payment secrets;
- personal data must be minimized;
- sensitive fields must be masked or tokenized where possible;
- event producers must be authenticated;
- external inbound events must be verified through provider signatures or trusted adapters;
- machine-originated events must identify machine ID, firmware or controller version when available;
- consumers may access only event categories they are allowed to process;
- event logs are audit data and must be protected from tampering;
- retention rules must respect legal, privacy and business requirements.

Security-sensitive event categories:

- payment;
- wallet;
- bonus;
- identity;
- customer profile;
- machine maintenance;
- provider webhooks;
- operator actions.

## 12. Future Cloud Event Bus

Event Platform must support migration to a cloud event bus.

Future cloud transport may include:

- managed queue;
- managed pub/sub;
- event streaming platform;
- cloud event bus;
- webhook gateway;
- message broker.

Cloud architecture rules:

- domain code must not depend on a specific cloud provider SDK;
- event contracts remain platform-owned;
- provider-specific metadata stays in transport metadata, not business payload;
- event publishing should use an outbox pattern for reliable state change plus event emission;
- consumers must be idempotent before cloud delivery is enabled;
- dead-letter and replay strategy must exist before production use.

## 13. Relationship with Product Platform

Product Platform is the source of truth for product catalog, product configuration, recipe and pricing preparation.

Product Platform publishes events such as:

- `ProductCatalogUpdated`
- `ConfigurationCreated`
- `ConfigurationValidated`
- `RecipeCalculated`
- `PriceCalculated`

Product Platform consumes events only through formal contracts. For example, future machine inventory events may update product availability projections, but they must not change the product catalog directly.

Rules:

- product IDs, flavor IDs, syrup IDs, topping IDs, recipe IDs and media IDs stay semantic and stable;
- product events must not include UI component state;
- pricing events describe calculated facts and do not perform payment or wallet changes.

## 14. Relationship with Finance Platform

Finance Platform owns financial state: transactions, wallet balances, bonus movements, ledger entries, payments, refunds and accounting adapters.

Finance Platform publishes events such as:

- `TransactionCreated`
- `LedgerEntryRecorded`
- `WalletDeposited`
- `WalletBalanceChanged`
- `BonusAccrued`
- `BonusRedeemed`
- `PaymentStarted`
- `PaymentCompleted`
- `PaymentFailed`
- `RefundCompleted`

Rules:

- financial operations are immutable;
- every financial state change must create a financial transaction or ledger record before publishing the corresponding event;
- Event Storage does not replace Finance Ledger;
- non-finance domains must not modify wallet, bonus, payment or ledger state directly.

## 15. Relationship with Machine Platform

Machine Platform owns vending machine state, machine commands, telemetry and preparation results.

Machine Platform publishes events such as:

- `MachineRegistered`
- `MachineStatusChanged`
- `MachineInventoryChanged`
- `MachinePreparationStarted`
- `IceCreamDispensed`
- `SyrupDispensed`
- `ToppingDispensed`
- `ProductReady`
- `ProductTaken`
- `MachineErrorReported`

Rules:

- machine commands are not the same as events;
- a request event may record an accepted business intent, but hardware execution remains inside Machine Platform;
- machine events must include machine ID and operation correlation where possible;
- UI must reflect real machine events, not assumed timers.

## 16. Relationship with CRM Platform

CRM Platform consumes platform events to build customer history, support operations, segmentation and service workflows.

CRM Platform publishes events such as:

- `CustomerCreated`
- `CustomerProfileUpdated`
- `ClubJoined`
- `OperatorActionRecorded`
- `SupportCaseCreated`
- `SupportCaseResolved`

Rules:

- CRM must not become the center of platform architecture;
- CRM consumes event contracts and builds projections;
- CRM may initiate workflows through commands or domain services, but resulting state changes must still emit events;
- customer profile events must follow privacy and consent rules.

## 17. Relationship with Notification Engine

Notification Engine reacts to events and sends messages through approved channels.

Notification Engine consumes events such as:

- `OrderConfirmed`
- `PaymentCompleted`
- `PaymentFailed`
- `ProductReady`
- `BonusAccrued`
- `BirthdayRewardIssued`
- `SupportCaseUpdated`

Notification Engine publishes events such as:

- `NotificationRequested`
- `NotificationSent`
- `NotificationFailed`
- `NotificationDeliveryConfirmed`

Rules:

- Notification Engine does not own order, payment, product or customer state;
- notifications are side effects of domain events;
- message templates are not event contracts;
- delivery status events must be correlated with the original triggering event.

## 18. Architecture Rules

1. Event Platform is documentation-only in EPIC-210.
2. No JavaScript implementation is introduced by this architecture document.
3. Events are facts, not commands.
4. Every meaningful state change should eventually emit a formal event.
5. Events must not create direct dependencies between domains.
6. Event payloads are contracts and must be versioned.
7. Event names use stable English PascalCase.
8. Event contracts use stable semantic IDs.
9. Producers own event creation and contract correctness.
10. Consumers own idempotency, retries and supported versions.
11. Analytics may consume formal platform events, but analytics events are not a substitute for domain events.
12. Finance Ledger remains the authority for financial operations.
13. Machine Platform remains the authority for hardware state.
14. Product Platform remains the authority for product configuration, recipe and pricing preparation.
15. CRM builds customer and operational projections from events; it is not the system-wide source of truth.
16. Notification Engine performs communication side effects and must not mutate source domains.
17. AI modules may consume event streams and publish recommendations, but AI output must be traceable to model version and source events.
18. Future cloud event transport must be replaceable through adapters.
