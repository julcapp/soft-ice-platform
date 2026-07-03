# Bonus Engine

Document code: ARCH-FIN-BONUS-001
Version: 0.1
Status: Draft
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-02
Last updated: 2026-07-02

Related documents:

- `AGENTS.md`
- `PROJECT_MEMORY.md`
- `docs/architecture/ARCHITECTURE_BASELINE_1_0.md`
- `docs/architecture/FINANCE_PLATFORM.md`
- `docs/architecture/LEDGER.md`
- `docs/architecture/WALLET.md`
- `docs/architecture/EVENT_PLATFORM.md`
- `docs/tasks/FINANCE-005_BONUS_ENGINE.md`
- `docs/governance/ENGINEERING_PROCESS.md`
- `docs/governance/QUALITY_GATES.md`

---

# 1. Purpose

Bonus Engine manages customer bonus rights for Soft ICE Platform.

Business rule:

```text
1 bonus = the right to receive a discount with a nominal value of 1 RUB according to platform rules.
```

Important boundaries:

- Bonus is not money.
- Bonus is not part of Wallet balance.
- Bonus is not accounting.
- Bonus cannot be withdrawn, transferred as cash or settled as money.
- Bonus can only reduce a payable price when the platform rules allow it.

Bonus Engine exists so the platform can:

- accrue bonus rights for purchases, campaigns, referrals, birthdays, support actions and future partner programs;
- reserve bonus rights during checkout;
- redeem bonus rights as a discount after the order flow is confirmed;
- release reserved bonus rights when checkout fails or is cancelled;
- expire bonus rights by policy;
- cancel or reverse bonus rights when business rules require it;
- publish formal events for CRM, Notification, Reporting, Analytics and future Promotion Engine consumers.

---

# 2. Architecture Role

Bonus Engine is a Finance Platform domain for non-monetary discount rights.

Architecture position:

```text
Campaign / Referral / Birthday / Order event
↓
Bonus Engine
↓
Bonus projection and bonus journal
↓
Events, Pricing/Discount coordination and CRM reporting
```

Checkout position:

```text
Product Configuration
↓
Pricing Result
↓
Bonus redemption eligibility
↓
Bonus reservation
↓
Transaction / Payment / Wallet flow
↓
Bonus redemption or release
```

Bonus Engine owns:

- bonus accrual rules;
- bonus expiration rules;
- bonus reservation state;
- bonus redemption state;
- bonus cancellation rules;
- customer bonus projection;
- bonus events.

Bonus Engine does not own:

- product price calculation;
- external payment;
- Wallet cash balance;
- accounting records;
- notification templates;
- CRM screens;
- promotion campaign authoring UI.

---

# 3. Bonus Lifecycle

The lifecycle is batch-based. Every accrual creates a bonus batch with source, rule, amount, activation and expiration metadata.

Lifecycle:

```text
planned source
↓
accrued
↓
active
├─ reserved
│  ├─ redeemed
│  └─ released -> active
├─ expired
├─ cancelled
└─ reversed
```

Lifecycle rules:

- accrual requires an approved source and idempotency key;
- a bonus batch may start as `pending` when the source requires confirmation;
- only `active` bonus rights can be reserved;
- reserved bonus rights are unavailable for other checkouts;
- redemption consumes reserved bonus rights and creates a discount effect in the order pricing flow;
- cancellation and reversal are compensating operations and must not delete history;
- expiration is a state transition, not a financial payment;
- every meaningful lifecycle transition publishes an event.

---

# 4. Bonus States

Bonus batch states:

| State | Meaning | Allowed next states |
|---|---|---|
| `pending` | Accrued but not yet available, for example waiting for payment, referral or campaign confirmation. | `active`, `cancelled` |
| `active` | Available for reservation and redemption according to rules. | `reserved`, `expired`, `cancelled`, `reversed` |
| `reserved` | Temporarily held for a checkout or another approved flow. | `redeemed`, `released`, `expired`, `cancelled` |
| `released` | Reservation was released and the remaining rights returned to active availability. | `active` |
| `redeemed` | Bonus rights were consumed as a discount. | `reversed` only through compensating operation |
| `expired` | Bonus rights are no longer usable after expiration policy. | Read-only |
| `cancelled` | Bonus rights were cancelled before redemption because the source became invalid or an operator action was approved. | Read-only |
| `reversed` | A previous accrual or redemption was compensated by a later operation. | Read-only |

Customer bonus projection states:

