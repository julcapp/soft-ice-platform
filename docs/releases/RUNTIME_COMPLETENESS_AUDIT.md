# Runtime Completeness Audit

Status: Completed
Version: 1.0
Audit type: Documentation-only runtime completeness audit
Date: 2026-07-03
Project: Soft ICE Platform / Utimoshi
Related baseline: `docs/architecture/ARCHITECTURE_BASELINE_1_0.md`
Related audit: `docs/releases/ARCHITECTURE_AUDIT.md`
Related memory: `PROJECT_MEMORY.md`

## Purpose

This document evaluates Runtime completeness across the current Soft ICE Platform architecture.

The audit checks whether each Runtime has enough implemented behavior, documentation, contracts, lifecycle definition, state model, event model, monitoring, auditability and acceptance criteria to support the MVP goal:

```text
A customer can select a dessert, pay for it and receive it from a vending machine.
```

This is a documentation-only audit. It does not modify application code, frontend code, backend code, UI, styles, infrastructure runtime configuration or generated build output.

## Scope

Included:

- Platform Runtime;
- Catalog Runtime;
- Configuration Runtime;
- Media Runtime;
- Recipe Runtime;
- Pricing Runtime;
- Finance Runtime;
- Ledger Runtime;
- Wallet Runtime;
- Bonus Runtime;
- Discount Runtime;
- Payment Runtime;
- Accounting Adapter Runtime;
- Order Runtime;
- Event Runtime;
- Machine Runtime;
- Notification Runtime;
- Customer and CRM Runtime;
- Analytics Runtime;
- AI Runtime.

Minimum requested Runtime coverage is included:

- Platform Runtime;
- Configuration Runtime;
- Pricing Runtime;
- Recipe Runtime;
- Finance Runtime;
- Order Runtime;
- Event Runtime.

Excluded:

- code changes;
- frontend changes;
- UI changes;
- runtime refactoring;
- package changes;
- build execution;
- production deployment;
- business decision changes.

## Runtime Definition

For this audit, a Runtime is a platform capability that can own behavior at execution time, expose public interfaces, maintain or derive state, produce or consume events, enforce business rules and participate in operational support.

Some Runtimes currently exist as working JavaScript domain modules. Others are architecture-only and have not yet been implemented. Scores reflect that difference.

## Method

Read and checked:

- `AGENTS.md`;
- `PROJECT_MEMORY.md`;
- `docs/releases/ARCHITECTURE_AUDIT.md`;
- `docs/architecture/ARCHITECTURE_BASELINE_1_0.md`;
- supporting architecture documents under `docs/architecture/`;
- supporting domain documents under `docs/domain/`;
- supporting task documents under `docs/tasks/`;
- runtime package and domain file inventory under `frontend/miniapp/`, `backend/` and `telegram-bot/`.

Build was not run because this task is documentation-only and intentionally does not change behavior.

## Scoring Model

Completeness Score measures runtime implementation and operational readiness.

Documentation Score measures whether the documented Runtime covers:

- Purpose;
- Responsibilities;
- Boundaries;
- Public Interfaces;
- Lifecycle;
- Events;
- Business Rules;
- State Model;
- Failure Scenarios;
- Monitoring;
- Audit;
- Acceptance Criteria;
- Future Roadmap.

Risk levels:

| Risk | Meaning |
|---|---|
| Low | Runtime is mostly implemented or low blast radius. |
| Medium | Runtime is usable in limited MVP paths but has gaps. |
| High | Runtime is architecture-first or partially implemented with important gaps. |
| Critical | Runtime is required for MVP but is not yet implemented or specified enough. |

## Executive Summary

Overall Runtime Readiness: 34 / 100

Architecture Readiness: 76 / 100

Runtime status:

```text
Architecture-guided, not MVP-runtime-ready.
```

The strongest implemented Runtimes are Configuration, Recipe and Pricing. They have isolated domain modules, services, repositories, entities and semantic IDs.

The strongest documented but weakly implemented Runtimes are Order, Payment, Wallet, Bonus, Discount, Accounting Adapter and Event Platform.

The highest MVP risks are Payment, Order, Machine, Event, Platform Contracts and Notification because the commercial MVP requires payment settlement, reliable order state, dispatch to a vending machine and customer communication.

## Runtime Package Inventory

| Runtime package | Current status | Notes |
|---|---|---|
| Mini App | Present | React and Vite package exists. Domain modules exist under `frontend/miniapp/src/domain/`. UI still has legacy catalog paths according to the architecture audit. |
| Backend API | Present foundation | Express and Prisma foundation exists. Package name still uses legacy `roylty-backend`. Payment migration history exists, but platform runtime APIs are not complete. |
| Telegram Bot | Present foundation | Separate bot package exists for Telegram/YooKassa verification scenario. Not yet integrated as a full Runtime consumer of shared platform contracts. |

## Runtime Score Matrix

