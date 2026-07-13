# PROJECT_DECISIONS.md

> Файл должен лежать в репозитории по пути:
>
> `docs/architecture/PROJECT_DECISIONS.md`

---

# Decision: DECISION-041 - Database Foundation Uses PostgreSQL and Prisma With Domain-Separated Immutable Records

**Date:** 2026-07-13

**Status:** Accepted

## Context

Soft ICE Platform already has a logical platform data model, a modular monolith backend direction and an initial backend foundation with PostgreSQL configuration.

The next database planning step needs to define how future physical storage should be shaped without prematurely creating tables, Prisma migrations or runtime database behavior.

The platform must preserve clear boundaries between Customer, Club Account, Bonus, Payment, Order and Machine data while remaining ready for multiple vending machines, products, payment providers and sales channels.

---

## Decision

Soft ICE Platform defines `docs/data/DATABASE_FOUNDATION.md` as the database foundation v1 strategy.

PostgreSQL is the primary datasource for future source-of-truth platform records.

Prisma is the ORM and migration layer for future backend implementation tasks.

The database model must keep domain ownership explicit, either through PostgreSQL schemas, table prefixes or another documented ownership convention.

Financial and financial-adjacent records, including Club Account transactions, Bonus transactions, Payment operations, refund operations, order payment snapshots, provider webhook facts and reconciliation results, are immutable after acceptance.

Corrections must use new compensating records instead of editing historical facts in place.

This decision is documentation-only. It does not create runtime code, Prisma migrations, database tables, production database infrastructure, real payment processing or payment webhooks.

---

## Architecture Principles

The logical data model remains the source of domain meaning. Prisma schemas and migrations are implementation artifacts that must follow the documented model.

The database must support auditability through actor, source, reason, target, correlation, causation, idempotency and timestamp metadata where applicable.

Customer identity, contacts, consent records and external aliases are owned by the Customer boundary.

Club Account prepaid balance and Bonus Account discount points are separate domains with separate transaction histories.

Payment Intent and Payment Operation records are provider agnostic. YooKassa, SBP, QR payments, payment links and future providers use provider references for correlation, not platform identity.

Order stores immutable product, configuration, pricing, discount and payment snapshots for historical purchase truth.

Machine records and Machine Events report equipment facts and physical outcomes without deciding payment state.

---

## Consequences

Future Prisma migrations must be reviewed against `docs/data/DATABASE_FOUNDATION.md`, `docs/data/PLATFORM_DATA_MODEL.md` and the owning domain documents before implementation.

Future database work must preserve source-of-truth ownership, immutability, auditability, idempotency and provider isolation.

Future implementation may add schemas, tables and migrations only through explicit coding tasks.

Any future implementation that rewrites accepted financial history, lets provider payloads become platform business IDs, mixes Club Account and Bonus balance, or lets machines decide payment state requires correction or architecture review.

---

## Related Documentation

- `docs/data/DATABASE_FOUNDATION.md`
- `docs/data/PLATFORM_DATA_MODEL.md`
- `docs/architecture/MVP_BACKEND_ARCHITECTURE.md`
- `docs/architecture/BACKEND_FOUNDATION.md`
- `docs/domain/CUSTOMER_DOMAIN.md`
- `docs/domain/CLUB_ACCOUNT.md`
- `docs/domain/BONUS_DOMAIN.md`
- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/domain/ORDER_DOMAIN.md`
- `docs/domain/MACHINE_DOMAIN.md`

---

# Decision: DECISION-040 - MVP Backend Uses Modular Monolith for First Machine Launch

**Date:** 2026-07-10

**Status:** Accepted

## Context

Soft ICE Platform needs a practical backend direction for the first real vending machine launch.

The platform documentation already defines many domain boundaries, runtimes, APIs, events, payments, orders, finance, machine and notification responsibilities. Those boundaries are important, but the first commercial launch must not become a distributed system before one machine, one product slice and one payment path are proven in production.

If the MVP backend is split into premature services, the project would inherit deployment, networking, tracing, retries, transactions and operational recovery complexity before there is enough production evidence to justify it.

---

## Decision

Soft ICE Platform defines `docs/architecture/MVP_BACKEND_ARCHITECTURE.md` as the MVP backend architecture specification.

The MVP backend uses a modular monolith by default:

- one backend deployable;
- one primary PostgreSQL database;
- explicit internal modules for Customer, Club Account, Bonus, Payment, Order, Machine and Notification;
- Product, Pricing, Configuration, Recipe and Media dependencies consumed through approved contracts;
- REST, webhook and integration endpoints routed through module contracts;
- database-backed outbox and idempotency records for first launch;
- Telegram, YooKassa/SBP and machine integration isolated behind adapters.

Microservices, an external message broker, CQRS read-store split, event-sourcing platform, service mesh, Kubernetes, multi-region deployment and separate runtime processes are not required for the first launch.

A module may be separated only when there is a strong production reason such as provider network constraints, security isolation, machine vendor deployment constraints, proven load, independent uptime requirements or operational ownership that cannot be handled safely inside the monolith.

---

## Architecture Principles

First machine launch reliability is more important than infrastructure sophistication.

Module boundaries are still mandatory inside the monolith.

API handlers, webhooks and adapters must authenticate, validate, deduplicate and route work; they must not own product, pricing, payment, order, bonus or machine business decisions.

PostgreSQL is the MVP source of truth for customer, order, payment, machine, notification, idempotency, audit and outbox records.

Domain events are internal facts first. External event infrastructure can be introduced later only when production need justifies it.

Machine dispatch remains gated by accepted paid-order state.

Provider-specific payment and machine payloads stay inside adapters.

---

## Consequences

Future MVP backend implementation must start from a single deployable modular monolith and keep module ownership explicit in code, database schemas or table prefixes, events and API contracts.

Future service extraction must preserve existing module contracts, source-of-truth ownership, idempotency, auditability and event semantics.

Future infrastructure work must not introduce distributed-system requirements before the first machine launch unless the Product Owner approves a concrete production constraint.

Any future implementation that requires multiple backend services, an external broker, a separate payment runtime, a separate machine runtime or advanced orchestration for the first launch requires architecture review.

---

## Related Documentation

- `docs/architecture/MVP_BACKEND_ARCHITECTURE.md`
- `docs/architecture/ARCHITECTURE_PRINCIPLES.md`
- `docs/api/API_OVERVIEW.md`
- `docs/api/REST_API.md`
- `docs/api/WEBHOOKS.md`
- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/domain/ORDER_DOMAIN.md`
- `docs/domain/MACHINE_DOMAIN.md`
- `docs/data/PLATFORM_DATA_MODEL.md`
- `docs/releases/MVP_IMPLEMENTATION_ROADMAP.md`
- `docs/releases/MVP_LAUNCH_READINESS.md`

