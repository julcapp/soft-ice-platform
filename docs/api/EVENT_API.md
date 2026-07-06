# Event API

Status: Draft
Version: 0.1
Date: 2026-07-06
Project: Soft ICE Platform / Utimoshi
Scope: Documentation only

## Purpose

This document defines the Event API direction for Soft ICE Platform.

Event API is the asynchronous contract boundary for platform facts. It defines how Runtime-owned facts are named, enveloped, versioned, delivered, retried, observed and consumed.

Core rule:

```text
Events are immutable.
Events describe facts.
Business logic belongs to Runtime.
Event API is transport independent.
No application code is defined by this document.
```

Event API may validate envelope shape, route events, enforce producer and consumer policy, apply idempotency, record delivery attempts, retry failed deliveries, move poison messages to dead-letter handling and expose observability metadata.

Event API must not calculate product configuration, pricing, discounts, bonuses, wallet balances, payment decisions, order transitions, machine fulfillment rules, notification content, promotion eligibility or analytics meaning.

## 1. Event API Vision

Soft ICE Platform Event API exists to connect platform Runtimes through accepted facts instead of direct implementation dependencies.

The Event API must support:

- order lifecycle traceability;
- payment, wallet, bonus and ledger-backed financial coordination;
- product, configuration, recipe, pricing and media change propagation;
- promotion and loyalty workflows;
- vending machine telemetry and fulfillment facts;
- customer and CRM projections;
- notification side effects;
- analytics, reporting and future AI pipelines;
- future external integrations and partner event feeds.

The Event API vision is:

```text
Runtime-owned facts.
Stable event contracts.
Transport-independent delivery.
Idempotent consumers.
Observable failures.
Replayable history.
```

The Event API supports the MVP goal:

```text
A customer can select a dessert, pay for it and receive it from a vending machine.
```

It also prepares the platform for multiple channels, product categories, payment providers, machine types, promotions, CRM workflows, analytics and AI modules.

## 2. Event Driven Architecture

Soft ICE Platform uses events to communicate facts after a Runtime has accepted a state change.

Approved flow:

```text
Command or external fact
  -> owning Runtime validates business rules
  -> owning Runtime persists accepted state or snapshot
  -> owning Runtime publishes event
  -> Event Runtime validates envelope and routes delivery
  -> consumers process idempotently
```

Forbidden flow:

```text
Event API
  -> decides business state
  -> mutates domain storage directly
  -> calls private engines
```

Architecture rules:

- events are immutable records of facts;
- events are published only after the producing Runtime accepts the fact;
- event payload meaning belongs to the producing Runtime;
- Event Runtime owns envelope validation, routing, delivery, retry, replay and dead-letter behavior;
- Event Runtime must not interpret business payload meaning;
- consumers must not assume exactly-once delivery;
- consumers must not depend on global event ordering;
- transport can change from in-process bus to queue, broker, stream or cloud event bus without changing event contracts;
- commands and events are separate contracts;
- analytics events are not a substitute for domain events.

## 3. Event Categories

Event API supports several event categories.

| Category | Meaning | Typical producer | Typical consumers |
|---|---|---|---|
| `domain` | Fact accepted inside one Runtime or bounded context. | Order, Payment, Product, Machine, Customer or Promotion Runtime. | Projections, CRM, analytics, notifications, related Runtimes. |
| `integration` | Stable fact intended for cross-runtime, adapter, partner or future external use. | Runtime or adapter boundary. | Other Runtimes, partners, webhooks, SDK clients, reporting. |
| `notification` | Fact about notification request, send attempt or delivery outcome. | Notification Runtime. | CRM, customer timeline, analytics, support tools. |
| `analytics` | Fact about an analytics projection, export or reporting pipeline. | Analytics Runtime. | Dashboards, export jobs, AI pipelines, operators. |
| `operational` | Infrastructure or machine operation fact relevant to observability. | Machine Runtime, Event Runtime, Platform Runtime. | Operations, health monitor, support, analytics. |
| `audit` | Security, operator, financial or compliance-relevant fact. | Runtime, API Gateway, Audit Log Service. | Audit tools, security review, CRM support, compliance exports. |