| Runtime | Completeness Score | Documentation Score | Risk Level |
|---|---:|---:|---|
| Platform Runtime | 24 / 100 | 38 / 100 | High |
| Catalog Runtime | 64 / 100 | 58 / 100 | Medium |
| Configuration Runtime | 74 / 100 | 72 / 100 | Medium |
| Media Runtime | 28 / 100 | 55 / 100 | High |
| Recipe Runtime | 72 / 100 | 48 / 100 | Medium |
| Pricing Runtime | 73 / 100 | 68 / 100 | Medium |
| Finance Runtime | 30 / 100 | 82 / 100 | High |
| Ledger Runtime | 18 / 100 | 48 / 100 | High |
| Wallet Runtime | 18 / 100 | 84 / 100 | High |
| Bonus Runtime | 16 / 100 | 84 / 100 | High |
| Discount Runtime | 15 / 100 | 86 / 100 | High |
| Payment Runtime | 22 / 100 | 88 / 100 | Critical |
| Accounting Adapter Runtime | 10 / 100 | 82 / 100 | High |
| Order Runtime | 24 / 100 | 92 / 100 | Critical |
| Event Runtime | 16 / 100 | 82 / 100 | Critical |
| Machine Runtime | 18 / 100 | 70 / 100 | Critical |
| Notification Runtime | 6 / 100 | 34 / 100 | High |
| Customer and CRM Runtime | 18 / 100 | 46 / 100 | High |
| Analytics Runtime | 20 / 100 | 42 / 100 | Medium |
| AI Runtime | 0 / 100 | 28 / 100 | Low for MVP, High for roadmap |

## Platform Runtime

| Area | Verification |
|---|---|
| Purpose | Provide shared platform capabilities: contracts, events, logging, telemetry, validation, security, identity, configuration and feature flags. |
| Responsibilities | Own cross-domain infrastructure patterns and prevent direct coupling between business domains. |
| Boundaries | Must not own catalog, pricing, payment, order, machine or UI business logic. |
| Public Interfaces | Planned `platform/`, `domain/contracts/`, event contracts and future platform services. Current platform documents are mostly placeholders. |
| Lifecycle | Not fully defined. Runtime boot, configuration loading, feature-flag evaluation and shutdown behavior are not documented. |
| Events | Event Platform is documented, but there is no implemented event bus or platform event transport. |
| Business Rules | Baseline principles exist: official contracts, DDD Lite, separation of engines and source-of-truth boundaries. |
| State Model | Not complete. Identity, configuration, feature flags, telemetry state and contract registry state are not modeled. |
| Failure Scenarios | Not complete. Missing explicit behavior for contract validation failure, event publish failure, configuration failure, identity failure and telemetry outage. |
| Monitoring | Logging and telemetry are named in Platform Core, but no monitoring contract exists. |
| Audit | No central audit runtime exists. Domain-specific audit rules are documented in Finance, Order and Accounting documents. |
| Acceptance Criteria | Needs approved Platform Kernel, Platform Contracts, Platform Capabilities and operational quality gates. |
| Future Roadmap | Implement platform contracts, event bus adapter, validation layer, telemetry, audit correlation and feature flags. |

Completeness Score: 24 / 100

Documentation Score: 38 / 100

Risk Level: High

Recommendations:

- Fill `docs/architecture/PLATFORM_KERNEL.md`, `PLATFORM_CONTRACTS.md` and `PLATFORM_CAPABILITIES.md`.
- Define runtime boot, configuration, identity, validation, logging, telemetry and audit contracts.
- Introduce stable platform adapters before Finance, Order, Payment and Machine are connected.

## Catalog Runtime

| Area | Verification |
|---|---|
| Purpose | Provide product, flavor, syrup and topping source data for every channel. |
| Responsibilities | Expose products and ingredient choices through `CatalogService` and normalized entities. |
| Boundaries | Must not calculate final price, choose payment behavior, execute recipes or own UI display logic. |
| Public Interfaces | `CatalogService`, `CatalogRepository`, entity factories and catalog exports exist. |
| Lifecycle | Product lifecycle is partly documented as available/sold_out/hidden/seasonal/draft, but runtime state transitions are not implemented. |
| Events | `ProductCatalogUpdated` is documented in Event Platform; runtime does not publish it. |
| Business Rules | Semantic IDs exist in new catalog data. Legacy catalog IDs still exist in `frontend/miniapp/src/domain/catalog.js`. |
| State Model | In-memory JS data exists. Future API/PostgreSQL replacement path is implied by repository pattern. |
| Failure Scenarios | Missing product, flavor, syrup or topping returns null/false. Formal error contract is not defined. |
| Monitoring | No catalog monitoring exists. |
| Audit | Catalog change audit is not implemented. |
| Acceptance Criteria | Retire legacy catalog path, formalize catalog contracts, publish catalog events and verify all UI reads through service. |
| Future Roadmap | API-backed catalog, multi-product support, availability projections and catalog event publication. |

Completeness Score: 64 / 100

Documentation Score: 58 / 100

Risk Level: Medium

Recommendations:

- Make the DDD Lite catalog the only runtime catalog.
- Remove or migrate legacy IDs such as `soft_ice_cup`, `vanilla`, `sprinkles` and `choco_crunch`.
- Update older domain docs that still place price and image paths inside product records.

## Configuration Runtime

| Area | Verification |
|---|---|
| Purpose | Build and validate a permitted product configuration. |
| Responsibilities | Validate product, flavor, size, syrup, topping, extras, blocked combinations and recipe/media references. |
| Boundaries | Does not calculate price, execute recipe, take payment, manage wallet, operate machine or render UI. |
| Public Interfaces | `ConfigurationService.validateConfiguration`, `buildConfiguration`, `ConfigurationRepository`, `ConfigurationEntity`. |
| Lifecycle | Draft input is normalized, validated and built into a Configuration Entity. Formal persisted lifecycle is not implemented. |
| Events | Configuration events are listed in Event Platform, but runtime does not publish events. |
| Business Rules | MVP rules exist for vanilla cup with one syrup and one topping. Blocked-combination extension exists. |
| State Model | Entity and repository-backed configuration rules exist. |
| Failure Scenarios | Validation errors are explicit and throw `ConfigurationValidationError` when building invalid configuration. |
| Monitoring | No monitoring exists. |
| Audit | No audit trail exists for configuration decisions. |
| Acceptance Criteria | UI and checkout use Configuration Runtime for all product configuration. Events and contract schemas are approved. |
| Future Roadmap | More product categories, extras, availability constraints, channel constraints and API-backed rules. |

