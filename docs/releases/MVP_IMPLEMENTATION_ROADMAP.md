# MVP Implementation Roadmap

Document code: RELEASE-MVP-IMPLEMENTATION-ROADMAP-001
Task: EPIC-204 / PLAN-001
Status: Draft
Version: 0.1
Date: 2026-07-10
Project: Soft ICE Platform / Utimoshi
Scope: Documentation only. No application code changes.

Related documents:

- `docs/releases/MVP_LAUNCH_READINESS.md`
- `docs/product/MINI_APP_MVP_SPEC.md`
- `docs/product/LANDING_SPEC.md`
- `docs/product/TELEGRAM_BOT_FLOW.md`
- `docs/domain/CUSTOMER_DOMAIN.md`
- `docs/domain/CLUB_ACCOUNT.md`
- `docs/domain/BONUS_DOMAIN.md`
- `docs/domain/CONSENT_MODEL.md`
- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/domain/MACHINE_DOMAIN.md`
- `docs/domain/PRODUCT_CATALOG.md`
- `docs/domain/SYRUP_CATALOG.md`
- `docs/domain/TOPPING_CATALOG.md`
- `docs/domain/PRODUCT_IMAGE_MODEL.md`
- `docs/domain/MEDIA_LIBRARY_STRUCTURE.md`
- `docs/domain/RECIPE_MODEL.md`
- `docs/domain/ANALYTICS_EVENTS.md`
- `docs/data/PLATFORM_DATA_MODEL.md`
- `docs/architecture/PROJECT_DECISIONS.md`

---

# 1. MVP Goal

The first production milestone is:

```text
One machine.
One product.
Real customer.
Real payment.
Real loyalty.
```

The MVP launch is successful when one real customer can open the Telegram Bot, enter the Mini App, authenticate through Telegram, select one approved soft ice cream product, pay through the approved provider-backed payment flow, receive the product from one registered vending machine and leave complete platform records for customer, order, payment, machine operation and loyalty state.

The launch is intentionally narrow. It is not the first version of the full platform; it is the first safe production slice of the commercial path:

```text
Telegram entry
-> Mini App authentication
-> customer_id
-> one approved product
-> order with snapshots
-> YooKassa/SBP-backed payment confirmation
-> paid-only machine dispatch
-> machine event outcome
-> customer status and support trace
-> loyalty account/projection update
```

## Launch Definition

| Dimension | MVP launch choice |
|---|---|
| Machine | One physical vending machine with stable `machine_id`, approved location, verified capability profile and fresh readiness state. |
| Product | One approved product, preferably `product_soft_ice_vanilla_cup`, with one approved launch configuration. |
| Customer | One real customer resolved to canonical `customer_id` through Telegram identity verification. |
| Payment | One real provider-backed payment flow through YooKassa, with SBP enabled when provider/account setup supports it. |
| Loyalty | Real Club Timofey customer state with consent, profile/identity binding and Bonus or loyalty projection records. Advanced campaigns are post-MVP. |
| Fulfillment | Machine preparation starts only after platform payment completion is accepted and the Order Runtime permits fulfillment. |

## MVP Loyalty Meaning

For the first launch, "real loyalty" means the customer is not anonymous after purchase and the platform records a real loyalty relationship.

Minimum loyalty scope:

- verified `customer_id`;
- accepted required consent evidence, including loyalty terms when Club Timofey is activated;
- visible customer profile summary in Mini App;
- Club Timofey or loyalty participation status;
- Bonus Account or loyalty projection for the customer;
- first-purchase loyalty fact recorded, even if bonus redemption is not active yet;
- customer-facing separation between money balance, bonuses and discounts.

Not required for the first launch:

- full prepaid Club Account as a payment method;
- saved payment methods;
- auto top-up;
- referral rewards;
- birthday, trusted customer or seasonal campaigns;
- bonus redemption during checkout unless fully implemented and tested.

---

# 2. Implementation Phases

## Phase 1: Infrastructure

Goal: create the production-capable technical base for one real machine and one real payment path.

Required implementation:

- server runtime for backend API, webhooks and machine adapter communication;
- persistent database for customer, consent, order, payment, machine, loyalty, audit and idempotency records;
- environment separation for local, staging and production;
- secret management for database, Telegram, YooKassa and machine adapter credentials;
- deployment process with repeatable build, release and rollback steps;
- health checks, logging, monitoring and operational alerts;
- database backup and restore procedure;
- deployment inventory for Bot, Mini App, backend and machine adapter endpoints.

Exit criteria:

- staging and production environments exist and are distinguishable;
- secrets are outside the repository and frontend bundles;
- backend health endpoint proves runtime and database connectivity;
- webhook endpoints can be reached by provider/channel configuration;
- deployment can be repeated from GitHub source without committing generated build output;
- operator can see whether backend, database, payment webhook and machine adapter are healthy.

## Phase 2: Customer

Goal: turn Telegram entry into a verified platform customer with minimal profile and loyalty state.

Required implementation:

- Telegram Bot `/start` and Mini App launch handoff;
- Telegram WebApp `initData` collection in Mini App;
- backend verification of Telegram signature and `auth_date` freshness;
- canonical `customer_id` resolution or creation;
- Telegram user ID stored as external identity alias, not platform identity;
- profile read/update for allowed fields;
- consent grant/deny/revoke records for personal data, transactional communications and loyalty terms where used;
- customer-safe session/token lifecycle for Mini App API calls;
- minimal Club Timofey or loyalty status;
- Bonus Account or loyalty projection creation after prerequisites pass.

Exit criteria:

- a first-time Telegram user becomes one platform customer;
- returning Telegram user resolves to the same `customer_id`;
- customer can view their own profile and loyalty state only;
- raw Telegram init data and tokens are not stored in general domain records or logs;
- identity conflicts go to support/manual review instead of silent relinking.

## Phase 3: Payments

Goal: accept a real payment safely and record enough facts for support, refund and reconciliation.

Required implementation:

- provider-agnostic Payment Runtime contracts;
- YooKassa provider adapter using environment variables;
- SBP-capable payment confirmation path where YooKassa account settings support it;
- payment intent and limited-lifetime payment session creation;
- customer-facing confirmation surface: SBP link, QR, provider link or redirect;
- webhook verification and deduplication;
- provider status polling fallback;
- platform payment status mapping;
- Payment Operations Registry records for intent, session, confirmation, completion, failure, cancellation and expiration;
- payment binding to order;
- full refund command and support workflow for "paid but not delivered";
- minimum reconciliation view or export comparing provider and platform facts.

Exit criteria:

- payment success is accepted only from verified webhook, provider polling or approved internal settlement fact;
- QR scan, link open, client timer or UI callback cannot mark an order paid;
- each payment has `payment_id`, provider reference and operation history;
- failed, cancelled and expired payments never dispatch to machine;
- support can find payment by customer, order, provider reference and payment ID;
- at least full refund is executable or manually operable with audit before launch.

## Phase 4: Machine

Goal: register one machine and execute paid fulfillment through authenticated, auditable machine events.

Required implementation:

- one stable `machine_id`;
- machine passport completion for the production unit;
- verified machine capability profile for the launch product;
- approved machine configuration version;
- machine inventory records for mix, cups, syrup and topping used by the launch product;
- machine readiness policy using connectivity, telemetry freshness, inventory and maintenance state;
- machine adapter authentication;
- dispatch queue that accepts paid orders only;
- idempotent `PrepareProduct` command delivery;
- acknowledgement, timeout, retry and recovery policy;
- machine events for accepted, preparation started, failed, dispensed/completed and telemetry reported;
- operator incident path for offline, blocked, failed, ambiguous dispensing and product-not-taken cases.

Exit criteria:

- platform can block sales when the machine is not ready;
- machine cannot receive unpaid order commands;
- command delivery and machine outcomes are traceable by `machine_operation_id`;
- duplicate or timed-out commands require reconciliation before another physical side effect;
- inventory threshold behavior is documented and implemented for the launch product;
- operator can recover or escalate machine incidents.

## Phase 5: Mini App

Goal: connect the customer-facing Telegram Mini App to backend APIs for the complete launch path.

Required implementation:

- Telegram WebApp initialization and backend authentication exchange;
- Home screen with customer, purchase and loyalty entry points;
- one-product catalog/product screen reading backend or approved service data;
- checkout confirmation using backend pricing/order result;
- payment confirmation screen with pending, success, failed, cancelled and expired states;
- order preparation, completed and failed/recovery states;
- profile and consent screen;
- loyalty state screen or Home projection;
- purchase detail/history for the launch order;
- support handoff with safe order, payment and machine references;
- API integration for customer, order, payment, machine status/projection and loyalty state.

Exit criteria:

- Mini App never calculates final price, payment success or machine fulfillment locally;
- Mini App never chooses product media outside approved media/service contracts;
- customer can complete the full launch flow without CRM/admin access;
- all customer-visible errors offer retry, safe status or support;
- customer cannot access another customer's profile, order, payment or loyalty state.

## Phase 6: Testing

Goal: prove the full production slice before opening real customer access.

Required implementation:

- customer test for first-time and returning Telegram users;
- payment test for completed, failed, cancelled, expired and late-confirmed payments;
- refund test for paid-but-not-delivered scenario;
- machine simulator test before real hardware;
- real machine test with approved low-risk product/configuration;
- inventory readiness test;
- telemetry stale/offline test;
- paid-only dispatch test;
- Mini App regression and console-error check;
- support trace test from customer through order, payment and machine operation;
- launch go/no-go checklist.

Exit criteria:

- at least one full real-provider payment flow completes in staging or approved production low-value mode;
- at least one full real-machine preparation completes from paid order to completion event;
- failed payment does not dispense;
- machine failure does not silently mark order completed;
- refund/support process is proven with audit trail;
- Product Owner approves launch constraints and remaining known risks.

---

# 3. Priority Table

| Task | Domain | Priority | Dependency | Status |
|---|---|---|---|---|
| Provision production server runtime | Infrastructure | P0 | Deployment target and DNS | Planned |
| Add persistent production database | Data Platform | P0 | Infrastructure environment | Planned |
| Define environment and secret management | Infrastructure / Security | P0 | YooKassa, Telegram, database and machine credentials | Planned |
| Add deployment, health and rollback process | Infrastructure | P0 | Server runtime | Planned |
| Add backup and restore procedure | Data Platform | P0 | Production database | Planned |
| Implement Telegram Bot entry and Mini App launch | Bot / Customer | P0 | Telegram bot configuration | Planned |
| Verify Telegram Mini App `initData` server-side | Authentication / Customer | P0 | Bot secret and auth endpoint | Planned |
| Resolve or create canonical `customer_id` | Customer | P0 | Telegram identity verification | Planned |
| Store consent evidence and profile fields | Customer / Consent | P0 | `customer_id` | Planned |
| Create minimal Club Timofey / loyalty state | Customer / Loyalty | P0 | Customer and consent records | Planned |
| Create Bonus Account or loyalty projection | Bonus / Loyalty | P0 | Loyalty state | Planned |
| Approve one launch product and configuration | Product / Recipe | P0 | Product catalog, recipe and machine capability | Planned |
| Create order with immutable snapshots | Order | P0 | Customer, product, pricing and checkout contracts | Planned |
| Bind order to payment intent | Order / Payment | P0 | Order creation | Planned |
| Implement YooKassa provider adapter | Payment | P0 | Environment secrets and Payment Runtime contracts | Planned |
| Implement SBP-capable confirmation path | Payment | P0 | YooKassa account/provider configuration | Planned |
| Verify and deduplicate payment webhooks | Payment | P0 | YooKassa adapter | Planned |
| Add payment polling fallback | Payment | P1 | Provider adapter | Planned |
| Record Payment Operations Registry facts | Payment / Finance | P0 | Payment Runtime | Planned |
| Implement full refund workflow | Payment / Support | P0 | Completed payment and support audit | Planned |
| Register one physical machine | Machine | P0 | Machine passport and production location | Planned |
| Approve machine capability and configuration | Machine / Recipe | P0 | Launch product and hardware verification | Planned |
| Track launch inventory and readiness | Machine | P0 | Machine registration and inventory model | Planned |
| Ingest machine events and telemetry | Machine / Event | P0 | Machine adapter authentication | Planned |
| Dispatch only paid orders to machine | Order / Machine | P0 | Payment confirmation and machine readiness | Planned |
| Implement Mini App authentication and session | Mini App / Authentication | P0 | Customer authentication endpoint | Planned |
| Connect Mini App product and checkout screens to APIs | Mini App / Order | P0 | Catalog, checkout and order APIs | Planned |
| Connect Mini App payment and status screens to APIs | Mini App / Payment | P0 | Payment APIs and projections | Planned |
| Add Mini App profile, loyalty and support surfaces | Mini App / Customer | P1 | Customer, loyalty and support projections | Planned |
| Run customer identity test | Testing | P0 | Customer phase complete | Planned |
| Run payment success/failure/refund tests | Testing | P0 | Payment phase complete | Planned |
| Run machine simulator and real-machine tests | Testing | P0 | Machine phase complete | Planned |
| Run launch go/no-go checklist | Release | P0 | All P0 tests complete | Planned |

Priority legend:

| Priority | Meaning |
|---|---|
| P0 | Required before first production launch. |
| P1 | Strong launch hardening; can be simplified only with Product Owner approval and explicit risk acceptance. |
| P2 | Post-MVP backlog unless it becomes required by legal, provider, support or machine constraints. |

---

# 4. Release Criteria

The first production launch must not start until all criteria below are true.

## Infrastructure Criteria

- production backend is deployed from GitHub source;
- database persists customer, consent, order, payment, machine, loyalty, audit and idempotency records;
- secrets are configured outside repository files;
- health checks exist for backend, database, payment webhook and machine adapter;
- logs and alerts are sufficient for first-line incident response;
- backup and restore process is documented and tested at least once.

## Customer Criteria

- Telegram Bot opens the Mini App;
- Mini App sends Telegram WebApp `initData` to backend;
- backend verifies Telegram data server-side;
- customer resolves to canonical `customer_id`;
- customer can view/update allowed profile fields;
- required consent evidence is stored and auditable;
- customer can see their own loyalty state and cannot see another customer's data.

## Product and Order Criteria

- one launch product and one launch configuration are approved;
- product, configuration, recipe, price and media data come from approved data/service boundaries;
- order creation stores immutable product, configuration, recipe and price snapshots;
- order state machine blocks fulfillment before accepted payment;
- order progress and recovery states are visible to customer/support.

## Payment Criteria

- YooKassa provider adapter is configured through environment variables;
- SBP or the selected provider confirmation surface is tested end to end;
- payment session has explicit expiration;
- webhook verification and deduplication are implemented;
- polling fallback exists for unresolved provider status;
- payment completion is accepted only by Payment Runtime;
- each payment has operation records and provider correlation reference;
- failed, cancelled and expired payments do not dispatch to machine;
- full refund path exists for paid-but-not-delivered incidents.

## Machine Criteria

- one physical machine is registered with stable `machine_id`;
- machine passport and capability profile are approved for the launch product;
- machine inventory is tracked for all launch consumables;
- readiness policy blocks dispatch when offline, stale, empty, unsafe or under maintenance;
- paid-only dispatch queue and idempotent command path exist;
- machine reports accepted, started, failed, dispensed/completed and telemetry events;
- support can trace machine command and outcome by order/payment/customer references.

## Mini App Criteria

- customer can authenticate, select product, confirm checkout, pay and see order outcome;
- payment pending, success, failure, cancellation and expiration states are explicit;
- preparation, completed and failed/recovery states are explicit;
- support handoff includes safe references;
- no known JavaScript console errors are introduced in the launch flow;
- UI does not hardcode business prices, media paths, payment outcomes or fulfillment decisions.

## Loyalty Criteria

- customer has real loyalty identity after the purchase;
- Club Timofey or loyalty status is persisted and visible;
- Bonus Account or loyalty projection exists for the customer;
- first-purchase loyalty fact is recorded or the Product Owner explicitly approves a read-only first launch loyalty state;
- money balance, bonuses and discounts are separated in UI and records;
- no customer-facing copy promises bonus redemption, prepaid balance or campaigns that are not implemented.

## Testing Criteria

- customer identity test passes for first-time and returning Telegram user;
- successful payment test passes;
- failed/cancelled/expired payment tests pass;
- refund/support test passes for paid-but-not-delivered scenario;
- machine simulator test passes;
- real machine paid-order test passes;
- paid-only dispatch negative test passes;
- stale telemetry/offline machine test passes;
- launch go/no-go checklist is approved by the Product Owner.

---

# 5. Post-MVP Backlog

The following features are valuable, but not critical for the first controlled production launch:

- multiple products and product categories;
- multiple sizes, add-ons, bundles and multi-item orders;
- live public machine map;
- live public inventory display;
- multiple machines and automatic routing;
- alternate-machine fulfillment;
- full prepaid Club Account as a checkout payment method;
- Club Account top-up recommendations beyond minimum launch loyalty state;
- saved payment methods;
- one-click top-up;
- auto top-up;
- bonus redemption during checkout if not fully implemented before launch;
- referral rewards;
- birthday bonus;
- trusted customer bonus;
- seasonal campaigns and Promotion Runtime automation;
- advanced marketing notifications;
- CRM dashboard beyond minimum support lookup/export;
- advanced analytics dashboards;
- AI recommendations, demand forecasting and personalization;
- partial refunds beyond minimum launch support policy;
- accounting API integration beyond minimum internal review/export;
- landing page live availability, campaign pages and advanced animations;
- support case portal for customers;
- partner/franchise interfaces;
- multi-provider payment expansion beyond YooKassa/SBP launch path.

---

# 6. Validation

This roadmap is documentation-only.

Validation result:

- MVP goal is defined for one machine, one product, real customer, real payment and real loyalty;
- implementation phases are defined for Infrastructure, Customer, Payments, Machine, Mini App and Testing;
- priority table is included with Task, Domain, Priority, Dependency and Status columns;
- release criteria are defined for launch readiness;
- non-critical features are moved to the Post-MVP backlog;
- no application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output is changed by this document.

Build was not run because this task intentionally changes documentation only and does not modify executable application behavior.
