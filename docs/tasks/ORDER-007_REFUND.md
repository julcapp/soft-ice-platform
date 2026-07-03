# ORDER-007 Refund

Status: Architecture documented
Version: 0.1
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-03
Last updated: 2026-07-03

Related documents:

- `AGENTS.md`
- `PROJECT_MEMORY.md`
- `docs/architecture/ARCHITECTURE_BASELINE_1_0.md`
- `docs/architecture/ORDER_PLATFORM.md`
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/architecture/LEDGER.md`
- `docs/architecture/WALLET.md`
- `docs/architecture/EVENT_PLATFORM.md`
- `docs/architecture/CHECKOUT.md`
- `docs/tasks/EPIC-230_ORDER_PLATFORM.md`
- `docs/tasks/ORDER-001_ORDER_DOMAIN.md`
- `docs/tasks/ORDER-003_ORDER_STATE_MACHINE.md`
- `docs/tasks/ORDER-004_ORDER_EVENTS.md`
- `docs/tasks/ORDER-005_FULFILLMENT.md`
- `docs/tasks/ORDER-006_CANCELLATION.md`

---

# Purpose

ORDER-007 defines refund as a formal compensation process for paid Order flows.

Refund returns captured value only through explicit domain rules, financial coordination, Ledger-backed records, provider or Wallet operations, event publication and audit. Refund is not cancellation before capture, not a UI state, not a provider-only status and not a direct edit of historical records.

Core rule:

```text
Refund never edits historical ledger records.
Refund is represented by new financial transactions.
Refund publishes domain events.
Refund is fully auditable.
```

ORDER-007 is documentation only. It introduces no application source code, frontend changes, UI changes, routes, styles, database migrations, payment provider integration, payment credentials or machine hardware integration.

---

# Business Value

Refund protects customers, support operations and financial truth when a paid order cannot be fulfilled or when approved support policy returns value after fulfillment.

Business value:

- customers can receive compensation for failed paid orders;
- support can explain refund reason, status, method and timeline;
- finance can reconcile original sale, refund, wallet impact and provider reports;
- operators can handle exceptional cases without editing historical facts;
- CRM and Notification consumers receive stable refund events;
- analytics can measure fulfillment failure, support cost and refund risk;
- fraud controls can detect duplicate, excessive or suspicious refunds.

Refund supports the MVP goal by making the failed paid path as explicit and trustworthy as the successful purchase path.

---

# Architecture Scope

ORDER-007 covers:

- refund ownership between Order, Payment, Provider, Ledger and Wallet;
- refund lifecycle;
- allowed refund scenarios;
- partial refund rules;
- full refund rules;
- Ledger coordination;
- Wallet coordination;
- Payment Provider coordination;
- event publication;
- audit and fraud controls;
- failure scenarios;
- recovery strategy;
- risks and future roadmap.

Out of scope:

- JavaScript implementation;
- frontend changes;
- Mini App UI changes;
- React component changes;
- database migrations;
- live payment provider integration;
- payment credentials or provider configuration;
- fiscal receipt implementation;
- accounting export implementation;
- machine firmware or hardware commands;
- CRM screens;
- notification templates;
- cloud event bus implementation.

Until a separate Refund Engine is introduced, Payment Engine owns refund execution. ORDER-007 keeps the refund boundary explicit so a future Refund Engine can be extracted without changing Order snapshots, Ledger immutability or Payment Provider adapters.

---

# Refund Lifecycle

Refund has its own lifecycle before it becomes a terminal Order result or support finance record.

| Stage | Meaning |
|---|---|
| `requested` | Customer, system, operator, support, machine recovery policy or fraud/risk process requests a refund. |
| `authorized` | Actor, role, reason and command identity are validated. |
| `eligibility_checked` | Order state, payment capture, previous refunds and policy are checked. |
| `payment_reconciled` | Payment Engine confirms captured amount, method lines and provider state. |
| `machine_reconciled` | Machine Platform confirms queue, preparation, dispensing or physical outcome when relevant. |
| `amount_allocated` | Full or partial amount is allocated by method line and currency. |
| `side_effects_requested` | Payment Provider, Wallet, Bonus and Ledger operations are requested through owning domains. |
| `ledger_recorded` | Refund is recorded as new financial transaction and Ledger entries. |
| `completed` | Refund completion is accepted and events are published. |
| `failed` | Refund failed and requires retry, reconciliation or support review. |
| `manual_review` | Outcome is ambiguous or sensitive and requires operator/support decision. |

Paid active Order refund path:

```text
Paid / Queued / Preparing / Dispensing
-> RefundPending
-> RefundStarted
-> refund flow
-> RefundCompleted
-> Refunded
```

Completed Order support refund path:

```text
Completed
-> support refund workflow references immutable completed order
-> RefundRequested / RefundCompleted from finance flow
-> Completed remains unchanged
```

Lifecycle rules:

- captured financial value must exist before refund starts;
- refund cannot be used for uncaptured authorization or pending confirmation; those use payment cancellation or reservation release;
- `Refunded` is terminal only for full compensation of a paid active order that did not complete fulfillment;
- `Completed` remains terminal and immutable even when a later goodwill or support refund is approved;
- partial refund does not automatically mean the Order is `Refunded`;
- refund failure must not silently mark the original payment unpaid.

---

# Allowed Refund Scenarios

Allowed refund scenarios require approved business policy and financial reconciliation.

| Scenario | Refund type | Notes |
|---|---|---|
| Paid order cannot be queued | Full refund by default | Machine or availability failure after payment and before queue. |
| Queue accepted but machine cannot prepare | Full refund by default | Retry or alternate machine may be attempted first by policy. |
| Preparation fails before product is usable | Full or partial refund | Depends on physical outcome and approved support policy. |
| Dispensing fails or product is unusable | Full or partial refund | Requires machine telemetry and support reconciliation. |
| Duplicate captured payment for one order | Full refund of duplicate capture | Original valid capture remains. |
| Provider captured payment but Order cannot continue | Full refund | Reconcile Payment and Ledger first. |
| Wallet payment captured but order fails | Wallet refund or reversal | Wallet operation goes through Ledger. |
| Mixed payment captured and order fails | Method-line refund | Wallet and provider portions remain separate. |
| Completed order goodwill case | Support refund | Completed order is not reopened. |
| Operator-approved support correction | Full or partial refund | Requires role, reason and audit. |

Forbidden or not-yet-approved scenarios:

- refund without captured payment;
- refund amount greater than captured amount minus previous refunds;
- refund from UI-only state;
- refund while payment or machine outcome is ambiguous, unless support policy explicitly approves manual review outcome;
- automatic goodwill refund after `Completed` without Product Owner-approved policy;
- partial refund for partial dispensing before partial fulfillment rules are approved.

---

# Partial Refund Rules

Partial refund returns only an approved portion of captured value.

Rules:

- partial refund requires explicit Product Owner-approved business policy before implementation;
- amount must be allocated by payment method line and currency;
- amount cannot exceed captured amount minus previous refunds for the same method line;
- partial refund must record reason code and support context;
- partial refund must not recalculate historical price, discount or bonus snapshots;
- partial refund must not edit original payment, Wallet capture or Ledger entries;
- mixed payment partial refund preserves original method-line attribution;
- provider partial refund is allowed only when the provider adapter declares `supports_partial_refund`;
- wallet partial refund uses Wallet, Transaction and Ledger contracts;
- partial refund completion publishes refund events and remains auditable.

Possible future partial refund reasons:

- `partial_dispense`;
- `missing_topping`;
- `missing_syrup`;
- `quality_issue`;
- `customer_support_adjustment`;
- `operator_goodwill`;
- `machine_recovery_policy`;
- `duplicate_component_charge`.

Until approved policy exists, ambiguous partial product outcomes should go to support review instead of automatic partial refund.

---

# Full Refund Rules

Full refund compensates the full captured payable amount that remains refundable.

Rules:

- full refund amount equals captured amount minus previous refunds for the order or method line;
- full refund must preserve original method-line split for wallet, card, SBP and future payment methods;
- full refund of a paid active, unfulfilled order can close Order as `Refunded`;
- full refund of a `Completed` order is a support/goodwill finance workflow and does not reopen the completed Order;
- full refund must create new Transaction and Ledger records;
- full refund to external method uses Payment Provider adapter;
- full refund to Wallet uses Wallet, Transaction and Ledger contracts;
- full refund publishes `RefundCompleted` after accepted financial completion;
- full refund failure keeps the refund workflow open for retry, reconciliation or support.

Full refund does not mean:

- deleting the original payment;
- editing the original Ledger entry;
- removing historical discount or bonus facts;
- changing product configuration snapshots;
- changing completed machine facts.

---

# Ledger Coordination

Ledger is the source of truth for refund financial history.

Ledger coordination rules:

- refund never edits historical Ledger records;
- refund never deletes sale, payment, wallet capture, bonus or adjustment entries;
- refund is represented by new financial transactions and new Ledger entries;
- refund Ledger entries use operation type `REFUND` or an approved Finance Platform mapping;
- refund entries reference original `order_id`, `payment_id`, `transaction_id`, method line, customer ID and relevant original Ledger entry IDs;
- refund entries include amount, currency, debit, credit, status, actor, reason, idempotency key and correlation IDs;
- Ledger entries must not contain provider secrets, raw card data, access tokens or raw webhook payloads;
- if Ledger and Payment or provider state disagree, refund completion waits for reconciliation;
- Wallet projection and financial reports consume Ledger facts, not Order UI state.

Ledger flow:

```text
Refund operation accepted
-> Refund transaction created
-> Refund Ledger entries recorded
-> LedgerEntryRecorded
-> Wallet, CRM, finance reports and audit projections update
```

Event Storage records refund events, but it does not replace Ledger.

---

# Wallet Coordination

Wallet is a projection over Ledger and never becomes the refund source of truth.

Wallet coordination scenarios:

| Scenario | Required handling |
|---|---|
| Original wallet amount was reserved but not captured | Release reservation; do not create refund. |
| Original wallet amount was captured | Create wallet refund or reversal through Wallet, Transaction and Ledger. |
| External refund is credited to internal balance by policy | Deposit refund value through Wallet and Ledger. |
| Mixed payment with wallet and provider | Refund wallet line through Wallet/Ledger and external line through provider. |
| Wallet is frozen | Refund or release may proceed if policy allows; outgoing spending remains blocked. |
| Wallet is closed | Reopen by approved command or create new wallet according to future policy. |

Wallet rules:

- Order never mutates Wallet projection directly;
- Payment Engine or future Refund Engine never mutates Wallet projection directly;
- wallet refund must reference original order, payment, transaction and Ledger facts;
- wallet projection changes only after Ledger-backed facts;
- wallet refund events include stable IDs and amounts, not secrets;
- Wallet balance display must not be reconstructed from refund events alone when Ledger data is required.

---

# Provider Coordination

Payment Provider coordination applies to external payment methods such as card, SBP and future providers.

Provider rules:

- provider-specific refund API calls live only inside Payment Provider adapters;
- refund to original external method is preferred when provider and business policy allow it;
- provider refund request must include platform refund ID, payment ID, provider payment reference, method-line ID, amount, currency and idempotency key;
- provider refund amount must equal the approved method-line refund amount;
- provider partial refund requires provider capability and approved business policy;
- provider callbacks must be verified and deduplicated;
- provider refund statuses must be mapped to provider-neutral platform refund states;
- provider status is not final financial truth until Ledger policy records or correlates the refund;
- provider secrets, raw card data, payment credentials and raw webhook payloads must never enter Order records or events.

Provider flow:

```text
RefundRequested
-> Payment Engine validates captured method line
-> Provider adapter sends refund command
-> Provider callback or status poll confirms result
-> Payment Engine maps provider status
-> Ledger records refund
-> RefundCompleted or RefundFailed
```

If provider outcome is unknown, the refund enters reconciliation or manual review. Retry must read provider status before sending another side-effect command.

---

# Failure Scenarios

| Failure | Required handling |
|---|---|
| Duplicate refund command | Return existing result when payload matches; reject conflicting duplicate. |
| Refund without captured payment | Reject command; use payment cancellation or reservation release if applicable. |
| Amount exceeds refundable balance | Reject command and audit sensitive attempt. |
| Payment state unknown | Reconcile Payment and provider status before refund. |
| Ledger missing original capture | Stop completion and reconcile before financial event publication. |
| Provider refund timeout | Read provider refund status before retrying. |
| Provider refund rejected | Record failure, keep workflow open or route to support. |
| Provider callback duplicated | Deduplicate by provider event ID, provider refund ID and platform IDs. |
| Wallet refund projection delayed | Ledger remains truth; retry projection or rebuild Wallet. |
| Wallet refund Ledger entry fails | Retry idempotently or escalate to finance support. |
| Mixed payment one line succeeds and another fails | Keep refund in reconciliation or manual review until consistent compensation is reached. |
| Bonus reversal fails | Retry through Bonus Engine or route to support; do not edit refund Ledger facts. |
| Machine outcome ambiguous | Delay automatic refund completion and route to support review. |
| Event publication fails | Retry same event ID through Event Platform policy. |
| Operator lacks permission or reason | Reject command and audit the attempt. |

Failure handling must not duplicate provider refunds, Wallet refunds, Ledger entries, bonus reversals, machine commands or Order events.

---

# Recovery Strategy

Recovery favors reconciliation before repeated side effects.

Recovery rules:

- read current Order state before applying refund result;
- read Payment state before refund execution or completion;
- read Ledger facts before accepting refund completion;
- read provider refund status before retrying provider command;
- read Wallet state and Ledger position before repeating wallet refund or projection repair;
- read Machine state when physical outcome affects refund policy;
- preserve original correlation ID, causation ID and idempotency key;
- use bounded retry for transient infrastructure failures;
- move repeated failures to support review, finance reconciliation or dead-letter handling;
- never reopen terminal states for recovery;
- replay must rebuild projections without issuing provider, Wallet, Bonus or Machine side effects.

Recovery outcomes:

| Situation | Outcome |
|---|---|
| Full refund completed and Ledger-backed | `RefundPending -> Refunded` for paid active unfulfilled order. |
| Partial refund completed | Keep current business state or support workflow according to policy; do not auto-close as `Refunded` unless approved. |
| Completed order goodwill refund completed | Completed order remains `Completed`; support/finance refund record references it. |
| Provider refund succeeded but Ledger recording delayed | Reconcile and record Ledger before final platform completion event. |
| Ledger recorded refund but provider callback delayed | Reconcile provider status and avoid duplicate refund command. |
| Wallet projection inconsistent | Rebuild Wallet from Ledger. |
| Refund fails repeatedly | Keep workflow in `RefundPending` or manual review and escalate to support/finance. |

---

# Acceptance Criteria

ORDER-007 is complete when:

- purpose is documented;
- business value is documented;
- architecture scope is documented;
- refund lifecycle is documented;
- allowed refund scenarios are documented;
- partial refund rules are documented;
- full refund rules are documented;
- Ledger coordination is documented;
- Wallet coordination is documented;
- Provider coordination is documented;
- failure scenarios are documented;
- recovery strategy is documented;
- acceptance criteria are documented;
- risks are documented;
- future roadmap is documented;
- important architecture rules are documented;
- refund never edits historical ledger records;
- refund is represented by new financial transactions;
- refund publishes domain events;
- refund is fully auditable;
- documentation remains architecture-only;
- no application source code is modified;
- no frontend files are modified;
- no UI files are modified.

---

# Risks

Key risks:

- treating provider refund status as final financial truth without Ledger reconciliation;
- editing original Ledger records instead of creating refund transactions;
- refunding more than captured amount minus previous refunds;
- losing method-line attribution in mixed payments;
- refunding wallet and external provider portions twice during retry;
- approving partial refund before partial fulfillment policy exists;
- marking a `Completed` order as `Refunded` instead of referencing it from support workflow;
- publishing duplicate `RefundCompleted` events;
- exposing provider secrets or personal data in events or audit records;
- leaving orders stuck in `RefundPending`;
- refunding while machine outcome is ambiguous;
- allowing unsupported operator refunds without reason or role checks.

Mitigations:

- require idempotency keys for refund commands and provider calls;
- reconcile Payment, Provider, Ledger, Wallet and Machine state before completion;
- keep Ledger append-only and authoritative;
- preserve method-line attribution for every refund;
- require role, reason and audit for operator/support refunds;
- monitor refund velocity, duplicate attempts and stuck states;
- route ambiguous physical outcomes to support review.

---

# Future Roadmap

Recommended follow-up work:

1. Define formal `RequestRefund`, `ApproveRefund`, `RejectRefund`, `CompleteRefund` and `FailRefund` command contracts.
2. Decide whether to introduce a dedicated Refund Engine or keep refund orchestration inside Payment Engine for MVP.
3. Define refund reason-code catalog and localization rules.
4. Define partial refund policy for partial dispensing, missing toppings, missing syrups and quality issues.
5. Define completed-order goodwill refund policy.
6. Define YooKassa refund adapter contract and provider capability mapping.
7. Define refund Ledger entry schema and transaction status mapping.
8. Define Wallet refund, release and deposit policies for frozen and closed wallets.
9. Define Bonus reversal or compensation policy for refunded orders.
10. Define CRM support workflow and operator approval requirements.
11. Define customer notification templates for refund started, completed, failed and manual review states.
12. Add refund state-machine, idempotency, provider retry, mixed payment and Ledger reconciliation tests before implementation.
13. Add monitoring dashboards for refund latency, refund failure, stuck `RefundPending`, provider divergence and refund velocity.

---

# Important Architecture Rules

1. Refund is a compensating financial process.
2. Refund starts only after captured financial value exists.
3. Refund never edits historical ledger records.
4. Refund never deletes original payments, transactions or Ledger entries.
5. Refund is represented by new financial transactions and Ledger entries.
6. Refund references original Order, Payment, method-line and Ledger facts.
7. Refund publishes domain and integration events after accepted facts.
8. Refund is fully auditable, including rejected and failed sensitive commands.
9. Full refund and partial refund are explicit policy decisions.
10. Partial refund requires approved business and provider policy before implementation.
11. Mixed payment refund preserves method-line attribution.
12. Wallet refund is handled through Wallet, Transaction and Ledger contracts.
13. External provider refund is handled through Payment Provider adapters.
14. Provider status is reconciled with Ledger before final financial truth is accepted.
15. Bonus reversal or compensation belongs to Bonus Engine.
16. Machine outcome is reconciled before refund when physical fulfillment may have happened.
17. Refund commands, provider calls and event publication are idempotent.
18. Fraud prevention and manual review protect refund operations.
19. Terminal Order states remain immutable; post-completion refunds reference the completed order.
20. UI derives refund status from domain facts and does not decide refund amount, eligibility, provider outcome or financial truth.