Completeness Score: 74 / 100

Documentation Score: 72 / 100

Risk Level: Medium

Recommendations:

- Add formal configuration result contract and event payloads.
- Add tests for invalid selections, blocked combinations and missing recipe/media references.
- Wire all purchase flow screens through Configuration Runtime.

## Media Runtime

| Area | Verification |
|---|---|
| Purpose | Resolve product and ingredient media assets outside UI components. |
| Responsibilities | Store media metadata, choose product image, provide fallback and expose approved assets. |
| Boundaries | Must not validate product configuration, calculate price, mutate catalog or render UI. |
| Public Interfaces | `MediaService` exists, but `MediaRepository` methods currently throw `NotImplementedError`. |
| Lifecycle | Media status is documented as draft/review/approved/deprecated/archived. Runtime lifecycle is not implemented. |
| Events | `ProductImageShown`, `ProductImageFallbackShown` and `ProductImageMissing` are documented as analytics events. No domain event implementation exists. |
| Business Rules | Product image priority is documented: composed, syrup, topping, base. Runtime selection is not implemented. |
| State Model | `MediaReference` exists. Media asset model is documented but not backed by runtime data. |
| Failure Scenarios | Repository calls fail by design until implemented. Fallback behavior is not implemented. |
| Monitoring | Missing media monitoring and missing-asset metrics. |
| Audit | No media approval or change audit exists. |
| Acceptance Criteria | Implement media repository/data, fallback selection, semantic media IDs and UI consumption through MediaService. |
| Future Roadmap | Media library API, asset approval workflow, responsive variants, CDN/storage integration and Timofey media pack. |

Completeness Score: 28 / 100

Documentation Score: 55 / 100

Risk Level: High

Recommendations:

- Implement a concrete MediaRepository for MVP data.
- Define media event contracts and fallback metrics.
- Remove media paths from UI and older catalog documents as active source-of-truth examples.

## Recipe Runtime

| Area | Verification |
|---|---|
| Purpose | Convert a valid configuration into a machine-independent preparation recipe. |
| Responsibilities | Validate recipe compatibility and return ingredient quantities for base, syrup, topping and extras. |
| Boundaries | Does not select product, calculate price, accept payment, send hardware commands or render UI. |
| Public Interfaces | `RecipeEngine`, `RecipeService`, `RecipeRepository`, `RecipeEntity`, `RecipeReference`. |
| Lifecycle | Valid configuration is checked against active recipe definition and built into a Recipe Entity. |
| Events | `RecipeCalculated` is documented in Event Platform; runtime does not publish it. |
| Business Rules | Ingredient quantities and compatibility checks exist for the MVP vanilla cup flow. |
| State Model | In-memory recipe definitions with status and version exist. |
| Failure Scenarios | Missing or incompatible recipe definitions return validation errors and throw `RecipeValidationError` in build flow. |
| Monitoring | No recipe monitoring exists. |
| Audit | No recipe calculation audit exists. |
| Acceptance Criteria | Machine-independent recipe contract is approved and consumed by Order/Machine handoff. |
| Future Roadmap | Machine profiles, hardware command mapping, inventory constraints and recipe version migration. |

Completeness Score: 72 / 100

Documentation Score: 48 / 100

Risk Level: Medium

Recommendations:

- Expand `docs/architecture/RECIPE_ENGINE.md`; it is much thinner than the implemented runtime.
- Add event contract and audit requirements for recipe calculation.
- Define the boundary from Recipe Runtime to Machine Runtime.

## Pricing Runtime

| Area | Verification |
|---|---|
| Purpose | Calculate the financial pricing model for a configured product before wallet/payment. |
| Responsibilities | Validate product, configuration and recipe consistency; calculate base price, final price, bonus allowance and bonus limit. |
| Boundaries | Does not collect payment, mutate wallet, redeem bonuses, send notifications or operate machines. |
| Public Interfaces | `PricingEngine`, `PricingService.calculatePricing`, `PricingRepository`, `PricingEntity`. |
| Lifecycle | Pricing input is validated, pricing rule is read and Pricing Entity is returned. Persisted pricing result lifecycle is not implemented. |
| Events | `PriceCalculated` is documented in Event Platform and Order Platform; runtime does not publish it. |
| Business Rules | MVP base price 130 RUB, included syrup/topping and 80 percent bonus limit exist. |
| State Model | Repository-backed in-memory rules with status, currency, price model ID and bonus rule exist. |
| Failure Scenarios | Invalid input, inactive product, mismatches and missing/inactive pricing rule produce explicit validation errors. |
| Monitoring | No pricing monitoring or discrepancy metrics exist. |
| Audit | No pricing calculation audit or pricing rule version audit exists beyond returned data. |
| Acceptance Criteria | Checkout and Order consume Pricing Result; discount/payment never recalculate price. |
| Future Roadmap | Discounts, promotions, tax rules, regional pricing, franchise pricing, channel pricing and API-backed rule engine. |

Completeness Score: 73 / 100

Documentation Score: 68 / 100

Risk Level: Medium

Recommendations:

- Add durable Pricing Result contract with pricing rule version.
- Add pricing event publication and audit fields.
- Reconcile older docs that still describe product price as catalog-owned.

## Finance Runtime