| State | Meaning |
|---|---|
| `active` | Customer can accrue and use bonuses. |
| `frozen` | New redemption and transfer-like actions are blocked during review. Accrual and expiration policy may continue if approved. |
| `closed` | Customer bonus projection is read-only for new operations. |

Projection fields should separate:

- `active_bonus`;
- `reserved_bonus`;
- `pending_bonus`;
- `expired_bonus`;
- `redeemed_bonus`;
- `cancelled_bonus`.

These are bonus rights, not currency balances.

---

# 5. Bonus Expiration Policy

Bonus Engine supports expiration for every accrual batch.

Expiration rules:

- every bonus batch must have either `expires_at` or an explicit non-expiring policy approved by Product Owner;
- expiration is evaluated by batch, not by customer total;
- redemption should consume the nearest-expiring active bonus rights first unless a campaign rule explicitly overrides it;
- expired bonuses cannot be redeemed, reserved or restored by UI state;
- manual extension requires an approved command with actor, reason and audit metadata;
- expiration publishes `BonusExpired`;
- expiration never creates Wallet balance;
- expiration never creates accounting revenue or expense by itself;
- expiration reports may show nominal discount rights that expired, but they are not cash liability reports.

Recommended policy fields:

```json
{
  "policy_id": "bonus_policy_default_2026",
  "source_type": "purchase",
  "active_after": "immediate",
  "expires_after_days": 90,
  "timezone": "UTC",
  "redeem_order": "nearest_expiration_first"
}
```

Campaign, referral, birthday and partner sources may define their own expiration policies through approved rule versions.

---

# 6. Bonus Accrual Rules

Accrual creates new bonus rights.

Supported accrual sources:

- purchase reward;
- promotional campaign;
- referral program;
- birthday bonus;
- operator adjustment;
- service recovery gift;
- future partner program;
- future franchise or location-specific campaign.

Accrual requirements:

- stable `bonus_entry_id`;
- stable `customer_id`;
- `source_type`;
- `source_id`;
- `rule_id`;
- `rule_version`;
- amount in bonus units, not currency;
- activation time;
- expiration policy;
- idempotency key;
- actor context;
- audit metadata.

Purchase accrual:

- accrual is based on confirmed business events, not UI clicks;
- accrual may wait until payment and product delivery are confirmed;
- refund or order cancellation may trigger cancellation or reversal according to the source rule.

Referral accrual:

- referral bonuses require a valid inviter and invited customer relationship;
- self-referrals are forbidden;
- duplicate referral rewards for the same qualifying action are forbidden;
- referral bonuses may be pending until the invited customer completes the required action.

Birthday accrual:

- birthday bonuses require customer profile eligibility and consent rules;
- birthday bonuses are limited by configured period, normally once per birthday campaign window;
- birthday bonuses may use a short expiration policy.

Promotional campaign accrual:

- campaign accrual requires `campaign_id` and rule version;
- campaign budgets, segments and eligibility should be controlled by future Promotion Engine;
- Bonus Engine executes approved accrual commands and preserves history.

Partner program accrual:

- partner source must be identified through a trusted adapter;
- external partner IDs must be mapped to platform IDs;
- partner accrual requires idempotency and fraud checks before activation.

---

# 7. Bonus Redemption Rules

Redemption consumes bonus rights as a discount.

Core rule:

```text
redeemed_bonus_count = discount_nominal_value_rub
```

Example:

```text
50 bonuses may create up to 50 RUB discount if Pricing and Discount rules allow it.
```

Redemption requirements:

- only active or reserved bonus rights can be redeemed;
- redemption must reference order, pricing result or checkout flow;
- redemption amount cannot exceed active eligible bonus rights;
- redemption amount cannot exceed Pricing/Discount allowed limit;
- redemption cannot make final payable amount negative;
- redemption cannot create Wallet cash;
- redemption cannot create change, payout or debt to the customer;
- redemption must be idempotent;
- redemption publishes `BonusRedeemed`.

Recommended checkout flow:

```text
Pricing Engine calculates payable amount and bonus limit
↓
Customer selects allowed bonus amount
↓
Bonus Engine reserves eligible bonus rights
↓
Pricing/Discount result includes reserved bonus discount
↓
Payment/Wallet flow completes or fails
↓
Bonus Engine redeems or releases reservation
```

Redemption consumes nearest-expiring eligible bonus rights first unless the campaign rule states otherwise.

---

# 8. Bonus Cancellation

Cancellation invalidates bonus rights before they are redeemed.

Cancellation reasons:

- source order was cancelled;
- source payment failed;
- source refund invalidates reward;
- referral relationship was invalid;
- campaign was misconfigured and approved correction is required;
- fraud review confirmed abuse;
- operator support action with approved reason;
- duplicate accrual was detected.

Rules:

- cancellation never deletes original accrual history;
- cancellation is represented by a new operation in Bonus Engine;
- cancellation requires actor, reason and reference ID;
- cancellation of reserved rights must release or cancel the reservation explicitly;
- cancellation of redeemed rights requires a compensating reversal policy, not direct mutation;
- cancellation publishes `BonusCancelled` or `BonusReversed` depending on semantics.

---

# 9. Bonus Reservation

Reservation temporarily holds bonus rights for checkout.

Reservation is needed to prevent the same bonus rights from being used in several unfinished checkouts.

Reservation states:

| State | Meaning |
|---|---|
| `active` | Bonus rights are held for a flow. |
| `released` | Held rights returned to active availability. |
| `redeemed` | Held rights were consumed as a discount. |
| `expired` | Reservation expired before completion. |
| `cancelled` | Reservation was cancelled by a compensating operation. |

Rules:

- reservation requires `reservation_id`;
- reservation requires `customer_id`;
- reservation requires `amount`;
- reservation requires `expires_at`;
- reservation must reference order, checkout or pricing result;
- reservation is not revenue;
- reservation is not Wallet reserve;
- reservation is not accounting;
- reservation must be idempotent;
- expired reservation must be released or marked expired by Bonus Engine policy;
- reservation publishes `BonusReserved`;
- release publishes `BonusReservationReleased`.

Projection effect:

```text
active_bonus -= amount
reserved_bonus += amount
```

Release effect:

```text
reserved_bonus -= amount
active_bonus += amount
```

Redemption effect:

```text
reserved_bonus -= amount
redeemed_bonus += amount
```

---

# 10. Bonus Events

Bonus Engine publishes events after accepted state transitions.

Event names follow `docs/architecture/EVENT_PLATFORM.md`.

Published events:

| Event | Type | Meaning |
|---|---|---|
| `BonusAccrued` | domain/integration | Bonus rights were accrued. |
| `BonusActivated` | domain | Pending bonus rights became active. |
| `BonusReserved` | domain/integration | Bonus rights were reserved. |
| `BonusReservationReleased` | domain/integration | Reserved bonus rights were released. |
| `BonusRedeemed` | domain/integration | Bonus rights were consumed as a discount. |
| `BonusExpired` | domain/integration | Bonus rights expired. |
| `BonusCancelled` | domain/integration | Bonus rights were cancelled before redemption. |
| `BonusReversed` | domain/integration | A previous bonus operation was compensated. |
| `BonusProjectionChanged` | domain | Customer bonus projection changed. |
| `BonusFraudReviewRequested` | integration | Bonus activity requires review. |

Minimal event payload example:

```json
{
  "bonus_entry_id": "bonus_entry_01JZ0000000000000000000000",
  "customer_id": "customer_01JZ0000000000000000000000",
  "source_type": "purchase",
  "source_id": "order_01JZ0000000000000000000000",
  "amount": 10,
  "bonus_unit": "bonus",
  "rule_id": "bonus_rule_purchase_default",
  "rule_version": 1,
  "expires_at": "2026-10-01T00:00:00Z"
}
```

Event rules:

- events are facts, not commands;
- payload fields use snake_case;
- event names use English PascalCase;
- payloads include stable IDs;
- payloads must not include payment credentials or provider secrets;
- personal data must be minimized;
- consumers must be idempotent;
- Event Storage does not replace Bonus projection or Finance Ledger.

---

# 11. Wallet Interaction

Wallet and Bonus are separate domains.

Rules:

- Wallet never stores bonus rights as cash balance.
- Wallet never calculates bonus accrual, expiration, redemption or reservation.
- Bonus Engine never mutates Wallet balance.
- Bonus redemption reduces payable amount through Pricing/Discount rules, not through Wallet deposit.
- Checkout may coordinate Wallet reservation and Bonus reservation, but each domain keeps its own state.
- Wallet balance display must not add bonuses to cash balance.
- UI may show wallet amount and bonus amount together only through an approved aggregation contract that labels them separately.

Example:

```text
Wallet available balance: 130 RUB
Bonus active rights: 20 bonuses
Allowed bonus discount: up to 20 RUB
```

The customer does not have 150 RUB in Wallet. The customer has 130 RUB cash balance and 20 discount rights.