Category rules:

- category does not override event ownership;
- one event has one canonical category in the registry;
- the same business fact must not be published as multiple events only to satisfy multiple consumers;
- category changes that alter consumer expectations require a new event version or a new event name.

## 4. Domain Events

Domain events describe facts accepted inside one Runtime or bounded context.

Domain event rules:

- the producing Runtime owns the event contract;
- the event is emitted after business validation succeeds;
- payloads use stable platform IDs and immutable snapshot references;
- event names use the `<Domain>.<Fact>` format and describe facts in past tense;
- payloads must not contain UI component state, route state or translated display labels as source of truth;
- consumers must not call private producer internals to understand the event.

Required Event API domains:

| Domain | Runtime owner direction | Example domain events |
|---|---|---|
| Orders | Order Runtime | `Orders.Created`, `Orders.Confirmed`, `Orders.Queued`, `Orders.Completed`, `Orders.Cancelled`, `Orders.Expired` |
| Payments | Payment Runtime | `Payments.Started`, `Payments.Completed`, `Payments.Failed`, `Payments.Cancelled`, `Payments.RefundCompleted` |
| Wallet | Wallet Runtime and Ledger-backed Finance Runtime | `Wallet.EntryRecorded`, `Wallet.Deposited`, `Wallet.Debited`, `Wallet.BalanceChanged`, `Wallet.AdjustmentRecorded` |
| Bonus | Bonus Runtime | `Bonus.Accrued`, `Bonus.Reserved`, `Bonus.Redeemed`, `Bonus.Released`, `Bonus.Expired`, `Bonus.Reversed` |
| Products | Product, Catalog, Configuration, Recipe, Pricing and Media Runtimes | `Products.CatalogUpdated`, `Products.ConfigurationCreated`, `Products.ConfigurationValidated`, `Products.RecipeCalculated`, `Products.PriceCalculated`, `Products.MediaResolved` |
| Promotions | Promotion Runtime | `Promotions.Activated`, `Promotions.ParticipationRecorded`, `Promotions.RewardIssued`, `Promotions.PromoCodeApplied`, `Promotions.Expired` |
| Machines | Machine Runtime | `Machines.Registered`, `Machines.StatusChanged`, `Machines.InventoryChanged`, `Machines.PreparationStarted`, `Machines.ProductReady`, `Machines.ProductTaken`, `Machines.ErrorReported` |
| Customers | Customer and CRM Runtime | `Customers.Created`, `Customers.ProfileUpdated`, `Customers.ClubJoined`, `Customers.ConsentGranted`, `Customers.ConsentRevoked`, `Customers.NotificationPreferenceChanged` |
| Analytics | Analytics Runtime | `Analytics.ProjectionUpdated`, `Analytics.SalesSummaryUpdated`, `Analytics.CustomerFunnelUpdated`, `Analytics.ExportRequested`, `Analytics.ExportCompleted` |

The table is a contract direction, not a complete schema catalog. Exact payload schemas belong in the Event Registry and future schema files.

## 5. Integration Events

Integration events are stable facts intended for cross-runtime, adapter, partner or future external consumption.

Integration event rules:

- integration events are public platform contracts;
- integration events must be backward compatible for active versions;
- external provider payloads must be translated into platform event contracts before entering the platform;
- integration events must not expose provider secrets, raw machine protocol payloads, private repository fields or internal engine state;
- partner-visible integration events require explicit authorization and data minimization policy;
- integration events should include enough stable IDs for consumers to correlate without private producer access.

Recommended integration event candidates:

| Event | Producer | Integration purpose |
|---|---|---|
| `Orders.Confirmed` | Order Runtime | Start payment, CRM timeline, customer notification and analytics flow. |
| `Payments.Completed` | Payment Runtime | Confirm settlement fact for Order, Finance, CRM and analytics. |
| `Payments.Failed` | Payment Runtime | Trigger recovery, customer notification and support visibility. |
| `Payments.RefundCompleted` | Payment or Refund Runtime | Close compensation flow and update projections. |
| `Bonus.Accrued` | Bonus Runtime | Update customer loyalty view and CRM timeline. |
| `Machines.ProductReady` | Machine Runtime | Notify customer and update order progress projection. |
| `Machines.ErrorReported` | Machine Runtime | Alert operations and support workflows. |
| `Promotions.RewardIssued` | Promotion Runtime | Notify customer and update bonus or discount projections through approved contracts. |
| `Customers.ConsentRevoked` | Customer or Consent Runtime | Stop restricted notification or analytics processing where required. |
| `Analytics.ExportCompleted` | Analytics Runtime | Notify approved operators or partners that an export is ready. |

Integration events do not request work by themselves. A consumer may react to a fact by issuing an approved command to its own Runtime or another Runtime contract.

## 6. Notification Events

Notification events describe facts about notification orchestration and delivery.

Notification event rules:

- Notification Runtime owns notification event contracts;
- notification events are side-effect facts, not source-domain state;
- templates, localization text and channel-specific rendering are not event contracts;
- notification payloads must reference source facts through `correlation_id`, `causation_id` and event references;
- notification events must not contain raw access tokens, bot tokens, provider secrets or unrestricted message bodies;
- provider delivery callbacks must be authenticated before delivery facts are accepted.

Recommended notification events:

| Event | Meaning |
|---|---|
| `Notifications.Requested` | Notification Runtime accepted a request to send a message. |
| `Notifications.Prepared` | Template, channel and recipient references were resolved. |
| `Notifications.Sent` | Message was submitted to the provider or channel. |
| `Notifications.Failed` | Send or delivery attempt failed. |
| `Notifications.DeliveryConfirmed` | Provider or channel confirmed delivery where supported. |
| `Notifications.Suppressed` | Notification was intentionally not sent due to preference, consent, policy or deduplication. |

Notification suppression must be a documented fact when it matters for customer support, audit or analytics. The reason belongs to Notification Runtime policy, not Event API routing.

## 7. Event Envelope

Every Event API message uses a stable envelope around Runtime-owned payload.

Recommended envelope:

```json
{
  "event_id": "evt_01JZ0000000000000000000000",
  "event_name": "Orders.Confirmed",
  "event_version": 1,
  "event_category": "domain",
  "source_runtime_id": "runtime_order",
  "source_domain": "orders",
  "occurred_at": "2026-07-06T00:00:00Z",
  "published_at": "2026-07-06T00:00:01Z",
  "aggregate_type": "order",
  "aggregate_id": "order_01JZ0000000000000000000000",
  "aggregate_sequence": 3,
  "correlation_id": "checkout_01JZ0000000000000000000000",
  "causation_id": "command_confirm_order_01JZ0000000000000",
  "idempotency_key": "order_01JZ_confirm_v3",
  "actor_context": {
    "actor_type": "customer",
    "actor_id": "customer_01JZ0000000000000000000000"
  },
  "payload": {},
  "metadata": {
    "schema_ref": "event://orders/Orders.Confirmed/v1",
    "producer": "Order Runtime",
    "environment": "production"
  }
}
```

Required envelope fields:

| Field | Meaning |
|---|---|
| `event_id` | Globally unique event identity. Reused for publication retries of the same fact. |
| `event_name` | Stable semantic event name in `<Domain>.<Fact>` format. |
| `event_version` | Integer event contract version. |
| `event_category` | `domain`, `integration`, `notification`, `analytics`, `operational` or `audit`. |
| `source_runtime_id` | Runtime that produced the event, using Runtime Registry IDs. |
| `source_domain` | Domain area that owns the event meaning. |
| `occurred_at` | UTC timestamp when the business or operational fact occurred. |
| `published_at` | UTC timestamp when Event Runtime accepted the event for delivery. |
| `aggregate_type` | Business object type affected by the fact when applicable. |
| `aggregate_id` | Stable ID of the affected aggregate or resource when applicable. |
| `correlation_id` | End-to-end flow identifier. |
| `causation_id` | Command, request, event or external fact that caused this event when known. |
| `payload` | Runtime-owned versioned event data. |
| `metadata` | Technical metadata that is not business state. |