| Area | Verification |
|---|---|
| Purpose | Own financial state, settlement, wallet, bonus, discount, ledger and accounting boundaries. |
| Responsibilities | Keep money, bonus rights, discounts, payment settlement, ledger facts and accounting export separated. |
| Boundaries | Must not own catalog, configuration, recipe, order business state, machine commands or UI. |
| Public Interfaces | Architecture docs define commands/events; runtime interfaces are not yet implemented as a Finance Platform module. |
| Lifecycle | Subdomain lifecycles are documented for Wallet, Bonus, Discount and Payment. Composite Finance lifecycle is not implemented. |
| Events | Finance events are documented across Event Platform, Wallet, Payment, Bonus, Discount and Accounting docs. Runtime publication is absent. |
| Business Rules | Strong documentation: bonus is not money, discount is not wallet balance, Ledger is source of truth. |
| State Model | Ledger, transaction, wallet, payment and accounting models are documented. Runtime state is incomplete. |
| Failure Scenarios | Payment, wallet, accounting and refund failure scenarios are well documented. Composite recovery orchestration is not implemented. |
| Monitoring | Monitoring expectations exist in subdomain docs but no runtime monitoring exists. |
| Audit | Finance audit principles are strong in docs, especially Ledger and Accounting. Runtime audit storage is not implemented. |
| Acceptance Criteria | Implement Transaction, Ledger, Wallet, Payment and Accounting contracts before real settlement. |
| Future Roadmap | Full Finance Platform implementation, provider integration, wallet projection, bonus/discount engines and accounting export. |

Completeness Score: 30 / 100

Documentation Score: 82 / 100

Risk Level: High

Recommendations:

- Treat Finance Runtime as architecture-complete but implementation-early.
- Implement Transaction and Ledger before Wallet, Payment and Accounting side effects.
- Add a single Finance Platform index document or fill `FINANCE_PLATFORM.md`.

## Ledger Runtime

| Area | Verification |
|---|---|
| Purpose | Immutable journal of financial operations. |
| Responsibilities | Preserve append-only financial facts and support reconstruction of finance state. |
| Boundaries | Does not mutate Wallet, Bonus, UI, pricing or payment provider state. |
| Public Interfaces | Ledger entry model and operation types are documented; runtime module is not implemented. |
| Lifecycle | Append-only entry lifecycle is implied but not fully modeled. |
| Events | `LedgerEntryRecorded` is documented. No runtime publication exists. |
| Business Rules | Existing entries are never changed or deleted; corrections are new operations. |
| State Model | Minimal Ledger Entry fields are documented. |
| Failure Scenarios | Failure handling, idempotency and reconciliation are not detailed enough in Ledger-specific docs. |
| Monitoring | Missing Ledger monitoring and mismatch alerts. |
| Audit | Ledger itself is the financial audit source, but audit access and retention are not implemented. |
| Acceptance Criteria | Append-only storage, idempotent writes, replay support, event publication and reconciliation rules. |
| Future Roadmap | Backend persistence, transaction integration, wallet projection replay and accounting export. |

Completeness Score: 18 / 100

Documentation Score: 48 / 100

Risk Level: High

Recommendations:

- Expand Ledger architecture to match Wallet, Payment and Accounting depth.
- Implement Ledger before allowing real payment settlement.
- Define Ledger operation contracts and replay guarantees.

## Wallet Runtime

| Area | Verification |
|---|---|
| Purpose | Expose current internal balance as a projection over Ledger. |
| Responsibilities | Create, reserve, release, capture, refund, freeze, unfreeze, close and rebuild wallet projections. |
| Boundaries | Does not calculate prices, discounts or bonuses; does not call payment providers; does not perform accounting. |
| Public Interfaces | Commands, queries and events are documented. Runtime module is not implemented. |
| Lifecycle | Wallet lifecycle is documented: not_created, created, active, frozen, closed, archived. Reservation lifecycle is documented. |
| Events | Wallet event catalog is documented, including `WalletBalanceChanged`. Runtime does not publish events. |
| Business Rules | Ledger wins, wallet is a projection, balances cannot go negative, bonus is not cash. |
| State Model | Wallet projection model is documented with balances, currency, version and source ledger position. |
| Failure Scenarios | Projection lag, mismatched currency, failed releases, refunds and freezes are partly covered. |
| Monitoring | Projection lag and Ledger conflicts are named, but monitoring implementation does not exist. |
| Audit | Operator actions and wallet-sensitive commands require audit in docs. Runtime audit is absent. |
| Acceptance Criteria | Requires Transaction, Ledger, Wallet contracts, idempotency, replay and test coverage. |
| Future Roadmap | Multi-wallet, multi-currency, CRM/support reads and accounting reconciliation. |

Completeness Score: 18 / 100

Documentation Score: 84 / 100

Risk Level: High

Recommendations:

- Implement Wallet only after Ledger append-only guarantees are in place.
- Add contract tests for reserve, release, capture and replay.
- Keep wallet display read-only until projections are reliable.

## Bonus Runtime

| Area | Verification |
|---|---|
| Purpose | Manage non-monetary bonus rights. |
| Responsibilities | Accrual, activation, reservation, redemption, release, expiration and cancellation of bonus rights. |
| Boundaries | Does not store cash, mutate Wallet, calculate base price, collect payment or send notifications directly. |
| Public Interfaces | Architecture and task docs define facade and events; runtime implementation is absent. |
| Lifecycle | Bonus lifecycle, expiration and reservation rules are documented. |
| Events | `BonusAccrued`, `BonusRedeemed`, `BonusExpired` and related events are documented. |
| Business Rules | 1 bonus is a right to receive a 1 RUB nominal discount; bonus is not money. |
| State Model | Bonus rights and reservation model are documented. |
| Failure Scenarios | Expiration, reservation failure, release failure and fraud controls are documented. |
| Monitoring | Fraud and value-protection monitoring are discussed but not implemented. |
| Audit | Bonus history and campaign/version traceability are documented; runtime audit is absent. |
| Acceptance Criteria | Implement Bonus Engine facade, state storage, idempotent reservations and event publication. |
| Future Roadmap | Promotion integration, CRM targeting, loyalty tiers and campaign budgets. |