---

# 12. Ledger Interaction

Finance Ledger is the immutable financial journal.

Bonus Engine has its own bonus history and projection for bonus rights.

Rules:

- Ledger never stores bonus balance as money.
- Ledger never treats bonus accrual as cash deposit.
- Ledger never treats bonus expiration as accounting revenue by itself.
- Ledger may reference bonus redemption when it records the financial facts of an order, such as sale amount, discount amount and payable amount.
- Ledger may store bonus-related references for audit only when the entry is explicitly non-cash or tied to a real financial transaction.
- Accounting Adapter reads Ledger for accounting facts and Bonus reports for non-monetary loyalty activity.
- If Ledger operation names include bonus concepts, their implementation must preserve the rule that bonus amount is not currency balance.

Recommended sale reference:

```json
{
  "order_id": "order_01JZ0000000000000000000000",
  "gross_amount": 130,
  "currency": "RUB",
  "bonus_discount_amount": 20,
  "payable_amount": 110,
  "bonus_redemption_id": "bonus_redemption_01JZ0000000000000000000000"
}
```

The `bonus_discount_amount` is the discount effect in the sale. It is not a stored bonus balance.

---

# 13. Pricing Interaction

Pricing Engine calculates product price and allowed bonus redemption limits.

Bonus Engine validates and reserves customer bonus rights.

Rules:

- Pricing Engine owns product price calculation.
- Pricing Engine determines the maximum allowed bonus discount for a pricing result.
- Bonus Engine does not calculate product base price, syrup price, topping price or final payable amount.
- Bonus Engine can reject redemption if the customer lacks eligible active bonuses.
- Pricing result must identify whether bonuses are allowed, the cap and the rule version.
- Final payable amount must be calculated by Pricing/Discount after applying approved bonus redemption.

Pricing result fields may include:

```json
{
  "pricing_result_id": "pricing_result_01JZ0000000000000000000000",
  "gross_amount": 130,
  "currency": "RUB",
  "bonus_allowed": true,
  "bonus_redemption_limit": 104,
  "bonus_nominal_rate": 1
}
```

---

# 14. Discount Interaction

Bonus redemption is one type of discount input.

Discount rules may also include:

- promotional discount;
- coupon;
- product discount;
- birthday discount;
- partner discount;
- operator-approved service discount.

Rules:

- Discount/Pricing domain owns stacking rules.
- Bonus Engine owns only the availability and lifecycle of bonus rights.
- Bonus Engine does not decide whether coupon and bonus can be combined unless that rule belongs to an approved bonus campaign contract.
- A redeemed bonus creates a discount effect, not a Wallet transfer.
- The same bonus rights cannot be used twice across discount calculations.
- Discount reports must distinguish bonus redemption from ordinary price discounts.

Future Discount Engine may become the formal coordinator for stacking and exclusion rules. Until then, Pricing must provide explicit bonus redemption limits.

---

# 15. Notification Interaction

Notification Engine reacts to Bonus events.

Bonus Engine does not send messages directly.

Possible notification triggers:

- `BonusAccrued`;
- `BonusActivated`;
- `BonusReserved` only if user-visible confirmation is needed;
- `BonusReservationReleased` when checkout fails and the user should know bonuses returned;
- `BonusRedeemed`;
- `BonusExpired`;
- upcoming expiration reminder based on Bonus projection;
- `BirthdayRewardIssued` when birthday campaigns are introduced;
- referral reward events.

Rules:

- notification templates are not Bonus contracts;
- failed notification delivery must not rollback bonus operations;
- notification delivery status must be correlated with the triggering bonus event;
- messages must avoid presenting bonuses as cash.

Correct wording principle:

```text
You received 10 bonuses for a future discount.
```

Avoid:

```text
You received 10 RUB in your wallet.
```

---

# 16. CRM Interaction

CRM consumes Bonus events and queries Bonus read models.

CRM may use Bonus data for:

- customer bonus balance view;
- bonus history;
- campaign participation;
- referral status;
- birthday reward support;
- support adjustments;
- fraud review;
- segmentation and retention analysis;
- operator audit.

Rules:

- CRM does not become source of truth for bonuses.
- CRM must not edit bonus rights directly.
- CRM operator actions must call approved Bonus commands.
- every operator action requires actor ID, reason and audit metadata.
- CRM must label bonuses as discount rights, not money.
- CRM projections are derived from Bonus events and read models.

---

# 17. Reporting

Bonus reporting supports business analysis without treating bonuses as cash.

