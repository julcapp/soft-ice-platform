# Club Account Domain Contract

Document code: DOMAIN-CLUB-ACCOUNT-CONTRACT-001
Task: DOMAIN-005
Version: 0.1
Status: Draft
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-13
Last updated: 2026-07-13
Scope: Documentation only

Related documents:

- `docs/domain/CLUB_ACCOUNT.md`
- `docs/domain/PAYMENT_LEDGER_CONTRACT.md`
- `docs/data/DATABASE_FOUNDATION.md`
- `docs/data/PLATFORM_DATA_MODEL.md`
- `docs/domain/BONUS_DOMAIN.md`
- `docs/architecture/BONUS_ENGINE.md`
- `docs/architecture/DISCOUNT_ENGINE.md`
- `docs/architecture/CHECKOUT.md`
- `docs/product/MINI_APP_MVP_SPEC.md`
- `docs/api/EVENT_API.md`
- `docs/architecture/PROJECT_DECISIONS.md`

---

# 1. Purpose

This document defines implementation-facing Club Account domain contracts for future runtime work.

It tightens the broad `CLUB_ACCOUNT.md` domain model against:

- `PAYMENT_LEDGER_CONTRACT`;
- `DATABASE_FOUNDATION`;
- MVP business rules from `MINI_APP_MVP_SPEC`.

Core rule:

```text
Club Account balance changes only through immutable Club Account transactions created from accepted domain facts.
Raw provider success, UI state, redirect success or webhook delivery must not mutate Club Account balance.
```

This document is documentation-only. It does not create runtime code, API routes, database migrations, Prisma schema changes, payment provider calls, event handlers, frontend UI or tests.

---

# 2. Scope

Included:

- Club Account aggregate model;
- balance and immutable transaction rules;
- top-up/deposit lifecycle;
- minimum balance rules;
- discount eligibility rules;
- bonus accrual and spending rules;
- referral bonus integration;
- birthday reward rules;
- `PaymentCompleted` integration;
- audit requirements.

Out of scope:

- Club Account runtime implementation;
- database schema or migration implementation;
- YooKassa integration;
- Payment webhook handling;
- Bonus Runtime implementation;
- Discount Runtime implementation;
- Promotion Runtime implementation;
- final commercial reward amounts;
- final legal terms and retention periods.

---

# 3. Source-of-Truth Hierarchy

Club Account uses this source-of-truth order:

| Layer | Owns | Rule |
|---|---|---|
| Customer | `customer_id`, identity, Club Timofey membership and relationship facts. | Club Account does not create identity or referral relationships. |
| Club Account | Customer-facing prepaid account, account state, reservations, top-up/deposit workflows and account transactions. | All balance changes are append-only transactions. |
| Payment | Provider-independent payment completion facts and provider reconciliation. | Payment does not mutate Club Account storage directly. |
| Ledger | Immutable monetary financial facts. | Club Account transactions reference Ledger-backed payment or refund facts when money changes. |
| Bonus | Non-monetary discount rights. | Bonus is not Club Account balance and is not a payment method. |
| Discount | Eligibility, stacking and final payable amount. | Club Account pays or reserves only the accepted payable amount. |
| Order | Accepted purchase snapshots and paid-state progression. | Order does not edit Club Account balance directly. |

Source-of-truth rule:

```text
Club Account is the source of customer-facing prepaid account state.
Ledger is the source of monetary financial truth.
Bonus is the source of non-monetary discount rights.
```

---

# 4. Club Account Aggregate Model

## 4.1 Aggregate Root

Aggregate root:

```text
ClubAccount
```

Primary identifier:

```text
club_account_id
```

Aggregate responsibilities:

- account lifecycle;
- available and reserved balance projection;
- minimum balance state;
- top-up/deposit workflow references;
- purchase reservation workflow references;
- immutable transaction append policy;
- customer-safe account history;
- account-level audit and idempotency.

Aggregate invariants:

- one active Club Account belongs to one `customer_id`;
- one customer may have at most one active Club Account per currency unless a future policy approves otherwise;
- MVP currency is `RUB`;
- `available_balance >= 0`;
- `reserved_balance >= 0`;
- `total_balance = available_balance + reserved_balance`;
- balances are projections built from accepted Club Account transactions and Ledger-backed monetary facts;
- a posted transaction is immutable;
- corrections use new compensating transactions;
- Club Account balance is not Bonus balance;
- Club Account balance is not a bank deposit, credit line, cashback cash or interest-bearing account.

## 4.2 Aggregate Records

| Record | Purpose | Mutability |
|---|---|---|
| `ClubAccount` | Account identity, lifecycle, currency and current projection fields. | Mutable projection fields only through accepted transactions. |
| `ClubAccountTransaction` | Append-only account fact that changes balance, records lifecycle action or records sensitive policy action. | Immutable after `posted`. |
| `ClubAccountTopUp` | Customer top-up/deposit workflow record before and after payment completion. | Status may advance; posted credit uses immutable transaction. |
| `ClubAccountReservation` | Temporary hold of available balance for checkout or purchase settlement. | Status may advance; balance movements use immutable transactions. |
| `ClubAccountPolicySnapshot` | Versioned policy values used for minimum balance, top-up recommendation and account eligibility. | Immutable after use in a posted transaction or decision. |

## 4.3 ClubAccount Fields

Required conceptual fields:

| Field | Meaning |
|---|---|
| `club_account_id` | Stable account ID. |
| `customer_id` | Owner customer. |
| `status` | `pending_activation`, `active`, `suspended`, `closing_pending` or `closed`. |
| `currency` | MVP default `RUB`. |
| `available_balance` | Amount available for reservation or spending. |
| `reserved_balance` | Amount held for unfinished purchase or operation. |
| `total_balance` | `available_balance + reserved_balance`. |
| `minimum_recommended_balance` | MVP threshold, `150 RUB`. |
| `recommended_top_up_amount` | MVP recommendation, `100 RUB`. |
| `low_balance_state` | `ok`, `below_minimum`, `notification_sent` or `suppressed`. |
| `last_transaction_id` | Last transaction applied to projection. |
| `projection_version` | Monotonic projection version. |
| `created_at` | UTC creation timestamp. |
| `updated_at` | UTC update timestamp. |

Conditionally required fields:

| Field | Required when |
|---|---|
| `club_membership_id` | Account is tied to Club Timofey membership. |
| `suspension_reason` | Account status is `suspended`. |
| `closing_reason` | Account status is `closing_pending` or `closed`. |
| `policy_snapshot_id` | A balance or eligibility decision uses a versioned policy. |

## 4.4 Account States

| State | Meaning | Balance-changing behavior |
|---|---|---|
| `pending_activation` | Account exists but activation prerequisites are incomplete. | No spending; top-up requires explicit policy. |
| `active` | Normal account use is allowed. | Top-up, reservation, capture, release and refund may run by policy. |
| `suspended` | Sensitive actions are blocked during review. | New spending is blocked; payment-completed credit and refunds may be applied when policy requires value return. |
| `closing_pending` | Closure requested and unresolved balance, reservation, refund or audit condition remains. | Route new credits and debits to policy or manual review unless explicitly allowed. |
| `closed` | Account is closed for new customer operations. | No silent reopening; late payment/refund facts route to support or finance policy. |

---

# 5. Balance and Immutable Transaction Rules

## 5.1 Balance Fields

| Balance | Meaning |
|---|---|
| `available_balance` | Customer prepaid amount available for reservation or spending. |
| `reserved_balance` | Customer prepaid amount held for accepted checkout or purchase workflow. |
| `total_balance` | Sum of available and reserved balances. |

Balance formulas:

```text
top_up_credit:
available_balance += amount

purchase_reserved:
available_balance -= amount
reserved_balance += amount

purchase_capture:
reserved_balance -= amount
total_balance -= amount

reservation_released:
reserved_balance -= amount
available_balance += amount

refund_credit:
available_balance += amount
```

## 5.2 Non-Negative Rules

- `available_balance` must never become negative.
- `reserved_balance` must never become negative.
- Purchase reservation must reject if `amount > available_balance`.
- Purchase capture must reject if the reservation is missing, expired, released or already captured.
- Refund credit must be a new compensating transaction.
- Manual debit adjustment must not create negative available balance unless a Product Owner-approved exceptional policy exists.