Completeness Score: 16 / 100

Documentation Score: 84 / 100

Risk Level: High

Recommendations:

- Implement bonus reservations before allowing checkout bonus redemption.
- Keep bonus redemption represented as discount effect, not payment line.
- Add fraud and campaign version audit early.

## Discount Runtime

| Area | Verification |
|---|---|
| Purpose | Apply non-monetary price reductions after gross pricing and before payment. |
| Responsibilities | Calculate discount effect, stacking, priority, eligibility, coupon/campaign usage and payable amount. |
| Boundaries | Does not mutate Wallet, create bonus rights, collect payment, write Ledger directly or send notifications. |
| Public Interfaces | Discount Result and facade are documented. Runtime implementation is absent. |
| Lifecycle | Discount calculation and coupon/campaign usage states are documented. |
| Events | Discount calculation, application and fraud-review events are documented. |
| Business Rules | Discounts reduce price before payment and are not wallet balance or received money. |
| State Model | Discount lines, types, stacking and priority are documented. |
| Failure Scenarios | Ambiguous stacking, coupon reservation failure, fraud and invalid eligibility are documented. |
| Monitoring | Fraud/abuse controls are documented; runtime monitoring is absent. |
| Audit | Rule version and discount decision audit are implied but not implemented. |
| Acceptance Criteria | Implement Discount Engine before Payment if non-zero discounts or bonuses affect payable amount. |
| Future Roadmap | Promotion Engine, campaigns, membership discounts, coupons and budget caps. |

Completeness Score: 15 / 100

Documentation Score: 86 / 100

Risk Level: High

Recommendations:

- Keep MVP pricing zero-discount simple until Discount Runtime is implemented.
- Define immutable Discount Result IDs for Order and Payment.
- Add stacking tests before campaigns or coupons.

## Payment Runtime

| Area | Verification |
|---|---|
| Purpose | Execute settlement for an approved payable amount. |
| Responsibilities | Create payment attempts, handle methods, provider adapters, webhooks, idempotency, capture, cancellation and refund. |
| Boundaries | Does not calculate price, discounts, bonus rights, wallet balance, order rules or machine readiness. |
| Public Interfaces | Payment architecture defines commands/events/provider adapter; Mini App has only `PaymentService` and repository shell. |
| Lifecycle | Payment states are documented from created through completed, failed, cancelled, expired, refund and manual review. |
| Events | Payment event catalog is detailed. Runtime does not publish events. |
| Business Rules | Payment collects only accepted payable amount; provider states are translated; Ledger remains financial truth. |
| State Model | Payment aggregate, method lines and settlement plan are documented. Runtime state is not complete. |
| Failure Scenarios | Provider failure, webhook duplicates, ambiguity, refund failure and manual review are documented. |
| Monitoring | Fraud, duplicate settlement and reconciliation monitoring are documented but not implemented. |
| Audit | Payment audit and idempotency are documented; runtime audit storage is absent. |
| Acceptance Criteria | Provider adapter contract, webhook verification, Ledger mapping, idempotency and test scenarios are approved. |
| Future Roadmap | YooKassa adapter, SBP, wallet and mixed payments, refund flow and provider expansion. |

Completeness Score: 22 / 100

Documentation Score: 88 / 100

Risk Level: Critical

Recommendations:

- Do not mark MVP runtime-ready until Payment Runtime is implemented and tested end to end.
- Implement backend-side provider adapter and webhook verification; never expose secrets to frontend.
- Require Ledger-backed payment completion before machine dispatch.

## Accounting Adapter Runtime

| Area | Verification |
|---|---|
| Purpose | Translate Ledger-backed facts for external accounting systems. |
| Responsibilities | Export/import accounting batches, preserve adapter boundaries, reconcile external acknowledgements and audit sync. |
| Boundaries | Does not calculate prices, collect payment, mutate Ledger, mutate Wallet or provide tax advice. |
| Public Interfaces | Export/import models, adapter pattern and events are documented. Runtime implementation is absent. |
| Lifecycle | Export statuses are documented: prepared, exported, acknowledged, partially_acknowledged, rejected, failed, manual_review. |
| Events | Accounting export/import/reconciliation events are documented. |
| Business Rules | Ledger is source of truth; external systems cannot rewrite platform financial history. |
| State Model | Export batch, export item and import item models are documented. |
| Failure Scenarios | Mapping errors, external rejection, technical failure, security failure and conflicts are documented. |
| Monitoring | Reconciliation outcomes are documented; runtime monitoring is absent. |
| Audit | Strong audit fields and manual action rules are documented. |
| Acceptance Criteria | Ledger runtime, export model, adapter contract, reconciliation and security review. |
| Future Roadmap | Manual file export, direct API adapters, ERP integration and BI exports. |

Completeness Score: 10 / 100

Documentation Score: 82 / 100

Risk Level: High

Recommendations:

- Keep Accounting Adapter out of MVP purchase critical path unless legally required.
- Implement only after Ledger operation types are stable.
- Preserve file export fallback even when API integration is added.

## Order Runtime