---

# Decision: DECISION-039 - Machine Domain Owns Equipment Execution Boundary

**Date:** 2026-07-08

**Status:** Accepted

## Context

Soft ICE Platform needs a practical Machine Domain before real vending machine integration can be implemented.

Existing Order, Payment, Product, REST, Event and Data Model documentation already establishes that paid order fulfillment must be separated from payment settlement, product catalog rules and UI behavior.

Without a dedicated Machine Domain boundary, implementation could let machine adapters decide payment eligibility, mix inventory with financial state, hide preparation failures, duplicate physical dispensing through unsafe retries or make support unable to reconstruct machine incidents.

---

## Decision

Soft ICE Platform defines `docs/domain/MACHINE_DOMAIN.md` as the documentation-only DDD Lite Machine Domain model.

Machine Domain owns machine identity, lifecycle, status, location assignment, configuration, capabilities, components, dispatch queue execution, machine commands, acknowledgements, operation outcomes, inventory, telemetry, maintenance, service operator actions and machine audit trail.

Machine Domain does not own payment logic, bonus logic, product pricing, customer profile, Product catalog source data, Ledger facts, refund execution, notification templates or Order lifecycle transitions.

Machine receives only paid orders through approved Order and Machine dispatch contracts. Machine does not start preparation before payment is confirmed and accepted by Order policy.

Platform sends commands; machine or adapter returns acknowledgements, status reports, telemetry and events. Product preparation failure must be reported as a Machine event.

---

## Architecture Principles

Machine Domain reflects real equipment behavior, including offline state, stale telemetry, safety blocks, inventory shortages, component faults, preparation failures, partial dispensing and unknown physical outcomes.

Machine inventory is tracked separately from payments and financial records.

Machine command execution is idempotent and auditable.

Timeouts and unknown outcomes require status reconciliation before retrying physical side effects.

Order Domain owns purchase lifecycle and consumes validated machine facts through approved transitions.

Payment Domain owns settlement confirmation and refund execution.

Product Domain owns catalog, configuration and recipe source models.

---

## Consequences

Future Machine Runtime implementation must expose approved command, query and event contracts before production machine integration.

Future machine adapters must authenticate machine-originated facts, normalize vendor payloads, preserve idempotency and avoid leaking raw hardware protocol details into other domains.

Future Order, CRM, Notification and Analytics work must consume Machine events and projections instead of polling raw adapters or inferring progress from timers.

Any future implementation that lets machines prepare unpaid orders, decide payment state, mutate bonus or financial records, hide product preparation failures or retry physical commands without reconciliation requires correction or architecture review.

---

## Related Documentation

- `docs/domain/MACHINE_DOMAIN.md`
- `docs/architecture/ORDER_PLATFORM.md`
- `docs/tasks/ORDER-008_MACHINE_DISPATCH.md`
- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/data/PLATFORM_DATA_MODEL.md`
- `docs/api/REST_API.md`
- `docs/api/EVENT_API.md`

---

# Decision: DECISION-038 - Platform Data Model Is the Logical Source of Truth

**Date:** 2026-07-07

**Status:** Accepted

## Context

Soft ICE Platform now has domain documentation for Product, Customer, Club Account, Bonus, Payment, Order, Finance, Event, Machine and related architecture boundaries.

Future implementation needs one logical data model that ties those domains together without treating the current Prisma schema, JSON files, UI state or provider payloads as the full platform model.

Without this boundary, future storage work could duplicate ownership rules, put business data into UI, mutate historical financial or order facts, or let provider-specific schemas leak into platform contracts.

---

## Decision

Soft ICE Platform defines `docs/data/PLATFORM_DATA_MODEL.md` as the canonical logical data model direction for platform entities, attributes, relationships, cardinality, aggregate boundaries, data owners, storage rules, immutable records, audit, retention direction and future expansion.

Physical database schemas, Prisma models, JSON files and provider adapter schemas are implementation artifacts. They must follow the logical model, but they are not the full source of truth for domain ownership.

Domain runtimes own source-of-truth records inside their boundaries. Other domains may store references, snapshots, events or projections only through approved contracts.

---

## Architecture Principles

Logical model first, physical schema second.

UI state is never source-of-truth business data.

Historical orders use immutable snapshots.

Financial facts are append-only and Ledger remains the financial source of truth.

Payment provider identifiers are correlation references, not platform IDs.

Events and audit records are immutable facts.

Corrections use compensating records instead of silent edits.

Retention and personal-data handling require explicit policy and audit before production automation.

---

## Consequences

Future database migrations must be reviewed against the logical model and domain ownership map.

Future API, event, CRM, analytics and runtime implementations must use platform IDs, aggregate boundaries and source-of-truth ownership from the data model.

Future changes to data ownership, immutable records, retention direction or aggregate boundaries require documentation updates and, when significant, a new architecture decision.

Any future implementation that treats UI state, provider payloads, current Prisma schema or analytics events as the authoritative platform data model requires correction or architecture review.

---

## Related Documentation

- `docs/data/PLATFORM_DATA_MODEL.md`
- `docs/architecture/ARCHITECTURE_PRINCIPLES.md`
- `docs/architecture/DDD_LITE_ARCHITECTURE.md`
- `docs/architecture/ORDER_PLATFORM.md`
- `docs/domain/CUSTOMER_DOMAIN.md`
- `docs/domain/CLUB_ACCOUNT.md`
- `docs/domain/BONUS_DOMAIN.md`
- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/architecture/LEDGER.md`
- `docs/architecture/EVENT_PLATFORM.md`

---

# Decision: DECISION-037 - YooKassa API Configuration Uses Environment Variables

**Date:** 2026-07-07

**Status:** Accepted

## Context

Soft ICE Platform needs YooKassa API settings for the first provider-backed payment integration.