## 5.3 Transaction Model

`ClubAccountTransaction` is the immutable journal for account history.

Required conceptual fields:

| Field | Meaning |
|---|---|
| `club_account_transaction_id` | Stable transaction ID. |
| `club_account_id` | Account affected. |
| `customer_id` | Owner customer. |
| `transaction_type` | Accepted transaction type. |
| `direction` | `credit`, `debit`, `reservation`, `release`, `lifecycle` or `correction`. |
| `amount` | Amount for monetary balance transactions. |
| `currency` | `RUB` for MVP monetary transactions. |
| `available_delta` | Change to available balance. |
| `reserved_delta` | Change to reserved balance. |
| `available_balance_after` | Projection after posting. |
| `reserved_balance_after` | Projection after posting. |
| `status` | `posted`, `rejected`, `manual_review` or `compensated`. |
| `source_domain` | Originating domain, such as `payment`, `order`, `refund`, `support` or `system`. |
| `source_id` | Source fact or command ID. |
| `payment_completed_id` | Present for top-up credit from `PaymentCompleted`. |
| `payment_ledger_entry_id` | Present for Ledger-backed payment/refund facts. |
| `ledger_entry_ids` | Ledger references backing monetary movement. |
| `order_id` | Present for purchase reservation, capture, release or refund tied to an order. |
| `reservation_id` | Present for reservation, capture and release. |
| `idempotency_key` | Duplicate side-effect protection. |
| `actor_type` | `customer`, `system`, `operator`, `provider`, `migration` or `support`. |
| `actor_id` | Actor reference when available. |
| `reason_code` | Business or support reason. |
| `correlation_id` | End-to-end flow ID. |
| `causation_id` | Command, event or fact that caused transaction. |
| `posted_at` | UTC posting timestamp. |

Required transaction types:

| Type | Balance effect |
|---|---|
| `account_activated` | None. |
| `top_up_requested` | None. |
| `top_up_credit` | Available increases. |
| `top_up_failed` | None. |
| `purchase_reserved` | Available decreases, reserved increases. |
| `purchase_capture` | Reserved decreases, total decreases. |
| `reservation_released` | Reserved decreases, available increases. |
| `refund_credit` | Available increases. |
| `operator_adjustment_credit` | Available increases. |
| `operator_adjustment_debit` | Available decreases by approved policy. |
| `account_suspended` | None. |
| `account_restored` | None. |
| `account_closed` | None. |

## 5.4 Immutability Rules

- Posted transactions are append-only.
- Posted transactions must not be updated to change amount, direction, balance deltas, source, actor, reason or timestamp.
- Failed or rejected sensitive commands may create audit records, but must not create posted balance movement.
- Corrections are new `operator_adjustment_credit`, `operator_adjustment_debit`, `refund_credit`, `reservation_released` or explicit compensating transaction types.
- Rebuilding a projection from transactions must produce the same balance for the same transaction set.
- Replay must not repeat payment, bonus, notification or machine side effects.

---

# 6. Deposit Lifecycle

## 6.1 Definition

The customer-facing term is `top-up`.

The internal contract may use `deposit` to mean:

```text
an accepted increase of prepaid Club Account balance after PaymentCompleted and Ledger policy are satisfied.
```

Internal `deposit` wording must not imply a bank deposit, interest, withdrawable account or regulated bank account.

## 6.2 ClubAccountTopUp Fields

Required conceptual fields:

| Field | Meaning |
|---|---|
| `top_up_id` | Stable top-up workflow ID. |
| `club_account_id` | Destination account. |
| `customer_id` | Owner customer. |
| `amount` | Requested top-up amount. |
| `currency` | MVP `RUB`. |
| `status` | Top-up lifecycle state. |
| `recommended` | Whether this used the 100 RUB recommendation. |
| `payment_intent_id` | Payment request reference. |
| `payment_session_id` | Payment attempt/session reference when applicable. |
| `payment_completed_id` | Accepted completion fact when paid. |
| `payment_ledger_entry_id` | Payment ledger completion reference. |
| `ledger_entry_ids` | Ledger entries backing the accepted monetary fact. |
| `transaction_id` | `top_up_credit` transaction after posting. |
| `idempotency_key` | Duplicate top-up protection. |
| `expires_at` | Customer payment confirmation expiry when applicable. |
| `created_at` | UTC creation timestamp. |
| `credited_at` | UTC timestamp when balance was credited. |