| Area | Verification |
|---|---|
| Purpose | Own the business purchase aggregate and historical purchase truth. |
| Responsibilities | Store snapshots, validate lifecycle transitions, bind payment/fulfillment, publish business events and preserve audit. |
| Boundaries | Does not calculate configuration, price, discounts, bonus balance, payment settlement, Ledger facts, machine commands or notifications. |
| Public Interfaces | Order architecture and task docs are extensive. Mini App has only `OrderService` and repository shell. |
| Lifecycle | Full state machine is documented from Draft to Completed, Cancelled, Refunded and Expired. |
| Events | Canonical Order event catalog is documented with one event per accepted transition. Runtime event publication is absent. |
| Business Rules | Order owns immutable snapshots and never recalculates historical prices. Only paid orders can enter fulfillment. |
| State Model | Aggregate, order item, snapshots, payment binding and fulfillment models are documented. Runtime entity is not implemented. |
| Failure Scenarios | Payment ambiguity, cancellation, refund, machine failure, retries and invalid transitions are documented. |
| Monitoring | Stuck states and fulfillment failures are described in task docs; runtime monitoring is absent. |
| Audit | Strong audit requirements exist for transitions, refunds, dispatch and support actions. Runtime audit is absent. |
| Acceptance Criteria | Implement aggregate, repository, state machine, snapshot contracts, idempotency and event publication. |
| Future Roadmap | Checkout orchestration, fulfillment, cancellation, refund, dispatch and support workflow implementation. |

Completeness Score: 24 / 100

Documentation Score: 92 / 100

Risk Level: Critical

Recommendations:

- Implement Order Runtime before real payment-to-machine flows.
- Start with immutable snapshots and strict transition validation.
- Require Order events to flow through Event Runtime rather than direct service calls.

## Event Runtime

| Area | Verification |
|---|---|
| Purpose | Record, name, publish, store and consume platform events. |
| Responsibilities | Validate event envelopes, route events, preserve correlation/causation, support retries, replay and dead-letter handling. |
| Boundaries | Events are facts, not commands. Event Runtime does not own domain business rules or replace Finance Ledger. |
| Public Interfaces | Event envelope, naming, versioning and delivery model are documented. Runtime bus is not implemented. |
| Lifecycle | Event creation, delivery, retry, dead-letter and replay are documented conceptually. |
| Events | Initial event catalog exists for Product, Order, Finance, Machine, CRM, Notification, AI and Analytics. |
| Business Rules | At-least-once delivery with idempotent consumers; no global ordering assumption. |
| State Model | Event envelope and event storage requirements are documented. Storage is not implemented. |
| Failure Scenarios | Failed delivery, poison events, replay and provider event translation are documented. |
| Monitoring | Dead-letter, retry and replay monitoring are implied but not implemented. |
| Audit | Event Storage supports audit conceptually; no storage exists. |
| Acceptance Criteria | Implement in-process adapter or outbox-backed bus with versioned contracts and idempotent consumers. |
| Future Roadmap | Transactional outbox, durable event store, cloud event bus, replay and analytics/AI pipelines. |

Completeness Score: 16 / 100

Documentation Score: 82 / 100

Risk Level: Critical

Recommendations:

- Implement a minimal Event Runtime before wiring Order, Payment and Machine workflows.
- Define event contract files or schemas for the first MVP events.
- Add idempotency and replay rules to tests from the first implementation.

## Machine Runtime

| Area | Verification |
|---|---|
| Purpose | Own vending machine state, dispatch, command delivery, telemetry and preparation results. |
| Responsibilities | Machine selection, queue handling, command model, acknowledgement flow, timeout handling, retry and recovery. |
| Boundaries | Does not calculate price, collect payment, mutate Ledger or directly change Order state. |
| Public Interfaces | Machine dispatch is documented in Order task docs. Mini App has `MachineService` and repository shell. |
| Lifecycle | Dispatch, queue and fulfillment stages are documented through Order/Machine interaction. Dedicated Machine lifecycle is not fully centralized. |
| Events | Machine events are listed in Event Platform and Order dispatch docs. Runtime publication is absent. |
| Business Rules | Machine receives only confirmed paid orders; dispatch never changes financial data. |
| State Model | Machine command, operation and queue references are documented but not implemented. |
| Failure Scenarios | Timeout, acknowledgement failure, retry, duplicate commands and unavailable machine are documented. |
| Monitoring | Machine telemetry and dispatch monitoring are described but not implemented. |
| Audit | Dispatch commands, acknowledgements, timeouts and recovery must be auditable; runtime audit is absent. |
| Acceptance Criteria | Implement machine adapter boundary, operation IDs, idempotent dispatch and event feedback. |
| Future Roadmap | Hardware adapters, inventory, device telemetry, operator maintenance and multi-machine routing. |

Completeness Score: 18 / 100

Documentation Score: 70 / 100

Risk Level: Critical

Recommendations:

- Define a standalone Machine Runtime architecture file or fill the platform docs around Machine Platform.
- Implement a simulator before connecting real vending hardware.
- Require payment and order confirmation before any preparation command.

## Notification Runtime