The shop identifier and API base URL are non-secret operational configuration. The YooKassa secret key is sensitive provider credential material and must not leak into code, documentation, frontend bundles, events, logs or committed environment files.

---

## Decision

Soft ICE Platform configures the YooKassa provider adapter through environment variables:

- `YOOKASSA_SHOP_ID` with value `1368517`;
- `YOOKASSA_SECRET_KEY` from secure environment configuration only;
- `YOOKASSA_API_URL` with value `https://api.yookassa.ru/v3`.

The repository may include `.env.example` with variable names and non-secret values, but no real secret key.

Real `.env` files are local/deployment artifacts and must not be committed.

---

## Architecture Principles

Provider credentials are runtime secrets, not domain data.

The YooKassa provider adapter may read `YOOKASSA_SECRET_KEY` from process environment, but must not expose it to Payment Domain events, UI, logs, Markdown examples or generic domain models.

Startup/configuration validation may confirm that the secret exists, but must not print the secret value or authorization header.

---

## Consequences

Future YooKassa implementation must load credentials through backend/runtime configuration and keep the secret inside the provider adapter boundary.

Future logging, telemetry and error handling must mask provider credentials and avoid dumping full environment variables.

Any future code, documentation or configuration that stores a real YooKassa secret key in repository files requires immediate correction and security review.

---

## Related Documentation

- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/architecture/PAYMENT_ENGINE.md`
- `.env.example`
- `.gitignore`

---

# Decision: DECISION-036 - Payment Provider Agnostic Model

**Date:** 2026-07-07

**Status:** Accepted

## Context

Soft ICE Platform needs payment by card, SBP, QR, payment link, saved payment method, Club Account, Wallet and future providers.

YooKassa is the primary initial provider, but payment business logic must remain portable. If Order, Club Account, Bonus, Machine, UI or generic Payment code depends on YooKassa-specific fields, provider replacement and new method support would require broad rewrites and would weaken reconciliation.

---

## Decision

Soft ICE Platform defines Payment Domain as provider agnostic.

The platform-owned payment model uses:

- `payment_id` as the platform payment identity;
- payment intent;
- payment session;
- payment method line;
- platform payment statuses;
- platform refund operations;
- provider-neutral confirmation, webhook, polling, expiration, cancellation and reconciliation rules.

Provider-specific request fields, response fields, status names, SDKs, webhook payloads and secrets stay inside provider adapters and protected integration records.

SBP, QR, payment links, cards, saved payment methods and future providers use the same payment model.

---

## Architecture Principles

Payment business rules must not depend on YooKassa-specific fields.

Provider status is translated into platform payment status before other domains consume it.

Provider references are correlation metadata, not platform source IDs.

Adding a provider must not require rewriting Pricing, Discount, Bonus, Club Account, Wallet, Ledger, Order, Machine or UI business logic.

---

## Consequences

Future provider work must implement a provider adapter behind Payment Domain contracts.

Provider adapters must declare capabilities, normalize errors, verify webhooks, map statuses and preserve idempotency.

Any future code outside provider adapters that imports YooKassa-specific request shapes, statuses or SDK constants requires correction or architecture review.

---

## Related Documentation

- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/api/REST_API.md`
- `docs/api/EVENT_API.md`

---

# Decision: DECISION-035 - Financial Registry Is Internal

**Date:** 2026-07-07

**Status:** Accepted

## Context

Payment providers can produce reports, webhook history, settlement files and status responses. These external records are necessary for reconciliation, but they are not sufficient as the platform's only financial history.

Soft ICE Platform must preserve its own payment operations, Ledger-backed facts, refund operations, accounting handoff records and reconciliation results.

---

## Decision

Soft ICE Platform keeps an internal financial registry for payment history and reconciliation.

Provider reports are inputs to reconciliation, not the only source of financial history.

Ledger remains the source of truth for financial facts. Payment Operations Registry, Payment Session Registry, Refund Registry and provider report imports support traceability and reconciliation around Ledger-backed facts.

External accounting systems and provider reports must not rewrite accepted platform financial history.

---

## Architecture Principles

Completed payments, refunds and corrections must be represented internally.

Provider success alone is not enough to erase internal recording and reconciliation requirements.

Accounting Adapter exports Ledger-backed facts and records external acknowledgements without mutating original Ledger entries.

Refunds and corrections are compensating facts.

---

## Consequences

Future payment implementation must store enough internal history to reconstruct payment, refund and reconciliation outcomes even if provider reports are unavailable.

Provider report imports must create import and reconciliation records.

Any future implementation that treats provider reports as the sole source of platform payment history requires correction or architecture review.

---

## Related Documentation

- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/architecture/LEDGER.md`
- `docs/architecture/ACCOUNTING_ADAPTER.md`

---

# Decision: DECISION-034 - Payment Operations Registry

**Date:** 2026-07-07

**Status:** Accepted

## Context

Payment flows are asynchronous and can involve webhooks, polling, customer redirects, QR expiration, provider retries, one-click top-up, auto top-up, cancellations, refunds and reconciliation.

Without an internal append-only operations registry, duplicate callbacks, late provider success, ambiguous states and refund corrections would be hard to audit and reconcile.

---

## Decision

Soft ICE Platform introduces Payment Operations Registry as the internal append-only record of accepted payment-related operations and facts.

The registry stores platform operations such as payment intent creation, session creation, QR or link creation, webhook acceptance, status polling, provider status mapping, authorization, capture, completion, expiration, failure, cancellation, refund request, refund completion, reconciliation and manual review.

Payment Operations Registry does not store raw card data, CVV, provider secrets or unmasked provider payloads.

---

## Architecture Principles

Payment operation records are append-only.

Corrections are new operation records.

Every provider side effect and webhook effect must be idempotent.

Every operation must include stable platform references, amount, currency, source, correlation metadata and audit context where required.

---

## Consequences

Future Payment Runtime implementation must define operation schema, idempotency scope, retention policy and audit access before production payment processing.

Support, finance, reconciliation and CRM views should read authorized projections from the registry, not provider dashboards alone.

Any future payment implementation that mutates historical operations in place requires correction or architecture review.

---

## Related Documentation

- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/api/EVENT_API.md`

---

# Decision: DECISION-033 - YooKassa Is the Primary Payment Provider

**Date:** 2026-07-07

**Status:** Accepted

## Context