Recommended optional envelope fields:

| Field | Meaning |
|---|---|
| `aggregate_sequence` | Monotonic sequence inside one aggregate where the Runtime can provide it. |
| `idempotency_key` | Key used to prevent duplicate accepted side effects or duplicate consumer processing. |
| `actor_context` | Safe customer, operator, machine, provider, partner or system actor reference. |
| `authorization_context_ref` | Safe reference to authorization decision or scope metadata where required. |
| `trace_context` | Future distributed tracing metadata. |
| `replay_context` | Present only during replay delivery. |

Envelope rules:

- envelope fields use `snake_case`;
- timestamps use UTC ISO 8601 / RFC 3339 format;
- envelope metadata must not contain secrets;
- payload schema is versioned independently from transport implementation;
- adapters may map names internally, but public Event API contracts must remain stable.

## 8. Event Metadata

Event metadata carries technical context needed for routing, observability, security, replay and support.

Recommended metadata fields:

| Field | Meaning |
|---|---|
| `schema_ref` | Stable reference to the event schema. |
| `producer` | Producing Runtime, Engine or adapter label safe for logs. |
| `producer_version` | Runtime or producer implementation version when useful for diagnostics. |
| `environment` | Development, staging or production. |
| `contract_status` | Active, deprecated or experimental. |
| `sensitivity` | Public, internal, confidential, payment-sensitive, personal-data or audit-sensitive. |
| `retention_policy` | Reference to configured retention policy. |
| `delivery_policy` | Reference to delivery and retry policy. |
| `ordering_key` | Key used by transport when ordering is supported. |
| `partition_key` | Transport-neutral routing key where needed. |
| `outbox_id` | Producer outbox record reference when implemented. |
| `recorded_at` | Timestamp when stored in Event Storage. |

Metadata rules:

- metadata is not a place for business state;
- metadata must not include raw credentials, tokens, API keys, provider signatures or payment secrets;
- metadata should preserve enough information to debug delivery without reading private domain storage;
- replay must preserve original event metadata and add replay context separately;
- transport-specific metadata must remain outside business payload.

## 9. Event Versioning

Event contracts are versioned independently from REST API, Runtime implementation and transport.

Version identity:

```text
event_name + event_version
```

Examples:

```text
Orders.Confirmed v1
Orders.Confirmed v2
Payments.Completed v1
```

Backward-compatible changes may stay in the same version:

- adding an optional field;
- adding a nullable metadata field;
- adding a new enum value only when consumers must ignore unknown values;
- adding an optional nested object.

Breaking changes require a new version:

- removing a field;
- renaming a field;
- changing field type;
- changing field meaning;
- making an optional field required;
- changing event semantics;
- changing amount, currency, state or identity interpretation.

Versioning rules:

- every event must declare `event_version`;
- consumers must declare supported event names and versions;
- producers may publish old and new versions during migration;
- deprecated versions remain documented until all consumers are migrated;
- feature flags must not hide breaking contract changes;
- event names must not be reused with a different meaning.

## 10. Event Ordering

Event API does not guarantee global ordering.

Ordering rules:

- ordering may be guaranteed only inside one aggregate when the implementation supports it;
- aggregate ordering uses `aggregate_type`, `aggregate_id` and `aggregate_sequence` when available;
- cross-domain workflows must not depend on global event order;
- consumers must tolerate duplicate, delayed and out-of-order events;
- consumers should detect gaps by aggregate sequence or domain snapshot version where available;
- consumers should buffer, reconcile, skip or dead-letter out-of-order events according to their own policy;
- Event Runtime may preserve transport ordering keys, but Runtime owns the business sequence meaning.