| Area | Verification |
|---|---|
| Purpose | Send customer, operator and support communications from domain events. |
| Responsibilities | Consume business events, resolve templates/channels, send messages and publish delivery facts. |
| Boundaries | Does not own order, payment, product, customer balance or machine state. |
| Public Interfaces | Mentioned in Event, Wallet, Order and Payment docs. No dedicated Runtime interface or implementation exists. |
| Lifecycle | Notification requested/sent/failed/delivery confirmed events are named, but lifecycle is not fully specified. |
| Events | Event Platform lists Notification events. Runtime does not consume or publish them. |
| Business Rules | Notifications are side effects of domain events; failed notification must not roll back domain state. |
| State Model | No notification job, template, channel or delivery-state model exists. |
| Failure Scenarios | Delivery failure is named but retry, dead-letter, channel fallback and template failure are not fully documented. |
| Monitoring | No delivery monitoring exists. |
| Audit | Delivery correlation with original event is required in docs but not implemented. |
| Acceptance Criteria | Define Notification Engine docs, event consumers, template model, channel adapters and delivery audit. |
| Future Roadmap | Telegram, Mini App, SMS/email/push, operator alerts, support notifications and campaign messages. |

Completeness Score: 6 / 100

Documentation Score: 34 / 100

Risk Level: High

Recommendations:

- Create `docs/architecture/NOTIFICATION_ENGINE.md` before implementation.
- Implement minimal payment/order status notifications after Event Runtime exists.
- Keep message templates out of event contracts.

## Customer and CRM Runtime

| Area | Verification |
|---|---|
| Purpose | Maintain customer identity/profile projections and operational CRM support views. |
| Responsibilities | Customer lookup, profile updates, support history, CRM projections and operator actions. |
| Boundaries | Must not become the platform source of truth for product, finance, order or machine state. |
| Public Interfaces | `CustomerService` and `CustomerRepository` shells exist. CRM is documented mainly as an event consumer. |
| Lifecycle | Customer profile and Club join events are listed; profile lifecycle is not fully documented. |
| Events | `CustomerCreated`, `CustomerProfileUpdated`, `ClubJoined` and support events are listed. Runtime publication is absent. |
| Business Rules | CRM consumes event contracts and builds projections; operator actions require audit. |
| State Model | No Customer Entity or CRM projection model is implemented. |
| Failure Scenarios | Privacy, consent, duplicate identity and support failure scenarios are incomplete. |
| Monitoring | No CRM projection monitoring exists. |
| Audit | Operator action audit is required in Event and Wallet docs but not implemented. |
| Acceptance Criteria | Define customer identity model, consent linkage, CRM projection contracts and operator audit. |
| Future Roadmap | Club Timofey, support cases, segmentation, loyalty journeys and customer history. |

Completeness Score: 18 / 100

Documentation Score: 46 / 100

Risk Level: High

Recommendations:

- Keep CRM downstream from Event Runtime.
- Define Customer Entity and privacy/consent boundaries before CRM workflows.
- Do not let CRM write wallet/order facts directly.

## Analytics Runtime

| Area | Verification |
|---|---|
| Purpose | Record product and customer behavior signals for reporting and future decisions. |
| Responsibilities | Track events, build reports, consume formal domain events and support projections. |
| Boundaries | Analytics does not replace domain events and must not drive financial/order truth. |
| Public Interfaces | Mini App has `trackEvent` local console logging. Event Platform describes future analytics consumption. |
| Lifecycle | No analytics runtime lifecycle exists. |
| Events | UI analytics events exist locally; formal platform analytics events are listed in Event Platform. |
| Business Rules | Analytics may consume formal events but is not a substitute for domain events. |
| State Model | No analytics storage or projection model exists. |
| Failure Scenarios | Local logging failure is not material; backend delivery, dedupe and replay are not implemented. |
| Monitoring | No analytics pipeline monitoring exists. |
| Audit | Analytics audit is not implemented. |
| Acceptance Criteria | Define analytics transport, projection storage and distinction between UI analytics and domain events. |
| Future Roadmap | Product funnel, sales analytics, machine performance, CRM reporting and AI training signals. |

Completeness Score: 20 / 100

Documentation Score: 42 / 100

Risk Level: Medium

Recommendations:

- Keep existing local tracking as MVP diagnostic only.
- Build analytics from Event Runtime rather than screen-only events.
- Define privacy and retention before customer analytics expands.

## AI Runtime

| Area | Verification |
|---|---|
| Purpose | Future recommendations, demand forecasting, inventory AI, marketing AI and conversation AI. |
| Responsibilities | Consume historical events, generate traceable predictions/recommendations and publish AI facts. |
| Boundaries | AI must not silently override product, price, payment, order, finance or machine rules. |
| Public Interfaces | Only roadmap and event names exist. No runtime interface exists. |
| Lifecycle | Not defined. |
| Events | `AiRecommendationRequested`, `AiRecommendationGenerated` and `DemandForecastCalculated` are listed. |
| Business Rules | AI output must be traceable to model version and source events according to Event Platform principles. |
| State Model | No model registry, feature store, training set, inference request or output model exists. |
| Failure Scenarios | Not defined. |
| Monitoring | No model monitoring exists. |
| Audit | No AI decision audit exists. |
| Acceptance Criteria | Not required for MVP; future work needs model/version/source-event audit. |
| Future Roadmap | Recommendations, demand forecasting, inventory optimization, marketing automation and conversation AI. |

Completeness Score: 0 / 100

Documentation Score: 28 / 100

Risk Level: Low for MVP, High for roadmap

Recommendations:

- Keep AI out of MVP runtime readiness.
- Build AI only after Event Runtime has durable, privacy-compliant data.
- Require explainability, model versioning and rollback for AI outputs.

## Overall Runtime Readiness

Overall Runtime Readiness: 34 / 100

Interpretation:

- Product Engine foundations are partially implemented.
- Commercial MVP runtime is not ready because Payment, Order, Event, Machine and Notification are not operational.
- Finance and Order architecture are mature enough to guide implementation.
- Platform Core and contracts must be filled before multi-runtime integration grows.

MVP-critical missing runtime path:

```text
Configuration -> Recipe -> Pricing -> Order -> Payment -> Ledger -> Event -> Machine -> Notification
```

Current strongest implemented path:

```text
Catalog -> Configuration -> Recipe -> Pricing
```

Current weakest MVP-critical path:

```text
Order -> Payment -> Ledger -> Event -> Machine -> Notification
```

## Architecture Readiness

Architecture Readiness: 76 / 100

Rationale:

- Architecture Baseline 1.0 is coherent.
- Order, Payment, Wallet, Bonus, Discount, Accounting and Event documents are detailed.
- Runtime boundaries are mostly clear.
- Placeholder Platform Core documents reduce architecture completeness.
- Some older Product Catalog and Media docs still conflict with newer Price/Media separation rules.
- Runtime contracts are described in prose but not yet normalized as formal schemas/files.

## Exit Criteria

Runtime Completeness Audit exit criteria:

- `docs/releases/RUNTIME_COMPLETENESS_AUDIT.md` exists and contains this audit.
- Every Runtime listed in scope has purpose, responsibilities, boundaries, public interfaces, lifecycle, events, business rules, state model, failure scenarios, monitoring, audit, acceptance criteria and future roadmap evaluated.
- Every Runtime has Completeness Score, Documentation Score, Risk Level and Recommendations.
- Overall Runtime Readiness and Architecture Readiness are recorded.
- Only documentation files are changed.
- No application code, frontend code, backend code, UI code, runtime configuration or generated build output is modified.

Commercial MVP runtime exit criteria:

- Catalog, Configuration, Media, Recipe and Pricing are fully wired into the purchase flow.
- Order Runtime stores immutable snapshots and enforces state transitions.
- Payment Runtime performs provider-backed settlement through backend-side adapters.
- Ledger Runtime records immutable financial facts.
- Event Runtime publishes and stores core Order, Payment, Ledger and Machine facts.
- Machine Runtime accepts only paid orders and supports idempotent dispatch.
- Notification Runtime informs customers and operators from domain events.
- Monitoring exists for payment ambiguity, stuck orders, failed dispatch, event dead letters and notification failures.
- Audit trails exist for payment, refund, order state, machine dispatch and operator actions.
- Build and test scenarios pass for the runtime release.

## Future Improvements

1. Fill Platform Core placeholders:
   - `docs/architecture/PLATFORM_KERNEL.md`;
   - `docs/architecture/PLATFORM_CONTRACTS.md`;
   - `docs/architecture/PLATFORM_CAPABILITIES.md`;
   - `docs/architecture/FINANCE_PLATFORM.md`.
2. Normalize runtime contracts into versioned command, query and event schemas.
3. Retire legacy Mini App catalog usage and route UI through Product Engine services.
4. Implement Media Runtime before product preview or composed images become product-critical.
5. Implement Ledger before Payment completion is treated as business truth.
6. Implement a minimal Event Runtime with idempotency and replay strategy before connecting Order, Payment and Machine.
7. Implement Order Runtime state machine before real payment and machine fulfillment.
8. Add a Machine simulator and dispatch contract tests before hardware integration.
9. Create dedicated Notification Engine architecture before customer-facing payment and fulfillment messages.
10. Reconcile runtime package versions with release records before a runtime tag.

## Final Report

### Changed files

- `docs/releases/RUNTIME_COMPLETENESS_AUDIT.md`
- `CHANGELOG.md`
- `ENGINEERING_JOURNAL.md`

### Runtime scores

| Runtime | Completeness | Documentation | Risk |
|---|---:|---:|---|
| Platform Runtime | 24 | 38 | High |
| Catalog Runtime | 64 | 58 | Medium |
| Configuration Runtime | 74 | 72 | Medium |
| Media Runtime | 28 | 55 | High |
| Recipe Runtime | 72 | 48 | Medium |
| Pricing Runtime | 73 | 68 | Medium |
| Finance Runtime | 30 | 82 | High |
| Ledger Runtime | 18 | 48 | High |
| Wallet Runtime | 18 | 84 | High |
| Bonus Runtime | 16 | 84 | High |
| Discount Runtime | 15 | 86 | High |
| Payment Runtime | 22 | 88 | Critical |
| Accounting Adapter Runtime | 10 | 82 | High |
| Order Runtime | 24 | 92 | Critical |
| Event Runtime | 16 | 82 | Critical |
| Machine Runtime | 18 | 70 | Critical |
| Notification Runtime | 6 | 34 | High |
| Customer and CRM Runtime | 18 | 46 | High |
| Analytics Runtime | 20 | 42 | Medium |
| AI Runtime | 0 | 28 | Low for MVP, High for roadmap |

### Overall readiness

Overall Runtime Readiness: 34 / 100

Architecture Readiness: 76 / 100

Status: architecture-guided, not MVP-runtime-ready.

### Recommendations

Highest-priority recommendations:

1. Fill Platform Core and Platform Contracts before broad integration.
2. Wire Mini App purchase flow fully through Catalog, Configuration, Media, Recipe and Pricing services.
3. Implement Order Runtime with immutable snapshots and strict state machine.
4. Implement Ledger and Payment Runtime before any real settlement or machine dispatch.
5. Implement minimal Event Runtime for Order, Payment, Ledger and Machine facts.
6. Implement Machine simulator and idempotent dispatch before real hardware.
7. Add Notification Runtime architecture and event-driven status messages.

### Confirm no application code modified

Confirmed for this documentation-only task: no application code, frontend code, backend code, Telegram bot code, UI code, infrastructure runtime config or generated build output is intentionally modified by this audit.