Soft ICE Platform needs an initial external payment provider for MVP payment scenarios, including card and SBP-oriented flows, while keeping the platform ready for future providers.

The existing Payment Engine architecture identifies YooKassa as the planned initial external payment provider candidate.

---

## Decision

Soft ICE Platform selects YooKassa as the primary payment provider for the first provider-backed payment integration.

YooKassa integration is implemented through a YooKassa provider adapter behind the provider-agnostic Payment Domain model.

YooKassa-specific API calls, request schemas, status names, webhook parsing and provider secrets are isolated inside the adapter and protected integration records.

---

## Architecture Principles

YooKassa payment ID is a provider reference, not `payment_id`.

YooKassa webhooks must be verified and deduplicated before they affect platform state.

YooKassa statuses must be mapped into platform payment states.

YooKassa confirmation data, QR data and payment links are limited-lifetime operational data.

YooKassa reports are reconciliation inputs, not the only source of platform financial history.

---

## Consequences

Future MVP payment implementation should prioritize YooKassa adapter contracts, webhook verification, status mapping, idempotency and reconciliation.

Future provider migration or additional providers must preserve old provider references for refunds, reports and reconciliation.

Any future code that exposes YooKassa secrets to frontend code, events, logs or generic domain models requires correction or security review.

---

## Related Documentation

- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/architecture/ACCOUNTING_ADAPTER.md`
- `docs/api/REST_API.md`
- `docs/api/EVENT_API.md`

---

# Decision: Bonus Domain Non-Monetary Rights Boundary

**Date:** 2026-07-06

**Status:** Accepted

## Context

Soft ICE Platform needs a full Bonus Domain model for Club Timofey, referrals, birthdays, trusted customers, seasonal campaigns, support recovery and future Promotion Platform scenarios.

Without a documented boundary, bonuses could be confused with Wallet cash, Club Account prepaid balance, discounts, payment method lines, accounting entries, campaign definitions or CRM operator notes.

That confusion would create risk around financial reporting, customer messaging, refund handling, expiration, manual adjustments, fraud review and future scheduler automation.

---

## Decision

Soft ICE Platform defines Bonus Domain as the owner of customer bonus rights.

One bonus is a non-monetary right to receive a discount with a nominal value of 1 RUB according to platform rules.

Bonus is not money.

Bonus is not Wallet balance.

Bonus is not Club Account balance.

Bonus is not a payment method, cash payout, deposit, customer debt or accounting balance.

Bonus Domain owns Bonus Account, Bonus Transaction, bonus batches, bonus projection, reservation, redemption, release, expiration, cancellation, reversal, manual adjustment, audit metadata, Burn Scheduler policy, Notification Scheduler trigger policy and bonus domain events.

Bonus redemption creates a discount effect before payment.

Discount/Pricing owns stacking, redemption caps, final discount effect and payable amount.

Payment collects only the accepted payable amount.

Ledger remains the source of truth for financial facts and never stores bonus balance as money.

Wallet and Club Account must label bonus rights separately from monetary balances.

Referral Bonus, Birthday Bonus, Trusted Customer Bonus, Seasonal Bonus and Manual Adjustment are supported as source-specific bonus operations, but final commercial amounts and production eligibility rules require Product Owner approval before implementation.

All bonus operations are append-only. Corrections use compensating transactions and audit records.

---

## Architecture Principles

Bonus Account is customer-linked but separate from Customer profile, Wallet and Club Account.

Bonus Transaction is the immutable bonus history record.

Bonus batches preserve source, rule ID, rule version, activation and expiration policy.

Expiration is evaluated by batch.

Burn Scheduler applies scheduled policy transitions such as expiration and approved automated cancellation; it does not redeem bonuses for checkout.

Notification Scheduler detects bonus notification candidates and requests Notification Runtime; it does not deliver messages directly.

CRM and support must use approved Bonus commands for manual adjustments.

UI must not calculate, reserve, redeem, expire, cancel, reverse or manually adjust bonuses.

Future Promotion Runtime may author campaigns and budgets, but Bonus Domain executes bonus rights lifecycle.

---

## Consequences

Future Bonus Runtime implementation must expose command, query and event contracts before Mini App, Telegram Bot, CRM, Notification, Discount, Checkout or Promotion flows depend on it.

Future referral, birthday, trusted customer, seasonal and manual adjustment flows must be idempotent, auditable and rule-versioned.

Future Burn Scheduler and Notification Scheduler implementations must store scheduler run state, support safe redrive and avoid duplicate expiration, cancellation or message delivery.

Future refunds and cancellations must use explicit Bonus cancellation or reversal policies and must not mutate historical bonus transactions.

Any future code that treats bonuses as money, stores bonuses in Wallet or Club Account, passes bonuses as payment method lines, edits bonus history directly or sends bonus notifications from Bonus Domain requires correction or architecture review.

---

## Related Documentation

- `docs/domain/BONUS_DOMAIN.md`
- `docs/architecture/BONUS_ENGINE.md`
- `docs/architecture/DISCOUNT_ENGINE.md`
- `docs/architecture/PRICING_ENGINE.md`
- `docs/architecture/CHECKOUT.md`
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/architecture/WALLET.md`
- `docs/architecture/LEDGER.md`
- `docs/domain/CUSTOMER_DOMAIN.md`
- `docs/domain/CLUB_ACCOUNT.md`
- `docs/domain/CONSENT_MODEL.md`
- `docs/api/EVENT_API.md`

---

# Decision: Club Account Prepaid Balance Boundary

**Date:** 2026-07-06

**Status:** Accepted

## Context

Soft ICE Platform needs a Club Account model for Club Timofey customers that can support prepaid balance, top-ups, spending, refunds, low-balance notifications, saved payment method consent and future auto top-up.

Without a documented boundary, prepaid balance could be confused with a bank account, Wallet implementation detail, saved card storage, bonus balance, discount value, Payment provider state or Order fulfillment permission.

That confusion would create risk around automatic debits, purchase preparation, refunds, customer messaging, audit and future CRM support.

---

## Decision

Soft ICE Platform defines Club Account as the customer-facing prepaid account boundary for purchases inside the platform.

Club Account is not a bank account.

Club Account funds represent prepaid balance for platform purchases only.

Club Account owns the customer-facing account lifecycle, available and reserved balance rules, minimum recommended balance rule, top-up recommendation rule, transaction history, saved payment method consent status, auto top-up policy state and Club Account events.