Recommended ordering keys:

| Domain | Ordering key |
|---|---|
| Orders | `order_id` or `aggregate_id` with order state version. |
| Payments | `payment_id`; refund events may use `refund_id`. |
| Wallet | `wallet_id` or `customer_id` plus ledger sequence reference. |
| Bonus | `bonus_account_id`, `bonus_reservation_id` or `customer_id`. |
| Products | `product_id` or catalog version. |
| Promotions | `promotion_id` or participation ID. |
| Machines | `machine_id` plus machine operation ID. |
| Customers | `customer_id`. |
| Analytics | projection ID or export request ID. |

## 11. Event Delivery

Target delivery model:

```text
At-least-once delivery with idempotent consumers.
```

Delivery rules:

- exactly-once delivery is not assumed;
- successful publish means Event Runtime accepted the envelope, not that every consumer has completed work;
- consumers deduplicate by `event_id` and, where needed, domain idempotency keys;
- event publication retries must reuse the same `event_id`;
- failed consumer delivery must be retried according to configured policy;
- repeated failure must move to dead-letter handling;
- replay must not create new business facts;
- side-effect consumers must suppress unsafe side effects during replay;
- delivery status must be observable through logs, telemetry, health and support tools.

Delivery states:

| State | Meaning |
|---|---|
| `accepted` | Event Runtime accepted the event envelope. |
| `stored` | Event was durably stored where storage is enabled. |
| `scheduled` | Delivery was scheduled for a consumer or subscription. |
| `delivered` | Consumer acknowledged successful processing. |
| `retrying` | Delivery failed and is scheduled for retry. |
| `dead_lettered` | Delivery exceeded retry or validation policy and needs review. |
| `skipped` | Delivery was intentionally skipped by policy, version support or replay rules. |

## 12. Retry Policy

Retry policy is infrastructure behavior. Business compensation belongs to Runtime.

Retry rules:

- retries must be bounded;
- retries must preserve the original envelope, `event_id`, `occurred_at`, `correlation_id` and `causation_id`;
- retries must not create duplicate business facts;
- transient errors may use exponential backoff or configured delay schedules;
- permanent validation errors should move to dead-letter without repeated noisy retries;
- consumer code must be idempotent before retries are enabled;
- payment, wallet, bonus, order and machine events must prefer consistency over silent continuation;
- retry outcomes must be visible through telemetry and support views.

Recommended retry metadata:

| Field | Meaning |
|---|---|
| `delivery_id` | Unique delivery attempt chain identity. |
| `consumer_id` | Consumer or subscription target. |
| `attempt_number` | Current attempt number. |
| `max_attempts` | Configured retry limit. |
| `next_attempt_at` | Scheduled next retry timestamp. |
| `last_error_code` | Safe machine-readable failure code. |
| `retryable` | Whether another retry is allowed. |

Event API retry policy must not decide whether to cancel an order, refund a payment, release a bonus, change a wallet balance or mark a machine operation failed. Those decisions belong to the owning Runtime.

## 13. Dead Letter Queue

Dead Letter Queue, or equivalent dead-letter storage, captures events or deliveries that cannot be processed safely.

Dead-letter scenarios:

- envelope is invalid after acceptance boundary is reached;
- schema version is unsupported by required consumers;
- consumer repeatedly fails;
- payload violates schema shape;
- authorization policy blocks delivery;
- source runtime is not trusted for the event name;
- ordering gap exceeds consumer recovery policy;
- poison message cannot be handled by automated retry.

Dead-letter rules:

- dead-lettered items must not be discarded silently;
- original envelope and metadata must be preserved;
- failure reason must be safe, structured and observable;
- replay or redrive requires explicit authorization and audit;
- redrive must preserve original `event_id`;
- manual correction must create a new explicit correction event or audit record where required;
- dead-letter queues must not become hidden business workflow queues.

Recommended dead-letter record fields:

| Field | Meaning |
|---|---|
| `dead_letter_id` | Stable dead-letter record ID. |
| `event_id` | Original event ID. |
| `consumer_id` | Failed consumer or subscription where applicable. |
| `failure_code` | Stable failure reason. |
| `failure_message` | Safe human-readable summary. |
| `attempt_count` | Delivery attempts before dead-letter. |
| `first_failed_at` | First failure timestamp. |
| `dead_lettered_at` | Dead-letter timestamp. |
| `correlation_id` | Flow trace ID. |
| `redrive_status` | Pending, approved, redriven, skipped or closed. |

## 14. Idempotent Consumers

Every Event API consumer must be idempotent.

Consumer idempotency rules:

- deduplicate by `event_id` at minimum;
- use domain keys such as `order_id + aggregate_sequence` when needed;
- store processed event references before or atomically with side effects where possible;
- repeated delivery of the same event must not repeat external side effects;
- replay mode must suppress non-replay-safe actions such as payments, refunds, machine commands and customer messages;
- unsupported event versions must be rejected, skipped or transformed according to documented consumer policy;
- consumers must not mutate another Runtime's private state;
- consumers must record safe processing telemetry and failure reason.

Recommended consumer processing record:

| Field | Meaning |
|---|---|
| `consumer_id` | Stable consumer or subscription ID. |
| `event_id` | Processed event ID. |
| `event_name` | Event name. |
| `event_version` | Event version. |
| `processing_status` | Processing, processed, skipped, failed or dead-lettered. |
| `processed_at` | Completion timestamp. |
| `correlation_id` | Flow trace ID. |
| `side_effect_mode` | Live, replay-suppressed or dry-run. |

Idempotency Service may provide storage and duplicate detection. Runtime and consumers own their domain-safe side effects.

## 15. Event Registry

Event Registry is the source of truth for event names, owners, schemas and delivery policy.

Registry entry fields:

| Field | Meaning |
|---|---|
| `event_name` | Stable `<Domain>.<Fact>` name. |
| `event_version` | Integer contract version. |
| `event_category` | Domain, integration, notification, analytics, operational or audit category. |
| `source_runtime_id` | Runtime that owns the event. |
| `source_domain` | Domain namespace. |
| `aggregate_type` | Aggregate or resource type where applicable. |
| `schema_ref` | Schema location or future schema registry reference. |
| `payload_owner` | Runtime or team responsible for payload semantics. |
| `producer_permission` | Permission required to publish. |
| `consumer_permission` | Permission required to subscribe or consume. |
| `sensitivity` | Data sensitivity classification. |
| `retention_policy` | Retention policy reference. |
| `ordering_key` | Recommended ordering key. |
| `idempotency_key_pattern` | Recommended duplicate handling key. |
| `replay_safe` | Whether replay is allowed and under which mode. |
| `status` | Draft, active, deprecated or retired. |

Initial Event API registry direction:

| Domain | Source Runtime | Event candidates |
|---|---|---|
| Orders | `runtime_order` | `Orders.Created`, `Orders.Configured`, `Orders.Validated`, `Orders.PriceCalculated`, `Orders.DiscountApplied`, `Orders.BonusReserved`, `Orders.PaymentStarted`, `Orders.PaymentConfirmed`, `Orders.Queued`, `Orders.PreparationStarted`, `Orders.DispensingStarted`, `Orders.Completed`, `Orders.Cancelled`, `Orders.RefundStarted`, `Orders.RefundCompleted`, `Orders.Expired` |
| Payments | `runtime_payment` | `Payments.Started`, `Payments.Completed`, `Payments.Failed`, `Payments.Cancelled`, `Payments.RefundRequested`, `Payments.RefundCompleted`, `Payments.Reconciled` |
| Wallet | `runtime_wallet` | `Wallet.EntryRecorded`, `Wallet.Deposited`, `Wallet.Debited`, `Wallet.BalanceChanged`, `Wallet.AdjustmentRecorded` |
| Bonus | `runtime_bonus` | `Bonus.Accrued`, `Bonus.Reserved`, `Bonus.Redeemed`, `Bonus.Released`, `Bonus.Expired`, `Bonus.Reversed` |
| Products | `runtime_product`, `runtime_catalog`, `runtime_configuration`, `runtime_recipe`, `runtime_pricing`, `runtime_media` | `Products.CatalogUpdated`, `Products.AvailabilityChanged`, `Products.ConfigurationCreated`, `Products.ConfigurationValidated`, `Products.RecipeCalculated`, `Products.PriceCalculated`, `Products.MediaResolved` |
| Promotions | `runtime_promotion` | `Promotions.Activated`, `Promotions.ParticipationRecorded`, `Promotions.RewardIssued`, `Promotions.PromoCodeApplied`, `Promotions.Expired`, `Promotions.Cancelled` |
| Machines | `runtime_machine` | `Machines.Registered`, `Machines.StatusChanged`, `Machines.InventoryChanged`, `Machines.PreparationStarted`, `Machines.IceCreamDispensed`, `Machines.SyrupDispensed`, `Machines.ToppingDispensed`, `Machines.ProductReady`, `Machines.ProductTaken`, `Machines.ErrorReported` |
| Customers | `runtime_customer_crm` | `Customers.Created`, `Customers.ProfileUpdated`, `Customers.ClubJoined`, `Customers.ConsentGranted`, `Customers.ConsentRevoked`, `Customers.OperatorActionRecorded`, `Customers.SupportCaseCreated`, `Customers.SupportCaseResolved` |
| Analytics | `runtime_analytics` | `Analytics.ProjectionUpdated`, `Analytics.SalesSummaryUpdated`, `Analytics.ProductPerformanceUpdated`, `Analytics.MachinePerformanceUpdated`, `Analytics.CustomerFunnelUpdated`, `Analytics.ExportRequested`, `Analytics.ExportCompleted` |
| Notifications | `runtime_notification` | `Notifications.Requested`, `Notifications.Prepared`, `Notifications.Sent`, `Notifications.Failed`, `Notifications.DeliveryConfirmed`, `Notifications.Suppressed` |

Registry rules:

- an event cannot be published until it has an approved registry entry;
- event names cannot be reused with different meanings;
- retired events remain reserved;
- producers and consumers must declare supported versions;
- sensitive event categories require explicit consumer permission;
- Event Registry may later be represented as schemas, AsyncAPI or another formal contract format.

## 16. Event Naming

Event names use stable English `<Domain>.<Fact>` format.

Preferred format:

```text
<Domain>.<Fact>
```

Examples:

```text
Orders.Confirmed
Payments.Completed
Wallet.BalanceChanged
Bonus.Reserved
Products.CatalogUpdated
Promotions.RewardIssued
Machines.ErrorReported
Customers.ProfileUpdated
Analytics.ProjectionUpdated
Notifications.Sent
```

Naming rules:

- the domain segment must use an approved Event Registry domain;
- the fact segment must be an English PascalCase fact phrase;
- names describe facts that already happened;
- names do not describe commands, wishes or future work;
- names do not use UI labels, screen names or button names;
- names do not use Russian words or abbreviations;
- names do not include transport, provider or queue technology;
- names do not omit the domain prefix;
- names remain stable after publication;
- changed meaning requires a new event version or a new event name;
- deprecated names remain documented until migration is complete.

Allowed action words include:

- `Created`;
- `Updated`;
- `Validated`;
- `Calculated`;
- `Confirmed`;
- `Cancelled`;
- `Started`;
- `Completed`;
- `Failed`;
- `Expired`;
- `Requested`;
- `Reserved`;
- `Released`;
- `Redeemed`;
- `Issued`;
- `Sent`;
- `Delivered`;
- `Reported`;
- `Suppressed`.

Invalid examples:

```text
ClickPayButton
SendOrderToMachine
OplataUspeshna
PaymentDoneAgain
KafkaOrderMessage
OrderConfirmed
```