Reports may include:

- bonuses accrued by period;
- active bonuses by customer segment;
- reserved bonuses;
- redeemed bonuses;
- expired bonuses;
- cancelled and reversed bonuses;
- campaign issuance and redemption;
- referral issuance and conversion;
- birthday bonus usage;
- partner program issuance and redemption;
- upcoming expiration;
- fraud review queue;
- nominal discount exposure.

Reporting rules:

- report bonus units separately from money;
- show monetary discount impact only when bonuses were actually redeemed in orders;
- use Ledger/Transaction for real sale, payment and refund amounts;
- use Bonus projection for non-monetary bonus state;
- campaign ROI must compare real order results with bonus redemption events, not assume every active bonus becomes revenue loss.

---

# 18. Fraud Protection

Bonus Engine must protect promotional value from abuse.

Required controls:

- idempotency keys for every external or event-driven command;
- duplicate accrual detection by source ID and rule version;
- velocity limits for campaign accrual and redemption;
- referral self-referral prevention;
- referral loop detection;
- birthday reward frequency limit;
- partner source verification;
- suspicious device, account or payment correlation where legally allowed;
- operator action audit;
- freeze support for customer bonus projection;
- manual review event for suspicious activity;
- campaign budget and cap enforcement through future Promotion Engine.

Fraud review rules:

- freeze blocks redemption and reservation, but does not erase history;
- legitimate expiration may continue while frozen if policy says so;
- confirmed abuse is handled by cancellation or reversal operations;
- no fraud correction may mutate original bonus entries directly.

---

# 19. Future Promotion Engine Integration

Promotion Engine will eventually own campaign definition and eligibility.

Future split:

| Area | Owner |
|---|---|
| Campaign authoring | Promotion Engine |
| Segment eligibility | Promotion Engine / CRM |
| Campaign budget | Promotion Engine |
| Bonus accrual execution | Bonus Engine |
| Bonus reservation and redemption | Bonus Engine |
| Discount stacking | Discount/Pricing Engine |
| Customer messaging | Notification Engine |
| Campaign reporting | Reporting / Analytics consuming events |

Integration rules:

- Promotion Engine sends approved commands or events to Bonus Engine;
- campaign rules must include `campaign_id`, `rule_id` and `rule_version`;
- Bonus Engine must preserve the rule version used for every accrual;
- campaign edits must not change historical bonus meaning;
- partner programs must use stable partner IDs and trusted adapters;
- future AI recommendations may suggest campaigns, but approved Promotion/Bonus rules execute them.

---

# 20. Architecture Principles

Bonus architecture follows these principles:

1. Bonus is not money.
2. Bonus is not Wallet balance.
3. Bonus is not accounting.
4. One bonus is a right to receive a 1 RUB nominal discount according to platform rules.
5. Bonus Engine owns accrual, reservation, redemption, cancellation and expiration.
6. Wallet owns cash balance and never stores bonuses as cash.
7. Ledger never stores bonus balance as money.
8. Pricing calculates product price and bonus redemption limits.
9. Discount/Pricing owns stacking and final payable amount.
10. Bonus Engine publishes events after accepted state transitions.
11. Bonus events follow Event Platform contracts.
12. Bonus operations are idempotent.
13. Bonus projections are rebuildable from Bonus history and events.
14. Bonus history is append-only; corrections use compensating operations.
15. Bonus supports expiration by batch.
16. Bonus supports promotional campaigns.
17. Bonus supports referrals.
18. Bonus supports birthday rewards.
19. Bonus supports future partner programs.
20. Bonus remains independent from UI, channel, CRM screen, payment provider and vending hardware.

---

# 21. Readiness Criteria

Bonus architecture is ready for implementation when:

- Bonus command, query and event contracts are approved;
- Pricing provides explicit bonus redemption limits;
- Discount stacking rules are documented or delegated to Pricing for MVP;
- Wallet separation is confirmed;
- Ledger non-cash bonus boundary is confirmed;
- Event Platform contract registry exists or this document is accepted as temporary source;
- expiration policy defaults are approved by Product Owner;
- referral and birthday eligibility rules are approved before implementation;
- fraud controls are defined for campaigns and referrals;
- test scenarios cover accrual, reservation, redemption, release, expiration and cancellation.

---

# 22. Documentation Scope

This document is architecture-only.

It does not introduce JavaScript implementation, frontend changes, routes, styles, package changes, database migrations, payment integration, CRM screens, notification templates, Promotion Engine implementation or cloud infrastructure.