## 6.3 Lifecycle States

| State | Meaning | Balance effect |
|---|---|---|
| `requested` | Customer or policy requested top-up. | None. |
| `payment_intent_created` | Payment Runtime accepted a top-up payment intent. | None. |
| `confirmation_required` | Customer must confirm provider payment, QR, link or saved-method flow. | None. |
| `payment_pending` | Payment is in progress or provider status is pending. | None. |
| `payment_completed` | `PaymentCompleted` event was accepted for the top-up. | None until Club Account transaction posts. |
| `ledger_verified` | Required Ledger references passed Club Account consumption policy. | None until transaction posts. |
| `credited` | One `top_up_credit` transaction is posted. | Available increases. |
| `failed` | Payment or policy failed before credit. | None. |
| `expired` | Confirmation or payment session expired before accepted completion. | None. |
| `cancelled` | Top-up was cancelled before accepted completion. | None. |
| `manual_review` | Account, amount, Ledger or duplicate state is unsafe. | None until resolved. |

Allowed high-level flow:

```text
requested
-> payment_intent_created
-> confirmation_required
-> payment_pending
-> payment_completed
-> ledger_verified
-> credited
```

Failure paths:

```text
confirmation_required -> expired
payment_pending -> failed
payment_pending -> manual_review
payment_completed -> manual_review
manual_review -> credited
manual_review -> failed
```

## 6.4 Deposit Posting Rules

Club Account may post a `top_up_credit` only when:

- account exists;
- `club_account_id` belongs to the same `customer_id`;
- account policy allows crediting the current account state;
- `PaymentCompleted` has `purpose = club_account_top_up`;
- amount is greater than zero;
- currency is `RUB` for MVP;
- `payment_completed_id` is present;
- `payment_ledger_entry_id` is present;
- `ledger_entry_ids` are present;
- event idempotency key has not already produced a top-up credit;
- top-up amount matches the requested top-up workflow or a manual-review resolution authorizes the difference.

Duplicate rules:

- same `payment_completed_id` creates at most one posted `top_up_credit`;
- same `payment_ledger_entry_id` creates at most one posted `top_up_credit` for the same account;
- provider reference duplicates must be handled by Payment and must not bypass Club Account idempotency;
- duplicate event delivery returns the existing transaction reference.

---

# 7. Minimum Balance Rules

MVP minimum recommended balance:

```text
150 RUB
```

MVP recommended top-up amount:

```text
100 RUB
```

Rules:

- 150 RUB is a recommendation threshold, not a debt limit and not a mandatory bank minimum.
- Balance below 150 RUB does not block spending by itself when available balance covers the accepted payable amount.
- If a posted transaction changes `available_balance` from `>= 150` to `< 150`, Club Account should emit or record a low-balance fact.
- Notification delivery is owned by Notification Runtime and must respect consent and throttling.
- The system recommends topping up by 100 RUB, while custom top-up amounts may be allowed by payment/provider policy.
- A top-up that leaves available balance below 150 RUB is allowed; low-balance state remains.
- Suspended, closing or closed accounts must not receive ordinary low-balance marketing-style prompts unless policy allows customer-safe service messaging.

Low balance states:

| State | Meaning |
|---|---|
| `ok` | Available balance is at least 150 RUB. |
| `below_minimum` | Available balance is below 150 RUB. |
| `notification_sent` | Notification was requested for the current low-balance episode. |
| `suppressed` | Notification is suppressed by consent, throttling, channel or account state. |

Low balance does not change discount eligibility, bonus eligibility, order paid state or machine dispatch eligibility.

---

# 8. Discount Eligibility Rules

Discount eligibility is owned by Discount Engine, not Club Account.

Club Account may provide these inputs to Discount or Checkout:

| Input | Meaning |
|---|---|
| `club_account_id` | Account reference for customer context. |
| `club_account_status` | Active/suspended/closed account state. |
| `club_membership_id` | Membership reference when available. |
| `club_membership_status` | Club Timofey membership status from Customer or Club context. |
| `minimum_balance_state` | Informational low-balance state only. |
| `account_age` | Optional fraud/eligibility signal when policy approves. |

Rules:

- UI must not infer discount eligibility from visible account cards.
- Club Account status may qualify or disqualify a membership discount only through a versioned Discount rule.
- Active Club Account does not automatically grant a discount unless Discount Engine accepts a rule.
- Suspended or closed account may block Club Account spending, but discount policy must state whether membership discounts remain available through another payment method.
- Minimum balance state is not a discount by itself.
- Discount result must be accepted before payment starts.
- Club Account reserves or debits only the accepted payable amount after discounts and bonus redemption.
- Discount amount is not Club Account money and must not be posted as a Club Account credit.

---

# 9. Bonus Accrual and Spending Rules

## 9.1 Boundary

Bonus Domain owns bonus rights.

Club Account owns prepaid balance.

Rules:

- bonus is not Club Account balance;
- bonus is not a payment method;
- bonus cannot be top-up credit;
- bonus cannot be withdrawn through Club Account;
- bonus redemption reduces payable amount before Club Account reservation or payment;
- Bonus transactions are immutable in Bonus Domain, not Club Account transactions.

## 9.2 Accrual Rules

Bonus accrual may use Club Account or Order facts as context, but Bonus Runtime owns the accrual decision.

Qualifying sources may include:

- completed purchase;
- referral qualification;
- birthday campaign;
- trusted customer rule;
- seasonal campaign;
- manual support adjustment.

Accrual requirements:

- accepted source fact;
- stable source ID;
- `customer_id`;
- rule ID and rule version;
- idempotency key;
- amount in bonus units;
- activation and expiration policy;
- audit metadata.

Club Account must not accrue bonuses from:

- a top-up request alone;
- raw payment provider success;
- UI click or page view;
- account activation unless a Bonus rule explicitly accepts it;
- low-balance state.

## 9.3 Spending Rules

Bonus spending flow:

```text
Pricing Result
-> Discount Result and bonus cap
-> Bonus reservation
-> accepted payable amount
-> Club Account reservation or external Payment
-> PaymentCompleted / Order paid
-> Bonus redemption
```

Rules:

- Bonus is reserved before payment when the customer chooses to use bonus rights.
- Club Account reservation amount is the accepted payable amount after bonus discount.
- Payment collects only the accepted payable amount.
- If checkout, payment or machine flow fails before order completion, Bonus and Club Account reservations are released through their own domains.
- Duplicate order or payment events must not redeem the same bonus reservation twice.
- Refunds may require bonus reversal or cancellation according to Bonus and Order rules, but monetary refund remains Payment/Order/Club Account policy.

---

# 10. Referral Bonus Integration

Referral relationship ownership:

```text
Customer Domain owns referral relationship.
Bonus Domain owns referral reward accrual and lifecycle.
Club Account provides account and membership context only when policy requires it.
```

Rules:

- self-referral is forbidden;
- an invited customer may have at most one active inviter per referral program unless a future rule approves otherwise;
- referral reward qualification must come from accepted Customer, Order, Payment or Promotion facts;
- a top-up alone does not qualify referral reward unless a Product Owner-approved rule explicitly says so;
- first paid order may be used as a qualifying event when a referral rule version approves it;
- referral bonus amount is not defined by this contract and requires Product Owner-approved rule version;
- duplicate rewards for the same `referral_id + reward_side + qualifying_event_id + rule_version` are forbidden;
- suspected referral abuse routes to fraud/manual review and must not edit historical reward facts;
- referral bonuses are Bonus transactions, not Club Account credits.

Optional Club Account inputs to referral reward policy:

| Input | Meaning |
|---|---|
| `club_account_status` | Whether inviter or invited customer has active Club Account. |
| `club_membership_status` | Whether membership prerequisites are satisfied. |
| `first_top_up_completed` | Optional signal only if future rule approves top-up qualification. |
| `first_paid_order_completed` | Common qualification signal when Order and Payment facts are accepted. |

