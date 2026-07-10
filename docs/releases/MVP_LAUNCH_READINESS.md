# MVP Launch Readiness Audit

Document code: RELEASE-MVP-LAUNCH-READINESS-001
Task: EPIC-203 / MVP-001
Status: Draft
Version: 0.1
Date: 2026-07-10
Project: Soft ICE Platform / Utimoshi
Scope: Documentation only. No application code changes.

Related documents:

- `docs/product/LANDING_SPEC.md`
- `docs/product/MINI_APP_MVP_SPEC.md`
- `docs/product/TELEGRAM_BOT_FLOW.md`
- `docs/product/MINI_APP_AUDIT.md`
- `docs/domain/CUSTOMER_DOMAIN.md`
- `docs/domain/CLUB_ACCOUNT.md`
- `docs/domain/BONUS_DOMAIN.md`
- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/domain/MACHINE_DOMAIN.md`
- `docs/data/PLATFORM_DATA_MODEL.md`
- `docs/architecture/PROJECT_DECISIONS.md`
- `docs/machine/MACHINE_PASSPORT.md`
- `docs/machine/MACHINE_STATE_MODEL.md`
- `docs/machine/MACHINE_EVENTS_TELEMETRY.md`

---

# 1. Audit Conclusion

First production launch readiness for one real ice cream vending machine:

```text
Not ready for production launch.
```

Current status:

```text
Architecture and documentation are strong enough to guide implementation.
Runtime, payment, order, machine and operations are not launch-ready yet.
```

The platform has documented the right boundaries for a safe MVP: customer identity, Mini App, Bot, Payment, Order, Machine, Bonus, Club Account, data ownership, events and audit. The missing part is executable readiness for the commercial path:

```text
Telegram entry
-> Mini App authentication
-> customer identity
-> product configuration
-> order creation
-> payment confirmation
-> ledger/payment operation recording
-> paid machine dispatch
-> machine telemetry/events
-> customer status/support/refund handling
```

The first launch must not proceed with a real customer and real machine until the must-have items in section 6 are implemented and verified.

Readiness legend:

| Status | Meaning |
|---|---|
| Ready | Documented and implemented enough for first production use. |
| Partial | Documented or partially implemented, but not sufficient alone for launch. |
| Not ready | Required for launch but not implemented, not verified or not connected. |
| Postpone | Useful later, but not required for the first controlled machine launch. |

---

# 2. Current Platform Status

## Completed Domains and Specifications

Completed as documentation or architecture:

| Area | Current status | Launch meaning |
|---|---|---|
| Landing | Specified | Public entry path is defined, but a production landing implementation is not confirmed by this audit. |
| Telegram Bot | Flow specified | Bot role, first launch, menu, consent, payment handoff and notification boundaries are defined. |
| Mini App | MVP specified and audited | Customer self-service shell is specified; current implementation remains a product-selection prototype. |
| Customer Domain | Documented | `customer_id`, Telegram identity linking, profile, consent, club status, trusted status and referral boundaries are defined. |
| Club Account | Documented | Prepaid account, top-up, spending, refund, saved method consent and audit rules are defined. |
| Bonus Domain | Documented | Bonus rights, transactions, reservations, redemption, expiration, referral and audit boundaries are defined. |
| Payment Domain | Documented | Provider-agnostic payment model, YooKassa, SBP, QR, refunds, registry and reconciliation are defined. |
| Machine Domain | Documented | Machine identity, lifecycle, configuration, capabilities, inventory, telemetry, commands, events and audit are defined. |
| Platform Data Model | Documented | Logical entity ownership, identifiers, relationships, immutable records, audit and retention direction are defined. |
| Architecture Decisions | Accepted decisions exist | Key boundaries for payment, data, machine, events, API, customer, club and bonus are recorded. |

Partially implemented runtime foundations:

| Area | Current status | Launch meaning |
|---|---|---|
| Mini App shell | Partial | React/Vite app exists with home/product flow, but not an authenticated paid vending flow. |
| Product Engine | Partial | Catalog, Configuration, Recipe and Pricing foundations exist; Media and active UI wiring remain incomplete. |
| Backend | Partial | Express/Prisma foundation exists, but documented runtime APIs are not complete. |
| Telegram bot package | Partial | Bot package exists, but the documented Bot/Mini App/Backend production flow is not complete. |
| Order, Payment, Machine, Customer repositories | Partial or shell | Runtime services/repositories exist in some areas, but critical methods are not implemented end to end. |

Current launch blocker summary:

- customer authentication and `customer_id` resolution are not implemented end to end;
- checkout and Order Runtime are not implemented end to end;
- YooKassa adapter, webhook verification and payment registry are not implemented;
- Ledger/financial recording is not production-ready;
- Machine Runtime, machine adapter, dispatch queue and real telemetry are not implemented;
- machine hardware passport still has many `Unknown` or `To be confirmed` fields;
- support, refund, manual review and operational monitoring are not production-ready.

---

# 3. Customer Journey Readiness

| Journey area | Readiness | Notes |
|---|---|---|
| Landing | Partial | The landing specification is complete enough for a static first page. It must not claim live machine availability, real-time stock or payment-in-website behavior until those systems exist. |
| Telegram Bot | Partial | Bot user flow is specified, including launch, consent, Mini App handoff, payment notifications and support. Runtime integration with backend identity, payment and notification contracts is not complete. |
| Mini App | Not ready | Current Mini App is a shell/product-selection prototype. It lacks Telegram WebApp authentication exchange, customer session, checkout, payment session, payment status and fulfillment screens. |
| Registration / profile completion | Not ready | Customer Domain documents identity and consent rules, but Mini App/Bot/backend do not yet resolve verified Telegram identity into production `customer_id` and customer session. |
| Payment | Not ready | Payment Domain is architecture-ready, but there is no production payment session creation, YooKassa adapter, webhook verification, status polling, expiration, registry or reconciliation flow. |
| Purchase | Not ready | Product selection exists as a prototype, but checkout intent, immutable Order snapshots, accepted pricing, payment binding, paid order state and machine fulfillment are missing. |
| Bonus | Postpone for launch | Bonus Domain is documented, but bonus accrual, reservation, redemption and expiration are not required for the first paid machine purchase if the launch does not promise active bonuses. Bonus messaging must remain inactive or clearly future-facing. |

Minimum customer journey required before launch:

```text
Customer scans QR or opens Bot
-> Bot opens Mini App
-> Mini App authenticates via Telegram WebApp initData
-> Backend resolves customer_id
-> Customer selects one approved product/configuration
-> Order is created with immutable product, recipe and price snapshots
-> YooKassa payment session is created
-> Payment is confirmed by webhook or polling
-> Payment operation and financial fact are recorded
-> Order becomes paid
-> Machine receives paid dispatch only
-> Customer sees preparation and completion/failure state
```

---

# 4. Machine Readiness

| Machine area | Readiness | Notes |
|---|---|---|
| Machine profile | Not ready | Machine Domain defines capability profile concepts such as `machine_profile_soft_ice_v1`, but the real first machine manufacturer, model, hardware revision, controller, protocol and exact capability profile remain unverified. |
| Inventory | Partial | Inventory model is documented. Cup inventory control has a documented value of 160 cups with warning at 20 and block at 0, but physical capacity, mix volume, syrup/topping container specs and sensor-backed inventory are not verified. |
| Telemetry | Partial | Telemetry model is documented for temperature, consumables, counters, runtime, connectivity and hardware health. No production adapter, schema, heartbeat, stale-window policy or storage is implemented. |
| Events | Partial | Machine events are documented with examples for readiness, order acceptance, temperature, dispensing and telemetry. Event Runtime, formal schemas and machine adapter publication are not implemented. |
| Configuration | Not ready | Configuration versioning is documented, but no approved production configuration for one specific physical machine is recorded and verified. |
| Dispatch | Not ready | The paid-order dispatch boundary is documented. Runtime queueing, command delivery, acknowledgement handling, idempotency, retries and recovery are not implemented. |
| Safety and hardware verification | Not ready | Machine Passport marks physical characteristics, sensors, actuators, power, connectivity, safety certification and manufacturer limits as `Unknown` or `To be confirmed`. |

Minimum machine readiness required before launch:

- one registered machine with stable `machine_id`;
- approved location and customer pickup context;
- approved machine capability profile for the one launch product;
- approved configuration version loaded and visible to the platform;
- authenticated machine or adapter identity;
- readiness check that requires fresh telemetry, inventory, maintenance and safety state;
- inventory records for mix, cups, syrup and topping used by the launch product;
- idempotent `PrepareProduct` command path;
- machine events for command accepted, preparation started, preparation failed, product dispensed/completed and telemetry reported;
- operator recovery process for offline, blocked, failed, ambiguous dispensing and product-not-taken cases.

---

# 5. Payment Readiness

| Payment area | Readiness | Notes |
|---|---|---|
| YooKassa | Not ready | YooKassa is accepted as the primary provider and environment variable rules are documented. The provider adapter, session creation, status mapping, webhook verification and provider report import are not implemented. |
| SBP | Not ready | SBP flow is documented as provider-backed payment through link, deep link or QR, but no production SBP payment flow is implemented. |
| QR | Not ready | QR payment rules and lifetime are documented. No production QR session creation, expiration handling, replacement, status confirmation or customer UI is implemented. |
| Refunds | Not ready | Full and partial refund models are documented as compensating operations. Runtime refund commands, provider refund calls, registry, Ledger coordination and customer/support workflow are not implemented. |
| Payment registry | Not ready | Payment Operations Registry, session registry, refund registry, provider report import and reconciliation registry are documented but not implemented. |
| Reconciliation | Not ready | Reconciliation rules are documented. There is no production process comparing Payment, Ledger, provider reports, Order and Machine state. |

First-launch payment recommendation:

```text
Use exactly one payment flow for launch.
```

Recommended first payment flow:

```text
YooKassa-backed payment session
-> one customer-facing confirmation surface, such as payment link or QR
-> webhook verification plus status polling fallback
-> internal PaymentOperation recorded
-> Order paid only after platform Payment Runtime accepts completion
```

SBP, saved payment methods, one-click top-up, auto top-up, mixed payments and partial refunds should stay out of the first launch unless the selected provider flow and operations team are already proven in testing.

---

# 6. Data Readiness

| Data area | Readiness | Notes |
|---|---|---|
| Customer data | Partial | Logical model defines Customer, identities, contacts, consent and activity. Production storage, Telegram identity resolution, session binding and access control are not implemented end to end. |
| Transactions | Not ready | Club Account transactions, Bonus transactions, Payment operations, Refund operations and Ledger entries are documented. A production transaction/Ledger runtime is not ready. |
| Orders | Not ready | Order entities, snapshots, payment binding and fulfillment data are documented. Runtime order creation, state machine, immutable snapshots and fulfillment records are not implemented. |
| Audit logs | Not ready | Audit policy is documented for customer, payment, order, machine, support and configuration actions. A protected append-only audit implementation is not complete. |
| Idempotency | Not ready | Idempotency record is included in the data model. Runtime idempotency for payment, order, machine commands and webhook handling is not implemented. |
| Event storage | Not ready | Event envelope, outbox and consumer offset models are documented. Durable event storage/outbox is not implemented. |

Production data requirements before launch:

- persistent storage for customers, identities and consent evidence;
- persistent orders with configuration, recipe, price and payment snapshots;
- persistent payment operations and provider references;
- persistent refund and reconciliation records;
- persistent machine operations, commands, inventory and telemetry facts;
- append-only audit events for sensitive actions;
- idempotency records for payment creation, webhook processing, order transition and machine command dispatch;
- backup and restore procedure for business-critical records;
- data access rules that prevent customers from reading other customers' records or raw provider data.

---

# 7. Missing Implementation Items

## Must Have Before Launch

These items are required before accepting real customer payments and dispatching one real machine:

1. Telegram Mini App authentication:
   - WebApp `initData` collection;
   - backend verification with bot secret and freshness check;
   - canonical `customer_id` resolution;
   - Mini App session/token lifecycle.

2. Product purchase flow:
   - active UI reads product data through approved Catalog/Configuration/Pricing/Media boundaries;
   - one launch product and one launch configuration policy are approved;
   - final payable amount comes from runtime pricing/checkout, not UI calculation.

3. Checkout and Order Runtime:
   - checkout intent or order creation;
   - immutable product/configuration/recipe/pricing snapshots;
   - order state machine;
   - payment binding;
   - paid-only fulfillment gate;
   - order progress and recovery state for customer UI.

4. Payment Runtime:
   - YooKassa provider adapter;
   - secure environment configuration;
   - payment session creation;
   - webhook verification and deduplication;
   - status polling fallback;
   - expiration, failure and cancellation handling;
   - Payment Operations Registry;
   - idempotency for payment commands and callbacks.

5. Financial recording:
   - transaction and Ledger or approved interim financial fact recording;
   - payment/refund operation persistence;
   - reconciliation path for provider/internal mismatch;
   - daily support/finance review view or export.

6. Machine Runtime and adapter:
   - one physical machine registered with stable `machine_id`;
   - verified hardware profile and capability profile;
   - approved configuration version;
   - authenticated adapter or machine source;
   - fresh readiness, inventory and maintenance state;
   - dispatch queue entry for paid order only;
   - idempotent `PrepareProduct` command delivery;
   - acknowledgement, timeout and retry/reconciliation policy.

7. Machine events and telemetry:
   - minimum event payload schemas for accepted, started, failed, dispensed/completed and telemetry reported;
   - event ingestion or equivalent reliable callback path;
   - stale telemetry policy;
   - inventory threshold handling;
   - operation audit trail.

8. Customer status and support:
   - payment pending/success/failure/expired screens;
   - order preparation/completed/failed screens;
   - support handoff with safe order/payment/machine references;
   - manual review path for ambiguous payment or machine outcome.

9. Refund and incident policy:
   - full refund workflow for payment completed but product not delivered;
   - machine failure compensation policy;
   - operator authorization and audit for support actions;
   - Product Owner approval for no-pickup, partial dispensing and alternate-machine policy if used.

10. Operations readiness:
   - first machine installation checklist;
   - refill and cleaning SOP;
   - opening and closing checks;
   - incident escalation contacts;
   - monitoring for payments, orders, machine connectivity, telemetry staleness and inventory;
   - test purchases with real provider sandbox or approved production low-value flow.

11. Legal, fiscal and provider readiness:
   - final customer-facing legal texts and privacy/consent references approved;
   - fiscal receipt/fiscalization responsibility decided before real sales;
   - YooKassa account, shop settings and webhooks approved for the selected launch flow;
   - secrets stored outside repository files.

## Can Be Postponed

These items can be deferred if the first launch is explicitly limited to one machine, one product and one payment flow:

- live machine map on landing page;
- live public inventory display;
- full Club Account prepaid balance;
- saved payment methods;
- one-click top-up;
- auto top-up;
- bonus accrual, redemption, expiration and referral rewards;
- Birthday Bonus, Trusted Customer Bonus and seasonal campaigns;
- multi-product catalog;
- multi-size or add-on marketplace;
- multiple machines and routing;
- automatic alternate-machine fulfillment;
- CRM dashboard beyond basic support lookup;
- advanced analytics dashboards;
- marketing notifications and campaigns;
- AI recommendations or demand forecasting;
- accounting API integration beyond minimum internal export/review;
- advanced landing animations or campaign pages.

---

# 8. First Launch Scenario

The first production scenario should be intentionally narrow.

Launch constraints:

| Dimension | First launch choice |
|---|---|
| Machines | One physical vending machine. |
| Product | One approved soft ice cream product, preferably `product_soft_ice_vanilla_cup`. |
| Configuration | One approved recipe/configuration path. Syrup/topping options are allowed only if physical dispensing and inventory are verified. |
| Payment | One YooKassa-backed payment flow, such as QR or payment link, not several methods at once. |
| Customer journey | Telegram Bot opens Mini App; Mini App authenticates, creates order, accepts payment and shows fulfillment status. |
| Bonus | Deferred or read-only; no active redemption in first paid launch unless fully implemented. |
| Club Account | Deferred unless top-up/spending is fully implemented and reconciled. |

First launch flow:

```text
Customer sees machine or landing material
-> opens Telegram Bot from QR/link
-> taps Open Mini App
-> Mini App sends Telegram initData to backend
-> backend verifies Telegram data and resolves customer_id
-> Mini App shows one launch product
-> customer confirms configuration
-> backend creates order with immutable snapshots
-> Payment Runtime creates YooKassa payment session
-> customer pays through the selected confirmation surface
-> webhook or polling confirms payment
-> Payment Runtime records operation and accepted completion
-> Order becomes paid
-> Machine Runtime checks readiness, inventory, configuration and capability
-> Machine Runtime dispatches idempotent PrepareProduct command
-> machine reports accepted, preparation started and product dispensed/completed
-> Mini App/Bot shows success and support/receipt action
```

Failure flow:

```text
Payment pending, failed, cancelled or expired
-> order remains unpaid
-> machine dispatch is blocked
-> customer can retry or contact support
```

```text
Payment completed but machine unavailable or preparation failed
-> order enters recovery/support state
-> no duplicate physical command is sent without reconciliation
-> refund or compensation workflow is started according to approved policy
-> customer sees safe status and support action
```

First launch acceptance criteria:

- customer can complete the full path once with real platform records;
- no machine command can be created for an unpaid order;
- payment success cannot be inferred from QR scan, link click or client timer;
- each payment has a platform `payment_id` and operation record;
- each order has immutable product and price snapshots;
- each machine operation has `machine_operation_id`, command record and outcome event;
- failed payment does not dispense product;
- failed machine operation does not silently mark order completed;
- support can trace customer, order, payment, machine operation and audit records.

---

# 9. Risks

## Technical Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Runtime path is not implemented end to end | Real purchase cannot be completed safely. | Implement and test the narrow path before launch. |
| YooKassa adapter/webhook missing | Payment state can be wrong or unverifiable. | Build provider adapter, webhook verification, polling fallback and registry. |
| Order Runtime missing | Product/payment/machine facts cannot be tied to a durable purchase. | Implement order aggregate, snapshots and state machine before payment launch. |
| Machine adapter missing | Platform cannot safely execute physical fulfillment. | Build simulator first, then real adapter with idempotency and audit. |
| Event Runtime/storage missing | Payment, order, machine and notification facts may be lost or duplicated. | Use at least a durable outbox or equivalent append-only event/operation records. |
| Hardware details unknown | Machine may be unsafe or impossible to monitor correctly. | Complete machine passport and commissioning checklist before production. |
| Media/runtime UI still partial | Customer may see wrong product image, price or state. | Wire UI to approved services and use a fixed launch product if needed. |

## Operational Risks

| Risk | Impact | Mitigation |
|---|---|---|
| One machine is a single point of failure | Downtime means no sales. | Launch with clear support messaging and operator response plan. |
| Refill/cleaning process not ready | Product quality and availability can fail. | Approve SOPs, thresholds, logs and service responsibilities. |
| Ambiguous payment or machine outcome | Customer may pay without receiving product. | Manual review, refund workflow and support escalation must exist. |
| Connectivity loss | Machine status, payment callbacks or order updates can stall. | Monitor connectivity, block dispatch on stale state and reconcile on reconnect. |
| No operational dashboard | Support cannot resolve incidents quickly. | Provide minimal support view or export for order/payment/machine lookup. |

## Business Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Customer promise exceeds implementation | Trust damage during first launch. | Keep launch copy narrow and avoid live availability/bonus promises until real. |
| Payment/fiscal/legal gaps | Launch may violate provider, accounting or legal requirements. | Confirm legal, fiscalization and provider setup before real payments. |
| Bonus and Club Account confusion | Customers may believe bonuses are money or prepaid balance. | Defer active bonus/Club flows or label them clearly as future/read-only. |
| Product quality variance | First customers may associate machine issues with the brand. | Run internal test purchases, operator checks and quality inspections before launch. |
| Limited product choice | Lower conversion or repeat use. | Position first launch as controlled MVP and expand only after stable operations. |

---

# 10. Validation

This audit is documentation-only.

Validation result:

- new launch readiness document created;
- customer journey, machine, payment and data readiness checked;
- must-have and postponable implementation items separated;
- first launch scenario documented;
- technical, operational and business risks identified;
- no application code, frontend code, backend code, Telegram bot code, runtime configuration, database migrations or generated build output are changed by this document.

Build was not run because this task intentionally changes documentation only and does not modify executable application behavior.
