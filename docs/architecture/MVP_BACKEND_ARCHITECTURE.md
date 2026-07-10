# MVP Backend Architecture Specification

Document code: ARCH-MVP-BACKEND-001
Task: EPIC-205 / TECH-001
Status: Draft
Version: 0.2
Date: 2026-07-10
Project: Soft ICE Platform / Utimoshi
Scope: Documentation only. No application code changes.

Related documents:

- `docs/releases/MVP_IMPLEMENTATION_ROADMAP.md`
- `docs/releases/MVP_LAUNCH_READINESS.md`
- `docs/product/MINI_APP_MVP_SPEC.md`
- `docs/product/TELEGRAM_BOT_FLOW.md`
- `docs/product/LANDING_SPEC.md`
- `docs/domain/CUSTOMER_DOMAIN.md`
- `docs/domain/CLUB_ACCOUNT.md`
- `docs/domain/BONUS_DOMAIN.md`
- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/domain/MACHINE_DOMAIN.md`
- `docs/data/PLATFORM_DATA_MODEL.md`
- `docs/architecture/PROJECT_DECISIONS.md`

---

# 0. MVP constraint

This specification is intentionally scoped to the first real vending machine launch.

The architecture must support:

- one production backend deployable;
- one primary PostgreSQL database;
- one launch product slice;
- one initial external payment provider path;
- one real vending machine integration path;
- auditable customer, order, payment and machine records;
- safe support and recovery for failed or ambiguous dispensing outcomes.

The architecture must avoid overengineering. The MVP must not introduce distributed-system complexity unless a strong production reason requires it.

Default MVP exclusions:

- no microservice split by default;
- no external message broker by default;
- no separate event-sourcing platform;
- no CQRS read-store split by default;
- no service mesh;
- no Kubernetes requirement;
- no multi-region or active-active deployment requirement;
- no separate identity, payment, notification or machine service unless a real constraint proves it necessary;
- no analytics warehouse or heavy observability stack for first launch.

Strong reasons for separation are limited to practical constraints such as provider network requirements, security isolation, machine vendor deployment requirements, proven load, separate uptime needs or operational ownership that cannot be handled safely inside the monolith.

If there is doubt, keep the capability inside the modular monolith and preserve a clean module boundary for later extraction.

---

# 1. Architecture goal

The MVP backend exists to support the first safe production launch of Soft ICE Platform:

```text
Telegram entry
-> Mini App authentication
-> customer account
-> order
-> payment
-> paid machine dispatch
-> customer notification and support trace
```

The backend must support:

- Telegram Bot as the entry, notification and Mini App launch channel;
- Telegram Mini App as the authenticated customer self-service UI;
- canonical customer accounts based on `customer_id`;
- Club Account customer-facing prepaid balance;
- Bonus Account non-monetary discount rights;
- payment processing through provider-agnostic Payment Module with YooKassa/SBP as the first external path;
- orders with immutable product, pricing, payment and fulfillment references;
- machine integration for paid-order preparation only.

The backend must not be designed as a distributed system for the first launch. The MVP goal is reliable commercial execution for a narrow production slice, not maximum infrastructure sophistication.

Primary success criteria:

- one real customer can authenticate through Telegram;
- one approved product can be ordered;
- one real payment can be confirmed by the backend;
- one machine can receive only a paid dispatch command;
- payment, order, customer, machine and loyalty records remain auditable;
- support can reconstruct what happened without relying on provider dashboards or frontend state.

# 2. Architecture approach

## Modular monolith

The default MVP backend architecture is a modular monolith.

This means:

- one backend deployable;
- one primary PostgreSQL database;
- clear internal module boundaries;
- domain logic kept inside domain modules;
- adapters isolated from domain rules;
- REST, webhook and event handling routed through module contracts;
- no separate microservices for the first launch unless a production constraint proves they are required.

The modular monolith is the right MVP default because it keeps deployment, debugging, transactions, local development and operational recovery simple while still preserving future separation paths.

For the first machine launch, module separation is a code, data ownership and contract discipline inside one deployable. It is not a requirement to run separate services.

## Domain boundaries

Each backend module owns its source-of-truth records and domain rules. Other modules may use references, snapshots, events or read projections, but must not mutate another module's records directly.

Core boundary rules:

- Customer owns `customer_id`, profile, consent links and Telegram identity aliases.
- Club Account owns prepaid balance rules and account transactions.
- Bonus owns bonus rights, bonus transactions, accrual, spending and referral bonuses.
- Payment owns payment lifecycle, provider integration, payment operations and refunds.
- Order owns purchase lifecycle, accepted product snapshots, payment binding and fulfillment state.
- Machine owns machine identity, readiness, inventory, telemetry, commands and physical outcomes.
- Notification owns notification requests, channel delivery policy and delivery records.

API handlers, webhooks and adapters are not allowed to contain business decisions. They authenticate, validate, deduplicate and route work into modules.

## Future scalability path

The MVP must be structured so selected modules can later move out of the monolith without rewriting the domain model.

Planned path:

```text
Modular monolith
->
Selected services
->
Distributed architecture
```

The first extraction candidates, if load or operations require it later, are:

- Payment adapter and webhook processing;
- Machine adapter and telemetry ingestion;
- Notification delivery;
- Analytics projections.

Extraction is a future operational decision. It is not part of the MVP launch requirement.

# 3. High level architecture

## Frontend

### Landing

The Landing is a public website and acquisition surface.

Responsibilities:

- explain the brand and vending concept;
- route customers to Telegram Bot or Mini App entry;
- show approved static product, Club and machine information;
- avoid authenticated account, payment or machine-control logic.

Landing must not calculate product price, confirm payment, show unimplemented live machine availability or access customer account data.

### Telegram Bot

Telegram Bot is the customer communication channel.

Responsibilities:

- handle `/start` and entry links;
- open the Mini App;
- provide customer-safe menu actions;
- deliver transactional and consented marketing notifications through Notification Module;
- route support and recovery links.

The bot does not own customer identity, balances, bonuses, order state, payment state or machine execution.

### Mini App

Telegram Mini App is the authenticated customer UI.

Responsibilities:

- send Telegram WebApp `initData` to backend authentication;
- show customer profile, Club Account, Bonus Account and purchase state;
- submit product selection and checkout commands;
- show backend-confirmed payment and fulfillment states;
- provide support handoff.

Mini App does not calculate final price, confirm payment, mutate balances, redeem bonuses locally or command machines.

## Backend

### API Layer

The API Layer exposes REST endpoints, webhook endpoints and authenticated integration endpoints.

Responsibilities:

- Telegram Mini App authentication exchange;
- customer-facing REST API;
- Telegram Bot backend API;
- YooKassa/SBP webhook endpoint;
- machine provider callback or adapter endpoint;
- request validation, authentication, authorization and idempotency;
- correlation ID and audit context propagation.

The API Layer must call module contracts. It must not bypass modules or write directly to module tables.

### Domain Modules

Domain Modules implement backend business logic inside the monolith.

MVP modules:

- Customer Module;
- Club Account Module;
- Bonus Module;
- Payment Module;
- Order Module;
- Machine Module;
- Notification Module.

Product Catalog, Pricing, Discount and Media remain required dependencies for checkout and order snapshots, but this document does not redefine their domain rules.

### Database

The backend uses PostgreSQL as the primary production database.

PostgreSQL stores:

- customer and identity records;
- consent references and summaries;
- Club Account transactions;
- Bonus transactions and projections;
- orders and immutable snapshots;
- payments, sessions, operations and refunds;
- machine records, operations, inventory and telemetry facts;
- notification requests and delivery attempts;
- event outbox and audit records;
- idempotency records.

### Event Layer

The MVP Event Layer is internal to the monolith and database-backed by default.

Recommended MVP shape:

- domain events are appended after accepted module facts;
- an outbox table stores events for reliable publication and projection updates;
- consumers are idempotent;
- failed delivery is retried and eventually routed to manual review or dead-letter storage.

An external broker is not required for MVP unless production constraints require it.

### Integration Layer

The Integration Layer contains adapters for systems outside the platform.

MVP adapters:

- Telegram API adapter;
- YooKassa provider adapter;
- SBP confirmation path through payment provider capabilities;
- machine provider or machine adapter API;
- optional infrastructure adapters for logging, monitoring and secret loading.

Adapters translate external payloads into platform commands or facts. External payload shapes must not leak into domain module models.

# 4. Backend modules

## Customer Module

Responsibilities:

- registration;
- profile;
- consent;
- Telegram identity.

MVP responsibilities in more detail:

- resolve or create canonical `customer_id`;
- link verified Telegram user ID as an external identity alias;
- store customer lifecycle state;
- store safe profile fields and contact references;
- expose consent summary and consent references;
- support Club Timofey membership state;
- provide customer-safe read model for Mini App and Bot;
- publish customer events such as identity linked, profile updated and consent changed.

Out of scope:

- payment confirmation;
- bonus accrual;
- Club Account balance mutation;
- order lifecycle;
- machine dispatch.

## Club Account Module

Responsibilities:

- money balance;
- deposits;
- transactions;
- withdrawals/refunds.

MVP responsibilities in more detail:

- manage one customer-facing prepaid RUB account per customer where Club Account is enabled;
- keep available and reserved balance;
- create top-up intent references;
- apply credited top-ups only after accepted Payment facts;
- reserve and capture balance for accepted purchases where Club Account payment is enabled;
- record immutable Club Account transactions;
- support refund credit or withdrawal/refund workflow according to approved policy;
- keep Club Account separate from Bonus Account.

MVP simplification:

- full Club Account payment can be deferred if the first launch uses only external payment, but the module boundary must still exist for account visibility and future top-up/spending.

## Bonus Module

Responsibilities:

- bonuses;
- accrual;
- spending;
- referral bonuses.

MVP responsibilities in more detail:

- maintain Bonus Account per customer when loyalty is enabled;
- store bonus transactions as append-only records;
- accrue bonuses from approved purchase, referral or manual sources;
- reserve and redeem bonus rights only through backend checkout rules;
- release reservations on failed or expired checkout;
- keep referral bonus qualification separate from customer referral relationship ownership;
- expose customer-safe bonus projection;
- publish bonus events.

Boundary:

- bonus is not money;
- bonus is not Club Account balance;
- bonus is not a payment method;
- bonus redemption creates a discount effect before payment.

MVP simplification:

- active bonus redemption can be postponed for first launch if customer-facing copy does not promise redemption.

## Payment Module

Responsibilities:

- YooKassa;
- SBP;
- QR;
- payment status;
- refunds;
- payment registry.

MVP responsibilities in more detail:

- create provider-agnostic payment intents;
- create limited-lifetime payment sessions;
- present confirmation through payment link, QR or SBP provider flow;
- isolate YooKassa-specific API calls inside provider adapter;
- verify, deduplicate and process payment webhooks;
- poll provider status when webhook is delayed or ambiguous;
- map provider statuses into platform payment states;
- store Payment Operations Registry records;
- expose customer-safe payment status;
- execute or support full refund workflow for paid-but-not-delivered scenarios;
- provide reconciliation data for support and finance review.

Boundary:

- Payment consumes accepted payable amount;
- Payment does not calculate price, discount or bonus rules;
- Payment completion is required before Order may dispatch to Machine.

## Order Module

Responsibilities:

- purchase lifecycle;
- product selection;
- machine dispatch.

MVP responsibilities in more detail:

- accept checkout request from Mini App;
- validate product selection through Product/Catalog, Configuration, Pricing, Discount and Bonus contracts;
- create order with immutable product, configuration, recipe, price and discount snapshots;
- bind order to payment intent;
- transition order only through allowed state machine rules;
- accept Payment completion as the paid-order gate;
- request machine fulfillment only after paid state is accepted;
- handle fulfillment success, failure, cancellation, expiration and refund coordination;
- expose customer-safe order progress and purchase history.

Boundary:

- Order owns purchase lifecycle;
- Order does not execute provider payments;
- Order does not send low-level machine commands directly.

## Machine Module

Responsibilities:

- machine identity;
- inventory;
- telemetry;
- events.

MVP responsibilities in more detail:

- register one physical machine with stable `machine_id`;
- store machine lifecycle, status, location and capability profile;
- track inventory for launch product consumables;
- receive authenticated machine or adapter telemetry;
- evaluate machine readiness from status, telemetry freshness, inventory, maintenance and safety state;
- create dispatch queue entries for paid orders only;
- issue idempotent `PrepareProduct` command through adapter;
- record command acknowledgement, timeout, retry and outcome;
- publish machine events for accepted, started, failed, dispensed/completed and telemetry facts;
- support operator recovery path for offline, blocked, failed and ambiguous outcomes.

Boundary:

- Machine does not decide payment state;
- Machine does not calculate product price or bonus rules;
- Machine reports physical execution facts to Order and support projections.

## Notification Module

Responsibilities:

- Telegram notifications;
- payment notifications;
- loyalty messages.

MVP responsibilities in more detail:

- create notification requests from accepted domain events;
- deliver Telegram transactional notifications;
- enforce consent and notification preferences;
- suppress duplicates and throttle repeated messages;
- send payment pending/success/failure notifications when policy allows;
- send order completed/failed/recovery messages;
- send loyalty and bonus messages only when approved and consented;
- store delivery attempts and failures.

Boundary:

- Notification does not decide payment, order, bonus or Club Account state;
- failed notification delivery does not rollback source domain facts.

# 5. Database architecture

## PostgreSQL

The MVP backend uses PostgreSQL as the production source-of-truth database.

PostgreSQL is required for:

- durable customer identity and consent records;
- durable order and payment history;
- financial operation reconstruction;
- machine dispatch audit;
- idempotency and webhook deduplication;
- event outbox reliability;
- backup and restore.

## Schemas

The MVP may use PostgreSQL schemas or table prefixes to express module ownership. Exact DDL belongs to future implementation tasks.

Recommended logical schemas:

| Schema | Owner | Examples |
|---|---|---|
| `customer` | Customer Module | customers, identity links, contact points, consent summaries |
| `club_account` | Club Account Module | accounts, transactions, reservations, top-up references |
| `bonus` | Bonus Module | accounts, transactions, batches, reservations |
| `payment` | Payment Module | intents, payments, sessions, operations, refunds, provider references |
| `orders` | Order Module | orders, order items, snapshots, payment bindings, fulfillment records |
| `machine` | Machine Module | machines, inventory, telemetry, operations, commands, incidents |
| `notification` | Notification Module | notification requests, delivery attempts, preferences |
| `event` | Event Layer | event outbox, event envelopes, consumer offsets |
| `audit` | Platform Services | audit events, manual review records |
| `integration` | Integration Layer | protected webhook records, provider callback records, adapter correlation records |

Ownership rule:

```text
Only the owning module writes source-of-truth records in its schema.
Other modules use commands, queries, events, references, snapshots or projections.
```

## Audit tables

Audit records are append-only and must support support, finance, security and machine incident reconstruction.

Audit is required for:

- customer identity linking and conflicts;
- consent grant, denial and revocation;
- Club Account balance-affecting transactions;
- bonus accrual, reservation, spending and manual adjustment;
- payment intent/session creation, webhook processing, status polling and refunds;
- order state transitions;
- machine command, acknowledgement, timeout, retry and outcome;
- operator and support actions;
- secret/configuration changes where applicable.

Audit records must include actor, action, target, reason, source, correlation ID, causation ID and timestamps. Audit records must not contain secrets, raw payment credentials, raw Telegram init data, raw card data, raw provider signatures or unnecessary personal data.

## Immutable financial records

Financial and financial-adjacent records must be append-only after acceptance.

Immutable record types:

- PaymentOperation;
- RefundOperation after completion;
- ClubAccountTransaction;
- BonusTransaction;
- Ledger or interim financial fact records when used;
- order payment snapshots;
- provider webhook records after accepted processing;
- reconciliation results after closure.

Corrections use new compensating records. Historical financial facts must not be edited in place to hide mistakes.

# 6. API architecture

## REST API

MVP uses REST API for synchronous customer, bot, payment and support-facing interactions.

Recommended route shape:

```text
/api/v1/...
```

Primary API groups:

- Authentication and session;
- Customer profile and consent;
- Club Account;
- Bonus Account;
- Orders and checkout;
- Payments and payment sessions;
- Machine status projection for customer/support use;
- Notifications and preferences;
- Health and readiness.

REST handlers must:

- validate request shape;
- authenticate caller;
- authorize resource access;
- enforce idempotency for side-effect commands;
- call module contracts;
- return customer-safe errors;
- propagate correlation IDs.

REST handlers must not:

- calculate final price;
- confirm payment from client state;
- mutate balances directly;
- send machine commands without Order/Machine contracts;
- expose provider raw payloads or secrets.

## Authentication

MVP authentication sources:

- Telegram Mini App `initData` verified server-side with bot secret;
- Telegram Bot webhook/channel boundary authenticated by Telegram/update configuration;
- machine adapter authenticated by API key, signature, mTLS or provider-approved mechanism;
- payment provider webhook authenticated by provider signature or approved verification mechanism;
- operator/support access authenticated through future CRM/admin policy where used.

Authentication produces safe identity context. It does not decide business eligibility.

## Authorization

Authorization rules:

- customers can access only their own customer, order, payment, Club Account and Bonus Account data;
- Telegram ID is not platform identity until resolved to `customer_id`;
- machine credentials can submit only machine-scoped facts and cannot read customer financial data;
- payment provider webhooks can submit provider facts only to Payment Module;
- support/operator access requires least privilege, actor identity, reason and audit;
- domain modules still validate business rules after route-level authorization.

## Versioning

The first public contract version is `v1`.

Versioning rules:

- breaking API changes require a new version or explicit migration plan;
- events include event name and version;
- provider adapter payload versions are internal to the adapter boundary;
- database migrations must preserve historical records and source-of-truth ownership.

# 7. Event architecture

## Domain events

Domain events are immutable facts emitted after a module accepts a state change.

Examples:

- `Customers.IdentityLinked`;
- `Customers.ConsentGranted`;
- `ClubAccounts.TopUpCredited`;
- `Bonus.Accrued`;
- `Payments.Completed`;
- `Payments.RefundCompleted`;
- `Orders.Created`;
- `Orders.PaymentConfirmed`;
- `Orders.Completed`;
- `Machines.PreparationStarted`;
- `Machines.OperationCompleted`;
- `Notifications.Sent`.

Event rules:

- events are facts, not commands;
- event payloads use platform IDs;
- event payloads minimize personal data;
- consumers are idempotent;
- event replay must not repeat payments, refunds, bonuses, notifications or machine commands.

## Payment events

Payment events drive order paid transitions, customer status and support/reconciliation views.

Important MVP payment events:

- `Payments.IntentCreated`;
- `Payments.SessionCreated`;
- `Payments.ConfirmationRequired`;
- `Payments.WebhookReceived`;
- `Payments.StatusPolled`;
- `Payments.Completed`;
- `Payments.Failed`;
- `Payments.Expired`;
- `Payments.Cancelled`;
- `Payments.RefundRequested`;
- `Payments.RefundCompleted`;
- `Payments.ReconciliationFailed`.

`Payments.Completed` is the only payment success fact that can allow Order to evaluate paid state.

## Machine events

Machine events report physical equipment facts.

Important MVP machine events:

- `Machines.StatusChanged`;
- `Machines.InventoryChanged`;
- `Machines.TelemetryReported`;
- `Machines.CommandAccepted`;
- `Machines.CommandRejected`;
- `Machines.PreparationStarted`;
- `Machines.PreparationFailed`;
- `Machines.ProductReady`;
- `Machines.ProductTaken`;
- `Machines.OperationCompleted`;
- `Machines.OperationFailed`;
- `Machines.ErrorReported`.

Machine events must be authenticated through machine or adapter identity before they affect Order, support or customer-facing projections.

## Notifications

Notifications are event-driven requests, not direct side effects hidden in source modules.

Typical event flow:

```text
Payment completed
-> Payment event appended
-> Order consumes payment fact
-> Notification request created
-> Telegram delivery attempted
-> Delivery result stored
```

Notification delivery failure must not change Payment, Order, Bonus, Club Account or Machine state.

# 8. External integrations

## Telegram API

Telegram integration supports:

- Bot entry and `/start`;
- Mini App launch;
- customer-safe messages;
- WebApp `initData` authentication;
- Telegram notifications.

Rules:

- backend verifies Mini App `initData`;
- bot token is a backend secret;
- Telegram user ID is an external alias, not `customer_id`;
- Telegram chat ID is a notification route, not payment proof;
- Telegram messages do not contain raw provider data or sensitive personal data.

## YooKassa API

YooKassa is the primary external payment provider for MVP.

Rules:

- YooKassa is isolated behind Payment Module provider adapter;
- `YOOKASSA_SECRET_KEY` is provided only through secure runtime environment;
- YooKassa provider payment ID is a provider reference, not `payment_id`;
- YooKassa statuses are mapped into platform statuses;
- YooKassa webhooks are verified and deduplicated;
- YooKassa reports are reconciliation inputs, not the only financial history.

## SBP

SBP is supported as a payment experience through provider capabilities, initially through the YooKassa-backed path when account configuration supports it.

Rules:

- SBP session has explicit expiration;
- QR, deep link or provider page is only a confirmation surface;
- final success requires Payment Module completion;
- delayed success after expiration goes to reconciliation before any machine dispatch.

## Machine provider API

Machine integration may connect to a direct controller API, a vendor cloud API or a local/remote adapter.

Rules:

- machine or adapter identity is authenticated;
- adapter translates vendor payloads to platform machine facts;
- platform sends idempotent commands;
- machine reports acknowledgements, telemetry and operation outcomes;
- unpaid order commands are rejected and audited;
- unknown physical outcome requires reconciliation before retry.

# 9. Security

## Secrets

Secrets must be stored outside repository files and frontend bundles.

Secret examples:

- Telegram bot token;
- Telegram WebApp verification secret material;
- YooKassa secret key;
- database credentials;
- machine adapter credentials;
- webhook signing secrets;
- JWT/session signing keys.

Rules:

- no real secrets in Markdown, source code, `.env.example`, frontend assets or logs;
- environment variables or secret storage provide runtime values;
- logs may record secret presence checks, never secret values;
- provider authorization headers are masked.

## Personal data

Personal data handling rules:

- collect only the data needed for the scenario;
- `customer_id` is the internal identity;
- Telegram ID, phone and email are external aliases or contact data;
- raw phone/email is protected or masked where possible;
- consent evidence is versioned and auditable;
- customer self-service reads only own data;
- analytics and events minimize personal data.

## Access control

Access control uses authentication context plus authorization policy.

Required access boundaries:

- customer access by own `customer_id`;
- bot/channel access limited to channel actions;
- provider webhook access limited to payment fact submission;
- machine adapter access limited to machine-scoped commands and facts;
- support/operator access by role, reason and audit;
- module-level validation for business rules.

## Audit

Audit is mandatory for sensitive actions and rejected sensitive attempts.

Audited actions include:

- identity linking and conflicts;
- consent changes;
- payment webhooks, polling and refunds;
- Club Account and Bonus balance-affecting operations;
- order state transitions;
- machine commands and outcomes;
- operator/manual review actions;
- secret/configuration changes where applicable.

Audit records are append-only and must not contain secrets or unnecessary personal data.

# 10. Deployment architecture

## MVP server

MVP can run on a single production server or simple managed application environment.

Required server capabilities:

- TLS termination through reverse proxy or managed platform;
- backend process supervision;
- environment variable or secret injection;
- outbound HTTPS access to Telegram and YooKassa;
- inbound HTTPS endpoints for Mini App API, Telegram Bot, payment webhooks and machine adapter callbacks;
- log collection and health checks.

## Database

MVP database:

- one PostgreSQL instance;
- separate staging and production databases;
- automated backups;
- tested restore procedure;
- restricted network/user access;
- migration process controlled from GitHub source.

## Backend

The backend is one deployable modular monolith.

Runtime responsibilities:

- REST API;
- webhook handlers;
- module contracts;
- internal event outbox;
- integration adapters;
- health and readiness endpoints.

The backend must be deployable and rollback-capable without committing generated build output.

## Frontend

Frontend deployment includes:

- Landing static site or web app;
- Telegram Mini App frontend;
- Telegram Bot configured to open the Mini App and backend endpoints.

Frontend must not include backend secrets, payment provider secrets, machine credentials or source-of-truth business logic.

## Monitoring

MVP monitoring must cover:

- backend health;
- database connectivity;
- Telegram webhook/API health;
- payment webhook processing;
- payment status polling failures;
- order state transition failures;
- machine adapter connectivity;
- stale telemetry;
- machine inventory/readiness;
- event outbox backlog;
- notification delivery failures;
- error logs and correlation IDs.

MVP does not require a complex observability stack, but operators must be able to answer:

```text
Is the backend up?
Is the database reachable?
Are payments being confirmed?
Is the machine reachable and ready?
Are paid orders dispatching?
Did this customer receive the product?
```

# 11. Future scaling

The first production architecture should scale by separating the most operationally independent parts only when there is a proven need.

## Stage 1: Modular monolith

Default MVP state.

Characteristics:

- one backend deployable;
- one PostgreSQL database;
- internal modules and adapters;
- database-backed outbox;
- simple deployment and rollback;
- lowest operational complexity.

## Stage 2: Selected services

Possible after MVP when load, uptime or operational ownership requires separation.

Candidate extractions:

- payment webhook and provider adapter service;
- machine adapter and telemetry ingestion service;
- notification delivery worker;
- analytics projection worker.

Rules:

- extracted services use existing module contracts and events;
- source-of-truth ownership remains explicit;
- provider payloads stay inside adapters;
- idempotency and audit remain mandatory.

## Stage 3: Distributed architecture

Future state only after multiple machines, higher transaction volume, separate teams or operational constraints justify it.

Possible additions:

- external message broker;
- separate read-model databases;
- independent payment, machine or notification scaling;
- analytics warehouse;
- service-specific deployment pipelines.

Distributed architecture must be earned by production need. It is not required for the first MVP launch.

# 12. MVP implementation baseline

The first backend implementation should keep the physical structure simple and explicit.

Recommended modular monolith folder direction:

```text
backend/src/
  app/
  api/
  modules/
    customer/
    club-account/
    bonus/
    payment/
    order/
    machine/
    notification/
  platform/
    audit/
    config/
    database/
    events/
    idempotency/
    logging/
    security/
  integrations/
    telegram/
    yookassa/
    machine-adapter/
```

Implementation rules:

- folders express ownership boundaries, not independent deployables;
- modules expose commands, queries and events through internal contracts;
- API handlers call module contracts and do not write module tables directly;
- adapters translate external payloads and do not own business rules;
- cross-module reads use safe queries, projections or snapshots;
- cross-module writes use commands or accepted domain events;
- event outbox and idempotency can live in PostgreSQL for MVP;
- background work can start as in-process workers if deployment and shutdown remain safe;
- extraction to a separate process requires an architecture decision.

The MVP should optimize for traceability, reliable recovery and fast iteration around the first machine, not for theoretical scale.

# 13. Validation statement

This architecture specification is documentation-only.

Validation result:

- no application source code is changed;
- no frontend source code is changed;
- no backend runtime code is changed;
- no database migration is added;
- no generated build output is changed;
- no unnecessary technology expansion is introduced;
- MVP remains a modular monolith with PostgreSQL, internal events and integration adapters.