## 17. Security

Event API security follows Authentication and Authorization documentation.

Security rules:

- event producers must be authenticated;
- event producers must be authorized to publish the event name and version;
- consumers must be authorized to subscribe to event categories and sensitivity levels;
- provider-originated facts must be verified before platform events are produced;
- machine-originated facts must include authenticated machine or adapter identity;
- customer, payment, wallet, bonus and consent events require data minimization;
- event payloads must not contain credentials, tokens, API keys, provider signatures, raw payment credentials or secrets;
- personal data must be minimized and governed by consent, privacy and retention policy;
- replay and dead-letter redrive require strict authorization and audit;
- event logs and storage must be protected from tampering;
- event access must be observable through telemetry and audit where required.

Recommended permissions:

| Permission | Meaning |
|---|---|
| `runtime:event:publish` | Internal Runtime or service may publish approved events. |
| `runtime:event:consume` | Internal Runtime or service may consume approved event subscriptions. |
| `admin:event:read` | Operator may read event metadata and safe payload views. |
| `admin:event:redrive` | Operator may approve replay or dead-letter redrive. |
| `partner:event:receive` | Partner may receive approved integration events. |
| `analytics:event:consume` | Analytics Runtime may consume approved domain and integration events. |

Security context rules:

- `actor_context` identifies who or what caused the fact;
- event producer identity identifies which Runtime published the fact;
- authorization context references may be included for audit but must not expose policy internals;
- external aliases such as TelegramID, phone or provider customer IDs must not replace platform IDs in internal event contracts;
- secrets stay outside event payloads, metadata, logs and examples.

## 18. Acceptance Criteria

This documentation increment is acceptable when:

- `docs/api/EVENT_API.md` defines Event API vision;
- Event Driven Architecture is documented;
- Event Categories are documented;
- Domain Events are documented;
- Integration Events are documented;
- Notification Events are documented;
- Event Envelope is documented;
- Event Metadata is documented;
- Event Versioning is documented;
- Event Ordering is documented;
- Event Delivery is documented;
- Retry Policy is documented;
- Dead Letter Queue is documented;
- Idempotent Consumers are documented;
- Event Registry is documented;
- Event Naming is documented;
- Security is documented;
- Future Roadmap is documented;
- required event domains are documented: Orders, Payments, Wallet, Bonus, Products, Promotions, Machines, Customers and Analytics;
- events are explicitly immutable;
- events explicitly describe facts;
- business logic is explicitly assigned to Runtime;
- Event API is explicitly transport independent;
- documentation remains documentation-only;
- no application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output is modified.

Future implementation acceptance criteria:

- every published event has a registry entry;
- every event envelope validates against a documented schema;
- every producer is authenticated and authorized;
- every consumer is idempotent;
- retries reuse the same `event_id`;
- dead-letter handling preserves original envelope and metadata;
- replay suppresses unsafe side effects;
- observability covers publish, delivery, retry, dead-letter and replay flows;
- Event Runtime remains free of business logic.

## 19. Future Roadmap

Recommended Event API roadmap:

1. Create formal Event Registry entries for all active event names and versions.
2. Fill `docs/data/EVENT_CATALOG.md` or an equivalent schema catalog with exact payload contracts.
3. Define JSON Schema or equivalent event envelope and payload schemas.
4. Define AsyncAPI or equivalent event contract publication format.
5. Define event producer and consumer permission matrix.
6. Define event retention policy by category and sensitivity.
7. Define transactional outbox policy for producer Runtimes.
8. Define Event Store architecture and replay controls.
9. Define dead-letter review, redrive and audit workflow.
10. Define event delivery telemetry dashboards and alert rules.
11. Define contract tests for event envelope validation and consumer version support.
12. Define Product, Finance, Order, Machine, Customer, Promotion, Notification and Analytics event payload schemas.
13. Define partner-facing integration event subset.
14. Define cloud event bus or broker adapter requirements.
15. Review production Event API contracts before launch.