---

# 11. Birthday Reward Rules

Birthday reward ownership:

```text
Customer Domain owns birth date and consent/profile eligibility.
Bonus or Promotion owns reward rule and execution.
Club Account may provide account context when rule requires active membership.
```

Rules:

- birth date is personal data and must be handled by Customer/Consent policy;
- missing, unverified or policy-restricted birth date means no automatic birthday reward;
- birthday reward requires a versioned Product Owner-approved rule;
- reward frequency must be limited, normally at most once per birthday campaign window;
- timezone, start window, end window, amount, expiration and notification policy must be explicit;
- birthday bonus is a Bonus transaction, not Club Account money;
- birthday discount is a Discount result, not Club Account money;
- no birthday rule may silently top up Club Account balance in MVP;
- any future monetary Club Account birthday credit requires Product Owner approval, Ledger/accounting policy, anti-abuse rules and an immutable `operator_adjustment_credit` or approved promotional credit transaction type;
- changing birth date after a reward was issued must not create duplicate reward without approved manual review.

---

# 12. PaymentCompleted Integration

## 12.1 Event Contract

Club Account consumes the Payment Engine business fact:

```text
PaymentCompleted
```

Canonical Event API candidate:

```text
Payments.Completed
```

The event is defined by `PAYMENT_LEDGER_CONTRACT`.

## 12.2 Required Event Fields

Club Account requires:

| Field | Requirement |
|---|---|
| `payment_completed_id` | Stable completion fact ID. |
| `payment_intent_id` | Required for correlation. |
| `payment_operation_id` | Required for payment operation traceability. |
| `payment_ledger_entry_id` | Required for completion acceptance. |
| `ledger_entry_ids` | Required for Ledger-backed monetary fact. |
| `purpose` | Must be `club_account_top_up` for top-up credit. |
| `customer_id` | Must match account owner. |
| `club_account_id` | Must match target account. |
| `top_up_id` | Required when a top-up workflow exists. |
| `amount` | Must be greater than zero. |
| `currency` | Must be `RUB` for MVP. |
| `method_lines` | Required for payment traceability. |
| `occurred_at` | UTC completion time. |
| `correlation_id` | Required. |
| `causation_id` | Required. |
| `idempotency_key` | Required. |

Forbidden in Club Account event handling:

- raw card data;
- CVV or PIN;
- provider secret key;
- webhook signature;
- raw provider payload;
- unmasked authorization data;
- unnecessary phone, email or personal data.

## 12.3 Consumption Flow

```text
PaymentCompleted received
-> validate event version and purpose
-> validate account/customer match
-> validate amount and currency
-> validate Payment ledger and Ledger references
-> validate idempotency
-> append top_up_credit transaction
-> update balance projection
-> mark top-up credited
-> publish ClubAccounts.TopUpCredited and BalanceChanged
```

## 12.4 Rejection and Manual Review

Club Account must reject or route to manual review when:

- purpose is not `club_account_top_up`;
- account does not exist;
- account belongs to another customer;
- account is closed and no approved late-credit policy exists;
- amount is zero or negative;
- currency is not `RUB`;
- Ledger references are missing;
- payment ledger entry is missing;
- top-up workflow amount conflicts with event amount;
- idempotency key is reused with a different semantic payload;
- duplicate event maps to a different account or top-up.

Raw provider `succeeded`, redirect success, QR scan success, payment link success or webhook delivery must not be consumed directly by Club Account.

---

# 13. Audit Requirements

Audit is mandatory for Club Account operations.

Audit is required for:

- account activation, suspension, restoration, closing and reopening policy attempts;
- top-up request, payment completion consumption, credit posting, failure, expiry and manual review;
- purchase reservation, capture and release;
- refund credit;
- operator adjustment credit or debit;
- low-balance event and notification request;
- saved payment method consent state changes when implemented;
- auto top-up policy changes when implemented;
- rejected sensitive commands;
- duplicate event handling when financial side effects are possible;
- manual review resolution.

Required audit fields:

| Field | Meaning |
|---|---|
| `audit_event_id` | Stable audit record ID. |
| `actor_type` | `customer`, `operator`, `system`, `provider`, `support`, `migration`. |
| `actor_id` | Actor reference when available. |
| `action` | Accepted or rejected action. |
| `target_type` | `ClubAccount`, `ClubAccountTransaction`, `ClubAccountTopUp`, `ClubAccountReservation` or policy target. |
| `target_id` | Target record ID. |
| `reason_code` | Business, support, fraud, legal or system reason. |
| `source_channel` | Mini App, Telegram Bot, CRM, backend, provider, scheduler or migration. |
| `amount` | Required for monetary facts. |
| `currency` | Required for monetary facts. |
| `payment_completed_id` | Required for top-up credit from Payment. |
| `payment_ledger_entry_id` | Required for Ledger-backed payment/refund facts. |
| `ledger_entry_ids` | Required when monetary Ledger fact exists. |
| `order_id` | Required for purchase or refund facts tied to order. |
| `idempotency_key` | Required for side-effecting commands and event consumption. |
| `correlation_id` | End-to-end flow ID. |
| `causation_id` | Command, event or fact that caused audit. |
| `occurred_at` | UTC event time. |
| `recorded_at` | UTC audit record time. |

Audit rules:

- audit records are append-only;
- audit records must not contain provider secrets, raw card data, raw webhook signatures, raw Telegram init data or unnecessary personal data;
- operator actions require actor, role and reason;
- manual review resolution requires before/after references or compensating transaction references;
- audit must allow reconstruction of balance history from accepted transactions, payment facts, Ledger references and manual decisions.

---

# 14. Idempotency Keys

Recommended keys:

| Scope | Key pattern |
|---|---|
| Account activation | `club_account_activate:{customer_id}:{currency}:{terms_version}` |
| Top-up request | `club_top_up_request:{club_account_id}:{amount}:{currency}:{request_id}` |
| Top-up credit from event | `club_top_up_credit:{club_account_id}:{payment_completed_id}` |
| Purchase reservation | `club_purchase_reserve:{club_account_id}:{order_id}:{amount}:{currency}` |
| Purchase capture | `club_purchase_capture:{reservation_id}:{order_id}:{amount}:{currency}` |
| Reservation release | `club_reservation_release:{reservation_id}:{reason_code}` |
| Refund credit | `club_refund_credit:{club_account_id}:{refund_id}:{amount}:{currency}` |
| Manual adjustment | `club_manual_adjustment:{club_account_id}:{request_id}:{amount}:{currency}` |
| Low-balance episode | `club_low_balance:{club_account_id}:{episode_start_transaction_id}` |

Rules:

- same key and same semantic payload returns existing result;
- same key and conflicting semantic payload is rejected and audited;
- idempotency records must not contain secrets;
- event replay must not repeat credits, debits, refunds, notifications or machine commands.

---

# 15. Readiness Criteria

This contract is complete when:

- Club Account aggregate model is documented;
- balance and immutable transaction rules are documented;
- deposit/top-up lifecycle is documented;
- minimum balance rules are documented;
- discount eligibility rules are documented;
- bonus accrual and spending rules are documented;
- referral bonus integration is documented;
- birthday reward rules are documented;
- `PaymentCompleted` integration is documented;
- audit requirements are documented;
- `ENGINEERING_JOURNAL.md` is updated;
- `docs/architecture/PROJECT_DECISIONS.md` is updated;
- `docs/tasks/TASK_INDEX.md` is updated;
- `git diff --check` passes;
- no build is run because this task is documentation-only.

Future implementation readiness additionally requires:

- command schemas;
- query schemas;
- event registry entries;
- database schema review;
- Ledger mapping review;
- top-up amount validation policy;
- manual review workflow;
- test scenarios for duplicate `PaymentCompleted`, closed account late payment, suspended account credit, top-up mismatch, purchase reservation, bonus spending, referral reward and birthday reward.

---

# 16. Documentation Scope

This document is documentation-only.

It does not introduce application code, frontend code, backend runtime code, Telegram bot code, provider calls, webhook handlers, database migrations, Prisma schema changes, environment variables, generated build output, Club Account transaction implementation, Bonus implementation, Discount implementation, Order transition implementation or Machine dispatch behavior.