Minimum recommended balance is 150 ₽.

When available balance drops below 150 ₽, the platform emits a low-balance fact so Notification can contact the customer according to consent and throttling policy.

The system recommends top-up by 100 ₽. The customer may choose another valid amount.

Saved payment method means provider-safe payment method reference, not saved card data.

Saved payment method can be used for one-click top-up only after explicit consent.

No automatic debit is allowed without explicit consent. Auto top-up requires separate consent, configured limits and provider/legal approval before production use.

Purchase preparation starts only after successful payment authorization under approved Payment and Order policy.

If Club Account balance is insufficient, the customer may top up, pay the difference or use another payment method.

Bonus balance is independent from Club Account balance. Bonus is a right to discount of 1 ₽.

Club Account keeps immutable transaction history; corrections and refunds are compensating operations, not edits.

---

## Architecture Principles

Ledger remains the source of truth for financial facts.

Wallet may provide a Ledger-backed projection.

Payment Engine owns provider confirmation and external settlement.

Order owns purchase lifecycle and machine fulfillment handoff.

Bonus Engine owns bonus rights.

Discount/Pricing own payable amount calculation.

Club Account must not calculate product price, apply discounts, accrue bonuses, store raw card data, execute provider API calls, mutate Order state or start machine preparation.

UI must not reconstruct balance, infer payment success or start preparation from local state.

---

## Consequences

Future Club Account implementation must expose command, query and event contracts before Mini App, Telegram Bot, CRM or backend flows depend on it.

Future top-up, one-click top-up, auto top-up, spending, refund and closing flows must be idempotent, auditable and Ledger/Payment aligned.

Future saved payment method implementation must store only provider-safe references and consent metadata, never raw card data.

Future low-balance notification must use the 150 ₽ threshold and 100 ₽ top-up recommendation unless Product Owner approves a versioned policy change.

Any future code that treats Club Account as a bank account, merges bonuses into prepaid balance, debits without consent or starts machine preparation before approved payment authorization requires correction or architecture review.

---

## Related Documentation

- `docs/domain/CLUB_ACCOUNT.md`
- `docs/domain/CUSTOMER_DOMAIN.md`
- `docs/domain/CONSENT_MODEL.md`
- `docs/architecture/WALLET.md`
- `docs/architecture/LEDGER.md`
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/architecture/BONUS_ENGINE.md`
- `docs/architecture/DISCOUNT_ENGINE.md`
- `docs/architecture/CHECKOUT.md`
- `docs/architecture/ORDER_PLATFORM.md`
- `docs/api/EVENT_API.md`

---

# Decision: Customer Domain Identity and Relationship Boundary

**Date:** 2026-07-06

**Status:** Accepted

## Context

Soft ICE Platform needs a shared customer model for Mini App, Telegram Bot, web app, vending terminal, CRM, Order, Payment, Bonus, Discount, Notification, Analytics and future Promotion workflows.

Without a documented Customer Domain boundary, Telegram ID, phone, email, club status, trusted customer flags, referral links, consent state and CRM support data could become duplicated across UI, API handlers, Order, Payment, Bonus, Discount or Notification code.

That would make CustomerID unstable, weaken privacy and consent handling, and make future CRM or loyalty implementation harder to audit.

---

## Decision

Soft ICE Platform defines Customer Domain as the owner of the customer relationship.

Customer Domain owns:

- `customer_id`;
- customer lifecycle;
- profile attributes;
- contact points;
- identity links;
- consent summary projection and consent references;
- Club Timofey membership status;
- trusted customer status;
- referral relationships;
- customer activity timeline;
- customer domain events and audit metadata.

CustomerID is the canonical platform identity.

Telegram ID, phone, email, VK ID, MAX ID, OAuth subject IDs and payment provider customer references are external aliases only.

Authentication verifies external credentials.

Authorization enforces route and resource access policy.

Customer Domain resolves or creates `customer_id`, links identities, maintains customer relationship state and exposes safe customer context to other Runtime contracts.

---

## Architecture Principles

Customer Domain must not calculate product price, apply discounts, accrue bonuses, mutate wallet balance, execute payment, change Order lifecycle, deliver notifications directly or enforce API route authorization.

Club status is not bonus balance.

Trusted customer status is not an authorization role.

Referral relationship is not reward execution.

Consent evidence is auditable and must not be overwritten by profile updates.

External identity links must preserve provenance, conflict handling and audit.

Customer activity history is a projection from accepted facts and approved audit records; it does not replace source domains.

---

## Consequences

Future Customer Runtime implementation must expose command, query and event contracts before UI or CRM screens depend on customer data.

Future Telegram, phone, email, VK, MAX and OAuth linking must resolve to `customer_id` before internal business contracts use customer identity.

Future Order, Payment, Bonus, Discount, Wallet, Notification, CRM, Analytics and Promotion integrations must consume customer context through approved contracts and events instead of duplicating customer state.

Final Club Timofey benefits, trusted customer criteria, referral qualification rules and reward amounts require Product Owner approval before implementation.

Any future code that treats Telegram ID, phone, email or provider customer ID as the primary platform customer identity requires correction or architecture review.

---

## Related Documentation

- `docs/domain/CUSTOMER_DOMAIN.md`
- `docs/domain/CONSENT_MODEL.md`
- `docs/api/AUTHENTICATION.md`
- `docs/api/AUTHORIZATION.md`
- `docs/api/EVENT_API.md`
- `docs/domain/ANALYTICS_EVENTS.md`
- `docs/architecture/DISCOUNT_ENGINE.md`
- `docs/architecture/BONUS_ENGINE.md`
- `docs/architecture/ORDER_PLATFORM.md`
- `docs/crm_architecture.md`

---

# Decision: Event API Fact Boundary

**Date:** 2026-07-06

**Status:** Accepted

## Context

Soft ICE Platform needs asynchronous contracts for Orders, Payments, Wallet, Bonus, Products, Promotions, Machines, Customers, Notifications, Analytics and future integrations.

Without a documented Event API boundary, event routing could become mixed with product configuration, pricing, wallet balance changes, bonus rules, payment decisions, order state transitions, machine fulfillment, promotion eligibility, notification content or analytics meaning.

---

## Decision

Soft ICE Platform defines Event API as an asynchronous fact boundary.

Events are immutable.

Events describe facts.

Business logic belongs to Runtime.

Event API is transport independent.

Event Runtime validates envelope shape, routing, delivery policy, retries, replay, idempotency and dead-letter handling.

Event Runtime must not interpret business payload meaning or decide domain outcomes.

---

## Architecture Principles

Event producers are Runtimes.

Event names use the `<Domain>.<Fact>` format.

Event payload meaning is owned by the producing Runtime.

Event consumers must be idempotent.

Event delivery is at-least-once by default.

Global ordering is not assumed.

Ordering is scoped to an aggregate only when the producing Runtime and transport can provide sequence metadata.

Retry and dead-letter policy are infrastructure behavior. Business compensation remains inside Runtime.

Transport may evolve from in-process bus to queue, broker, stream, cloud event bus or webhook gateway without changing event contracts.

---

## Consequences

Future event implementation must use a formal registry entry before an event is published.

Future producers must authenticate, authorize and publish versioned envelopes with safe metadata.

Future consumers must declare supported event versions and deduplicate event processing.

Dead-letter redrive and replay require authorization and audit.

Any future Event Runtime behavior that calculates business outcomes or mutates domain state directly requires correction or architecture review.

---

## Related Documentation

- `docs/api/EVENT_API.md`
- `docs/api/API_OVERVIEW.md`
- `docs/api/AUTHENTICATION.md`
- `docs/api/AUTHORIZATION.md`
- `docs/kernel/PLATFORM_KERNEL.md`
- `docs/kernel/RUNTIME_REGISTRY.md`
- `docs/architecture/EVENT_PLATFORM.md`

---

# Decision: REST API Transport Boundary

**Date:** 2026-07-06

**Status:** Accepted

## Context

Soft ICE Platform needs synchronous API contracts for Mini App, web app, Telegram bot, CRM, machine adapters, partner integrations, analytics and future SDK clients.

Without a documented REST boundary, API route handlers could become mixed with product configuration, pricing, wallet, bonus, payment, order, machine, promotion, CRM or analytics business rules.

---

## Decision

Soft ICE Platform defines REST API as a synchronous transport boundary only.

REST endpoints expose capabilities only.

Business rules remain inside Runtime.

REST API is transport only.

REST routes may authenticate, authorize, validate request shape, enforce idempotency, apply rate limits, route commands and queries, return Runtime DTOs and expose safe operational metadata.

REST routes must not calculate product configuration, pricing, discounts, bonuses, payment outcomes, order transitions, machine fulfillment rules, notification content, promotion eligibility or analytics meaning.

---

## Architecture Principles

REST resources represent platform contracts, not database tables, repositories or internal engines.

REST route handlers must call approved Runtime contracts.

`GET` routes must not mutate business state.

Mutating routes must use idempotency where duplicate submission may cause side effects.

Authentication and authorization run before protected Runtime calls.

Errors, pagination, filtering, sorting, rate limits, correlation IDs and audit context are transport and platform concerns.

Runtime owns business validation, state transitions, financial meaning, product configuration, machine outcomes, promotion eligibility and analytics projections.

---

## Consequences

Future REST implementation must follow documented resource naming, method usage, request and response shape, error format, versioning, idempotency and security integration.

Future OpenAPI contracts should be generated or maintained from the documented REST boundary.

Future API handlers that access repositories directly or duplicate Runtime business logic require correction or architecture review.

REST contract tests should verify request shape, response shape, authentication, authorization, idempotency and error behavior without embedding business rules in route tests.

---

## Related Documentation

- `docs/api/REST_API.md`
- `docs/api/API_OVERVIEW.md`
- `docs/api/AUTHENTICATION.md`
- `docs/api/AUTHORIZATION.md`
- `docs/kernel/PLATFORM_KERNEL.md`
- `docs/business/PLATFORM_PRINCIPLES.md`

---

# Decision: Authorization Access Policy Boundary

**Date:** 2026-07-06

**Status:** Accepted

## Context

Soft ICE Platform API needs protected access for customers, machines, CRM operators, administrators, partners, API clients, providers and internal services.

Without a documented authorization boundary, API Gateway policy could become mixed with authentication, product eligibility, pricing, payment, order transitions, machine fulfillment, loyalty, promotion or CRM business rules.

---

## Decision

Soft ICE Platform defines authorization as access policy enforcement only.

Authentication answers who you are.

Authorization answers what you are allowed to do.

CustomerID is the primary platform identity.

TelegramID, phone, email, VK ID and external OAuth IDs are external identities only.

Authorization never contains business logic.

Runtime owns business rules.

API Gateway enforces access policy.

Authorization uses roles, scopes and permissions to decide whether an authenticated actor may call a route, use a contract, read a protected resource class or submit a command envelope.

Authorization must not decide product eligibility, price, discount eligibility, bonus usage, payment outcome, order lifecycle state, machine fulfillment validity, loyalty status, campaign eligibility or support workflow business outcome.

---

## Architecture Principles

Permissions are stable access units.

Roles group permissions for actor types.

Scopes limit where permissions apply.

Customer authorization must use `customer_id`, not TelegramID, phone, email, VK ID or external OAuth IDs.

Customer, operator, machine, partner, API client and internal service permissions must remain separate.

Least privilege and deny-by-default are required.

Sensitive authorization decisions, role assignments, revocations, CRM access, admin actions and partner or machine access changes must be auditable.

Runtime receives identity and authorization context but still validates domain rules through official contracts.

---

## Consequences

Future API Gateway implementation must enforce explicit route-level authorization policy before Runtime execution.

Future Runtime implementation must not treat API authorization as proof that a business action is valid.

Role assignment, permission grants, revocation and denied sensitive access require audit records.

External identity providers and aliases must resolve to platform identities before authorization decisions.

Any future authorization handler that embeds product, pricing, payment, order, machine, loyalty, promotion or CRM business logic requires correction or architecture review.

---

## Related Documentation

- `docs/api/AUTHORIZATION.md`
- `docs/api/AUTHENTICATION.md`
- `docs/api/API_OVERVIEW.md`
- `docs/kernel/PLATFORM_KERNEL.md`
- `docs/kernel/SERVICE_REGISTRY.md`
- `docs/business/PLATFORM_PRINCIPLES.md`

---

# Decision: Authentication Identity Boundary

**Date:** 2026-07-06

**Status:** Accepted

## Context

Soft ICE Platform API must support Mini App customers, web users, Telegram users, CRM operators, vending machines, machine adapters, payment and notification providers, partner systems, SDK clients and internal services.

Without a documented authentication boundary, identity verification could become mixed with authorization, product eligibility, pricing, payment, order, machine, loyalty or promotion rules.

---

## Decision

Soft ICE Platform defines authentication as identity verification only.

Authentication answers who or what is calling the platform.

Authorization is documented separately.

Authentication never contains business logic.

Runtime owns business behavior.

Authentication may verify credentials, validate token signatures, verify Telegram Mini App init data, verify machine and partner credentials, create identity context, create session context and reject invalid credentials before Runtime processing.

Authentication must not decide route permissions, product eligibility, price, discount, bonus usage, payment behavior, order transitions, machine fulfillment, loyalty rules, promotion participation or operator business permissions.

---

## Architecture Principles

Every protected request must produce normalized identity context before Runtime processing.

Customer, operator, machine, machine adapter, partner, provider and internal service identities must be distinguishable.

Credentials, secrets, raw tokens, Telegram init data, API keys and signatures must not be stored in repository files or written to logs.

API keys authenticate non-human integrations, not human users.

JWT access tokens must be short-lived and must not contain business state.

Refresh tokens must be revocable and must not reach Runtime contracts.

Machine and provider callbacks must be authenticated before their facts are routed to Runtime contracts or Event API.

---

## Consequences

Future authentication implementation must be built as platform security infrastructure, not as domain business logic.

Authorization documentation must define route access, scopes, roles and Runtime authorization boundaries separately.

Runtime contracts must receive safe identity context and remain responsible for domain validation and business decisions.

Authentication telemetry and audit records must be safe, correlated and free of secrets.

Any future authentication handler that embeds product, pricing, payment, order, machine, loyalty or promotion decisions requires correction or architecture review.

---

## Related Documentation

- `docs/api/AUTHENTICATION.md`
- `docs/api/API_OVERVIEW.md`
- `docs/kernel/PLATFORM_KERNEL.md`
- `docs/kernel/PLATFORM_CONFIGURATION.md`
- `docs/business/PLATFORM_PRINCIPLES.md`

---

# Decision: API Contract Boundary

**Date:** 2026-07-06

**Status:** Accepted

## Context

Soft ICE Platform has documented Platform Kernel, Runtime Registry and Service Registry boundaries. Future platform consumers now need a shared API direction for REST, events, webhooks, authentication, authorization, idempotency, versioning, errors, security, monitoring and SDKs.

Without an explicit API boundary, route handlers, webhook handlers or SDK clients could duplicate business logic that belongs in Runtimes and Engines.

---

## Decision

Soft ICE Platform defines the API as a contract and integration layer.

The API never contains business logic.

Runtime owns business logic.

API is a contract.

Configuration controls behavior when the platform model already supports it.

REST APIs, Event APIs and webhooks must expose Runtime-owned contracts and use Platform Services for domain-neutral concerns such as authentication context, validation, idempotency, logging, telemetry, health, audit and rate limiting.

API consumers must not access repositories, storage or internal engines directly.

---

## Architecture Principles

API may authenticate, authorize at transport level, validate schemas, enforce idempotency, apply rate limits, route requests, expose health and observe traffic.

API must not calculate product configuration, pricing, discounts, bonuses, payment decisions, order transitions, machine fulfillment rules, notification content or promotion logic.

Runtime validates domain rules and owns business authorization.

Event API transports accepted facts. Event Runtime validates envelope, routing and delivery policy without interpreting business payload meaning.

Webhooks authenticate, validate, deduplicate and route external facts to Runtime contracts or Event API without directly mutating domain state.

Future SDKs wrap contracts and must not contain business logic.

---

## Consequences

Future API implementation must call official Runtime contracts instead of internal engines or repositories.

Mutating API operations must support idempotency where duplicate submission is possible.

Authentication, authorization, validation, telemetry, audit and correlation context must be propagated through Runtime calls, events and webhooks.

REST, event, webhook, error and versioning contracts should be documented before implementation.

Any future API behavior that embeds business logic requires correction or an explicit architecture review.

---

## Related Documentation

- `docs/api/API_OVERVIEW.md`
- `docs/kernel/PLATFORM_KERNEL.md`
- `docs/kernel/RUNTIME_REGISTRY.md`
- `docs/kernel/SERVICE_REGISTRY.md`
- `docs/architecture/ARCHITECTURE_BASELINE_1_0.md`
- `docs/business/PLATFORM_PRINCIPLES.md`

---

# Decision: Platform Kernel Registry and Lifecycle Contracts

**Date:** 2026-07-03

**Status:** Accepted

## Context

The Platform Kernel boundary is documented, but implementation-ready platform work also needs explicit contracts for runtime discovery, runtime registration, service registration, engine registration, configuration loading, bootstrap order, health monitoring and graceful shutdown.

Without these contracts, future runtimes could be connected inconsistently, the Kernel could become coupled to business logic, and operational readiness could be inferred from process startup instead of validated runtime health.

---

## Decision

Soft ICE Platform introduces documentation-first Kernel contracts for:

- Runtime Registry;
- Service Registry;
- Platform Bootstrap;
- Platform Configuration;
- Platform Lifecycle.

Every Runtime must register through a manifest or equivalent registration contract.

Every Engine must be registered through its owning Runtime.

Platform Bootstrap must validate configuration, registries, runtime dependencies, engine registration and health checks before platform readiness is marked.

Platform Configuration must use explicit schemas, scoped runtime configuration and external secret references.

Platform Lifecycle must define operational states, health escalation, graceful shutdown, forced stop policy and recovery boundaries.

---

## Architecture Principles

The Kernel coordinates operational lifecycle only.

Runtime owns business logic.

Engine owns domain implementation.

Platform Services are domain-neutral.

Configuration Service validates shape and delivery. Runtime validates business meaning.

Health Monitor observes runtime, engine, service, adapter and event health but does not decide business compensation.

Graceful shutdown must stop accepting new work, drain accepted work where possible, preserve auditability and avoid silent loss of accepted business events.

---

## Consequences

Future Kernel implementation must follow the documented registry, bootstrap, configuration and lifecycle contracts.

New runtimes must provide manifest metadata, configuration schema references, owned engines, service dependencies, event producers and consumers, health checks and lifecycle hooks.

New engines must be registered by their owning Runtime and exposed through official contracts or facades.

Readiness must depend on required Runtime, Engine, Service and configuration health, not on process startup alone.

Any future deviation from these contracts requires an explicit architecture decision.

---

## Related Documentation

- `docs/kernel/RUNTIME_REGISTRY.md`
- `docs/kernel/SERVICE_REGISTRY.md`
- `docs/kernel/PLATFORM_BOOTSTRAP.md`
- `docs/kernel/PLATFORM_CONFIGURATION.md`
- `docs/kernel/PLATFORM_LIFECYCLE.md`
- `docs/kernel/PLATFORM_KERNEL.md`
- `docs/architecture/ARCHITECTURE_BASELINE_1_0.md`

---

# Decision: Platform Kernel Boundary

**Date:** 2026-07-03

**Status:** Accepted

## Context

Soft ICE Platform is evolving from isolated runtime modules into a coordinated platform with Product, Finance, Order, Event, Machine, Notification, CRM, Analytics, Promotion and future AI capabilities.

The platform needs a common coordination layer for startup, shutdown, configuration, runtime registration, service registration, event delivery, health monitoring, logging, telemetry and security primitives.

This coordination layer must not become a place where product, pricing, payment, order, machine or loyalty business rules are hidden.

---

## Decision

The platform introduces the **Platform Kernel** as an infrastructure coordination layer.

The Kernel coordinates Runtime.

Runtime owns business logic.

Engine owns implementation.

Configuration is preferred over code changes when the platform model already supports the behavior.

The Platform Kernel must never contain business logic. It may start, stop, register, observe and connect runtimes, but it must not decide product configuration, price calculation, payment behavior, order transitions, machine fulfillment rules, customer communication content or promotion mechanics.

---

## Architecture Principles

Platform Kernel must provide:

- runtime registry;
- service registry;
- event bus infrastructure;
- configuration loading and validation;
- logging and telemetry infrastructure;
- health monitoring;
- startup and shutdown lifecycle coordination;
- security context primitives;
- feature flag access;
- dependency ordering between runtimes.

The Kernel may reject invalid configuration, missing required dependencies or unsafe runtime registration.

The Kernel must stay domain-neutral.

---

## Consequences

Future runtime implementation must keep business logic in runtimes and engines.

New product categories, payment providers, machine adapters, notification channels and promotion campaigns should be introduced through runtime contracts, adapters and configuration rather than Kernel changes.

Any future Kernel implementation must be preceded by explicit contracts for runtime registration, service registration, event envelope, health checks and configuration schemas.

---

## Related Documentation

- `docs/kernel/PLATFORM_KERNEL.md`
- `docs/architecture/ARCHITECTURE_BASELINE_1_0.md`
- `docs/releases/RELEASE_1_0.md`
- `docs/business/PLATFORM_PRINCIPLES.md`

---

# Decision: Promotion Platform Vision

**Date:** 2026-07-03

**Status:** Accepted

## Context

В процессе проектирования Soft ICE Platform было принято решение отказаться от реализации разрозненных маркетинговых акций, конкурсов и розыгрышей.

Практика большинства компаний основана на ручном управлении подобными мероприятиями, что приводит к дополнительным трудозатратам, человеческим ошибкам, отсутствию прозрачности и невозможности масштабирования.

Soft ICE Platform проектируется как автоматизированная система управления продуктом, клиентами, финансовыми операциями, заказами и маркетинговыми процессами.

Поэтому маркетинговые активности должны стать частью архитектуры платформы, а не набором отдельных ручных сценариев.

---

## Decision

В платформу вводится отдельная подсистема:

**Promotion Platform / Promotion Runtime**

Promotion Platform является самостоятельным Runtime платформы Soft ICE и отвечает за проведение маркетинговых кампаний, конкурсов, розыгрышей, сезонных активностей и программ стимулирования клиентов.

После публикации кампании её выполнение должно происходить автоматически.

Изменение программного кода для запуска новой акции не допускается.

Все новые кампании создаются путём конфигурирования системы, а не через разработку отдельного сценария под каждую акцию.

---

## Architecture Principles

Promotion Platform должна обеспечивать:

- автоматическое выполнение кампаний;
- автоматическое начисление билетов или шансов участия;
- автоматическую проверку условий участия, если проверка может быть выполнена системой;
- автоматическое определение победителей;
- автоматическое уведомление участников;
- автоматическое формирование истории кампаний;
- журнализацию всех действий;
- возможность независимого аудита результатов;
- прозрачность правил для участников;
- поддержку разных каналов: Telegram, VK, Mini App, сайт, CRM, автомат.

---

## Manual Operations

Ручное вмешательство допускается только в случаях, когда требуется модерация пользовательского контента или разбор спорной ситуации.

Примеры допустимого ручного вмешательства:

- проверка фотографий;
- проверка жалоб;
- подтверждение нестандартной ситуации;
- ручное решение спорного кейса администратором.

Все остальные процессы должны быть автоматизированы.

---

## Campaign Examples

Платформа должна поддерживать проведение разных кампаний без изменения архитектуры.

Примеры кампаний:

- 🎁 Клубные подарки Тимоши
- 🍀 Сезон удачи от Тимоши
- 🎡 Колесо удачи Тимоши
- 🎉 Фестиваль подарков
- ⭐ Неделя сюрпризов
- 🎈 Праздник клуба Тимоши

Перечень кампаний не ограничивается указанными примерами и может расширяться через конфигурацию.

---

## Future Runtime

После завершения базовой архитектуры создаётся отдельный EPIC:

**EPIC-500 Promotion Platform**

В него войдут:

- Campaign Engine;
- Contest Engine;
- Prize Engine;
- Winner Engine;
- Referral Campaign Engine;
- Seasonal Campaign Engine;
- Promotion Analytics;
- Promotion Dashboard;
- Campaign Automation.

---

## Expected Result

Маркетинговые кампании становятся частью архитектуры платформы.

Любая новая акция создаётся без изменения исходного кода.

Promotion Platform становится единым центром управления маркетинговыми активностями Soft ICE Platform.

Маркетинговые механики проектируются как повторно используемые компоненты, а не как одноразовые акции.

---

## Status

**Accepted**

Architecture Decision approved.
