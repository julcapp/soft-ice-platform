# Discount Engine

Document code: ARCH-FIN-DISCOUNT-001
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
- `docs/architecture/BONUS_ENGINE.md`
- `docs/architecture/EVENT_PLATFORM.md`
- `docs/tasks/FINANCE-006_DISCOUNT_ENGINE.md`
- `docs/governance/ENGINEERING_PROCESS.md`
- `docs/governance/QUALITY_GATES.md`

---

# 1. Purpose

Discount Engine defines how Soft ICE Platform applies non-monetary price reductions to a priced order before payment.

Core rules:

- Discount is not money.
- Discount is not Wallet balance.
- Discount is not Bonus balance.
- Discount does not modify Ledger.
- Discount is calculated before payment.
- Discount may be combined only according to stacking rules.
- Discount publishes events after accepted discount decisions and lifecycle changes.

Discount Engine exists so the platform can:

- apply percentage discounts;
- apply fixed nominal price reductions;
- validate and apply coupons;
- apply campaign discounts;
- apply membership discounts;
- apply trusted customer discounts;
- coordinate bonus redemption as a discount effect;
- expose a stable discount result to checkout, Wallet, Payment, CRM, Reporting and future Promotion Engine;
- prevent unapproved discount stacking and abuse.

A discount amount may be expressed in `RUB` for calculation and reporting. That expression is a price reduction, not stored money and not a customer asset.

---

# 2. Architecture Role

Discount Engine is the policy layer between gross pricing and payment.

Architecture position:

```text
Product Configuration
->
Pricing Engine
->
Pricing Result with gross amount
->
Discount Engine
->
Discount Result with payable amount
->
Wallet / Payment / Order flow
```

Discount Engine owns:

- discount rule lifecycle;
- discount eligibility evaluation;
- discount stacking rules;
- discount priority rules;
- coupon validation and usage state;
- discount calculation lines;
- discount events;
- discount fraud controls.

Discount Engine does not own:

- product catalog;
- product configuration validation;
- recipe calculation;
- base price calculation;
- bonus accrual, reservation or expiration;
- Wallet cash balance;
- external payment attempts;
- Ledger entries;
- accounting;
- CRM screens;
- notification templates;
- vending machine commands.

Discount Engine consumes a `Pricing Result` and returns a `Discount Result`. The `Discount Result` may be referenced by Transaction, Order, Ledger, CRM and Reporting, but Discount Engine itself does not create financial Ledger entries.

---

# 3. Discount Lifecycle

Discount rules and discount applications have separate lifecycles.

Discount rule lifecycle:

```text
draft
->
approved
->
scheduled
->
active
|-> paused -> active
|-> expired
|-> archived
```

Discount application lifecycle:

```text
candidate
->
eligible
->
selected
->
calculated
->
applied_to_pricing
|-> rejected
|-> cancelled
|-> expired
```

Coupon usage may add a temporary reservation lifecycle:

```text
available
->
reserved
|-> redeemed
|-> released
|-> expired
|-> cancelled
```

Lifecycle rules:

- draft rules cannot affect checkout;
- approved rules require Product Owner or authorized operator approval;
- scheduled rules become active only inside their configured time window;
- active rules can be evaluated for eligibility;
- paused rules are retained but not applied;
- expired rules are not applied to new checkouts;
- archived rules remain available for audit and reporting;
- rule edits create a new rule version;
- historical discount results keep the rule version that produced them;
- every meaningful lifecycle transition should publish an event.

---

# 4. Discount Types

Supported discount types:

| Type | Purpose | Primary owner |
|---|---|---|
| `percentage` | Reduce an eligible amount by a percent. | Discount Engine |
| `fixed` | Reduce an eligible amount by a fixed nominal amount. | Discount Engine |
| `coupon` | Apply a code-bound discount with usage rules. | Discount Engine |
| `campaign` | Apply an automatic or targeted promotion. | Discount Engine now, Promotion Engine later |
| `membership` | Apply customer membership or tier benefit. | Discount Engine with CRM/Loyalty source |
| `trusted_customer` | Apply approved customer-specific trust benefit. | Discount Engine with CRM/support source |
| `bonus_redemption` | Represent redeemed bonus rights as discount effect. | Bonus Engine owns rights; Discount Engine owns stacking and final effect |

Common rule fields:

```json
{
  "discount_rule_id": "discount_rule_01JZ0000000000000000000000",
  "discount_type": "percentage",
  "rule_version": 1,
  "status": "active",
  "priority": 100,
  "stack_group": "automatic_campaign",
  "exclusive_group": "campaign",
  "starts_at": "2026-07-02T00:00:00Z",
  "ends_at": "2026-08-01T00:00:00Z"
}
```

Discount rules must use stable IDs and rule versions. UI labels and translated campaign names are not rule identities.

---

# 5. Percentage Discounts

Percentage discounts reduce an eligible base amount by a configured percent.

Rules:

- percentage value must be explicit and versioned;
- calculation base must be explicit: product, line item, order subtotal or remaining eligible amount;
- percentage discount cannot make payable amount negative;
- percentage discount may have a maximum nominal cap;
- percentage discount may have a minimum gross amount;
- percentage discount may be limited by product, category, machine, location, channel, customer segment or date range;
- rounding policy must be deterministic and documented;
- MVP currency is `RUB`, with integer minor calculation until a more precise money model is approved;
- percentage discounts must not be calculated inside UI components.

Example:

```json
{
  "discount_type": "percentage",
  "percent": 10,
  "calculation_base": "order_subtotal",
  "max_discount_amount": 50,
  "currency": "RUB"
}
```

The calculated result is a price reduction line. It is not money credited to the customer.

---

# 6. Fixed Discounts

Fixed discounts reduce an eligible price by a configured nominal amount.

Rules:

- fixed discount amount must include currency for calculation context;
- fixed discount amount is not Wallet balance;
- fixed discount amount is not a cash payout;
- fixed discount cannot exceed the eligible remaining amount unless a zero-payable order policy is explicitly approved;
- fixed discount cannot create change, debt or customer receivable;
- fixed discount may be limited to product, category, channel, campaign, customer segment or order minimum;
- fixed discount must preserve rule ID and rule version in the discount result;
- fixed discount must not modify Ledger.

Example:

```json
{
  "discount_type": "fixed",
  "discount_amount": 30,
  "currency": "RUB",
  "calculation_base": "order_subtotal"
}
```

The fixed amount is used only to reduce the payable price in the approved checkout flow.

---

# 7. Coupon Discounts

Coupon discounts are code-bound discounts with validation, eligibility and usage rules.

Coupon rules:

- coupon code must be normalized before validation;
- stored coupon secrets should be hashed or otherwise protected when implementation begins;
- coupon validation must be idempotent;
- coupon may be single-use, limited-use or campaign-scoped;
- coupon may be limited by customer, segment, product, machine, location, channel, time window or minimum order amount;
- coupon cannot be applied after payment;
- coupon cannot bypass stacking rules;
- coupon usage must be reserved during checkout when duplicate use is possible;
- coupon reservation must expire or be released when checkout fails;
- coupon redemption is a usage state change, not a Ledger entry.

Coupon lifecycle example:

```text
CouponValidated
->
CouponReserved
->
CouponRedeemed
```

Failure path:

```text
CouponReserved
->
CouponReservationReleased
```

Coupon events must not expose sensitive coupon secrets beyond what consumers need.

---

# 8. Campaign Discounts

Campaign discounts support marketing and promotional activity.

Campaign examples:

- opening promotion;
- seasonal campaign;
- machine-specific campaign;
- location-specific campaign;
- product launch discount;
- birthday campaign;
- win-back campaign;
- partner campaign.

Rules:

- campaign discount must include `campaign_id`, `discount_rule_id` and `rule_version`;
- campaign eligibility must be deterministic;
- campaign budget or usage limits must be enforced when configured;
- campaign edits must not change historical discount meaning;
- automatic campaign discounts must still pass stacking and priority checks;
- campaign discount result must be visible in reporting;
- campaign discount is not Bonus accrual;
- campaign discount is not Wallet balance;
- campaign discount does not modify Ledger.

Future Promotion Engine will own campaign authoring and eligibility. Until then, Discount Engine documentation defines the execution boundary for campaign discounts.

---

# 9. Membership Discounts

Membership discounts are benefits based on customer membership, tier or loyalty status.

Examples:

- Club Timofey member discount;
- tier-based discount;
- returning customer discount;
- birthday member discount when implemented through membership rules.

Rules:

- membership status must come from an approved CRM, Customer or Loyalty source;
- Discount Engine must not infer membership from UI state;
- membership discount must include the source membership ID or tier reference;
- membership discount can be automatic if eligibility is already trusted;
- membership discount can stack only according to stacking rules;
- membership discount must be recalculated for each checkout;
- membership discount does not create Wallet cash;
- membership discount does not accrue bonuses by itself unless a separate Bonus rule exists.

Membership events should allow CRM and Reporting to understand which tier or membership state produced the discount without exposing unnecessary personal data.

---

# 10. Trusted Customer Discounts

Trusted customer discounts are approved customer-specific benefits for high-trust, VIP, support or operational cases.

Use cases:

- support recovery after a failed experience;
- VIP customer appreciation;
- controlled operator-approved discount;
- internal test customer under approved policy;
- partner or owner-approved special case.

Rules:

- trusted customer discount requires explicit source and approval;
- operator-created trusted discounts require actor ID, reason and audit metadata;
- trusted customer discount must have a validity window;
- trusted customer discount should have a maximum amount, maximum percent or usage limit;
- trusted customer discount is exclusive by default unless Product Owner approves stacking;
- trusted customer discount must be visible in CRM audit;
- trusted customer discount cannot be hidden inside UI;
- trusted customer discount cannot modify Wallet or Ledger directly.

Trusted customer discounts are fraud-sensitive. Every application should publish an event suitable for CRM, support and fraud review.

---

# 11. Stacking Policy

Stacking policy defines which discounts may be combined.

Default stacking rules:

- no discount stacks unless the involved rules explicitly allow it;
- rules in the same `exclusive_group` do not stack;
- only one coupon can be applied to one checkout unless a rule explicitly allows multiple coupons;
- coupon and campaign discounts do not stack by default;
- trusted customer discount is exclusive by default;
- membership discount may stack only with approved campaign, coupon or bonus rules;
- bonus redemption may stack only when the discount result explicitly allows bonus redemption after other discounts;
- total discount amount cannot exceed the eligible payable amount;
- final payable amount cannot be negative;
- zero-payable orders require explicit Order and Payment policy before implementation.

Recommended stack groups:

| Stack group | Default behavior |
|---|---|
| `automatic_campaign` | At most one active rule unless configured otherwise. |
| `coupon` | At most one coupon per checkout. |
| `membership` | May stack only with approved groups. |
| `trusted_customer` | Exclusive by default. |
| `bonus_redemption` | Applied only within approved bonus cap and remaining payable amount. |

Stacking is a contract. UI must not combine discounts locally.

---

# 12. Priority Rules

Priority rules make discount calculation deterministic.

Priority inputs:

- explicit `priority` number;
- `exclusive_group`;
- `stack_group`;
- `calculation_base`;
- eligibility window;
- customer segment;
- rule version;
- optional customer-benefit tie breaker when approved.

Default evaluation order:

1. Validate Pricing Result and checkout context.
2. Load active discount rules for the channel, product, customer and machine context.
3. Filter rules by eligibility.
4. Validate coupon if customer supplied one.
5. Resolve exclusive groups by configured priority.
6. Apply allowed automatic, membership, trusted or coupon rules according to priority.
7. Calculate bonus redemption limit after approved non-bonus discounts unless a rule explicitly defines another base.
8. Enforce maximum total discount and minimum payable constraints.
9. Produce a Discount Result with all accepted and rejected discount lines.
10. Publish discount events.

If two rules conflict and no deterministic priority exists, Discount Engine must reject the ambiguous combination instead of silently guessing.

---

# 13. Pricing Interaction

Pricing Engine calculates product price. Discount Engine applies discount policy to an already calculated price.

Pricing responsibilities:

- product base price;
- ingredient or option price;
- configuration price;
- recipe-related price inputs;
- gross order amount;
- currency.

Discount responsibilities:

- discount eligibility;
- discount amount calculation;
- stacking;
- priority;
- payable amount after discounts;
- accepted and rejected discount lines;
- discount event publishing.

Input example:

```json
{
  "pricing_result_id": "pricing_result_01JZ0000000000000000000000",
  "order_id": "order_01JZ0000000000000000000000",
  "gross_amount": 130,
  "currency": "RUB"
}
```

Output example:

```json
{
  "discount_result_id": "discount_result_01JZ0000000000000000000000",
  "pricing_result_id": "pricing_result_01JZ0000000000000000000000",
  "gross_amount": 130,
  "currency": "RUB",
  "discount_lines": [
    {
      "discount_rule_id": "discount_rule_member_10",
      "discount_type": "membership",
      "rule_version": 1,
      "discount_amount": 13
    }
  ],
  "total_discount_amount": 13,
  "payable_amount": 117
}
```

`payable_amount` is the amount passed to Wallet and Payment flows. It is calculated before payment.

---

# 14. Wallet Interaction

Wallet owns internal cash balance projection. Discount Engine owns price reductions.

Rules:

- Discount Engine never reads Wallet balance to invent discounts.
- Discount Engine never mutates Wallet.
- Discount Engine never creates Wallet deposits.
- Discount Engine never reserves Wallet funds.
- Wallet receives the payable amount after discount calculation.
- Wallet reservation, capture and release happen after discount calculation.
- Wallet balance display must not include discounts as customer money.
- If a discount reduces the payable amount, Wallet reserves only the remaining payable amount when internal balance is used.

Example:

```text
Gross amount: 130 RUB
Discount amount: 30 RUB
Payable amount: 100 RUB
Wallet reserve: 100 RUB if wallet payment is selected
```

The customer did not receive 30 RUB in Wallet. The order price was reduced by 30 RUB.

---

# 15. Bonus Interaction

Bonus rights are not money. Bonus Engine owns bonus lifecycle. Discount Engine owns the final discount effect and stacking policy.

Rules:

- Bonus Engine owns accrual, activation, reservation, redemption, release, expiration and cancellation of bonus rights.
- Discount Engine never creates bonus rights.
- Discount Engine never stores bonus balance.
- Bonus redemption enters checkout as a discount input.
- Discount Engine determines whether bonus redemption may stack with other discounts.
- Discount Engine calculates the maximum allowed bonus discount for the current discount context.
- Bonus Engine validates and reserves the selected bonus amount.
- Final Discount Result references the bonus reservation or redemption ID when bonuses are used.
- Bonus redemption cannot make payable amount negative.
- If checkout fails, Bonus Engine releases the bonus reservation.
- If checkout succeeds, Bonus Engine redeems the reserved bonus rights.

Example:

```text
Gross amount: 130 RUB
Membership discount: 13 RUB
Allowed bonus redemption: up to 117 bonuses
Selected bonus redemption: 20 bonuses
Final payable amount: 97 RUB
```

The 20 bonuses create a 20 RUB discount effect. They are not Wallet money and do not modify Ledger by themselves.

---

# 16. Payment Interaction

Payment Engine owns payment attempts and provider integration. Discount Engine calculates the payable amount before Payment Engine starts collection.

Rules:

- payment amount must be based on the accepted Discount Result;
- Payment Engine must not recalculate discounts;
- Discount Engine must not call YooKassa, SBP, bank card APIs or other payment providers;
- discounts cannot be applied after payment capture except through refund or correction flows owned by Order, Payment and Finance policies;
- payment failure does not mutate discount rules;
- coupon and bonus reservations must be released when payment or checkout fails;
- payment events should reference `discount_result_id` when available;
- Payment Engine must not treat discount amount as received money.

Payment flow:

```text
Pricing Result
->
Discount Result
->
Wallet reservation if internal balance is used
->
Payment Engine collects payable amount
->
PaymentCompleted or PaymentFailed
->
Order / Wallet / Bonus / Coupon usage follow-up
```

---

# 17. CRM Interaction

CRM consumes discount events and may provide customer context for eligibility.

CRM may use Discount data for:

- customer discount history;
- coupon usage history;
- campaign participation;
- membership benefit visibility;
- trusted customer approval and audit;
- support investigation;
- fraud review;
- segmentation and retention analysis;
- reporting and campaign ROI.

Rules:

- CRM is not the source of truth for discount calculation.
- CRM must not edit discount results directly.
- CRM operator actions must call approved commands when implementation exists.
- operator-created discounts require actor ID, reason and audit metadata.
- CRM projections are derived from Discount events and read models.
- CRM must label discounts as price reductions, not money or wallet balance.
- CRM must not expose coupon secrets or unnecessary personal data.

---

# 18. Events

Discount Engine publishes events after accepted rule lifecycle changes, discount calculations and coupon usage state changes.

Event rules:

- event names use English PascalCase;
- payload fields use snake_case;
- payloads include stable IDs;
- payloads include `discount_rule_id` and `rule_version` when a rule is involved;
- events must not include payment credentials, provider secrets or raw sensitive coupon secrets;
- consumers must be idempotent;
- Event Storage does not replace Ledger;
- Discount events are facts, not commands.

Published events:

| Event | Type | Meaning |
|---|---|---|
| `DiscountRuleCreated` | domain | Discount rule draft was created. |
| `DiscountRuleApproved` | domain/integration | Discount rule was approved for use. |
| `DiscountRuleActivated` | domain/integration | Discount rule became active. |
| `DiscountRulePaused` | domain/integration | Discount rule was paused. |
| `DiscountRuleExpired` | domain/integration | Discount rule expired. |
| `DiscountCalculated` | domain | Discount calculation completed. |
| `DiscountApplied` | domain/integration | Discount result was accepted by checkout. |
| `DiscountRejected` | domain | Candidate discount was rejected. |
| `CouponValidated` | domain | Coupon code was validated. |
| `CouponReserved` | domain/integration | Coupon usage was reserved for checkout. |
| `CouponReservationReleased` | domain/integration | Coupon usage reservation was released. |
| `CouponRedeemed` | domain/integration | Coupon usage was consumed by completed checkout. |
| `CampaignDiscountApplied` | integration | Campaign discount affected a checkout. |
| `MembershipDiscountApplied` | integration | Membership discount affected a checkout. |
| `TrustedCustomerDiscountApplied` | integration | Trusted customer discount affected a checkout. |
| `DiscountFraudReviewRequested` | integration | Discount activity requires review. |

Minimal event payload example:

```json
{
  "discount_result_id": "discount_result_01JZ0000000000000000000000",
  "pricing_result_id": "pricing_result_01JZ0000000000000000000000",
  "order_id": "order_01JZ0000000000000000000000",
  "customer_id": "customer_01JZ0000000000000000000000",
  "gross_amount": 130,
  "total_discount_amount": 13,
  "payable_amount": 117,
  "currency": "RUB",
  "discount_lines": [
    {
      "discount_rule_id": "discount_rule_member_10",
      "discount_type": "membership",
      "rule_version": 1,
      "discount_amount": 13
    }
  ]
}
```

---

# 19. Fraud Prevention

Discount Engine must protect promotional value from abuse.

Required controls:

- idempotency keys for every discount calculation and coupon reservation command;
- duplicate coupon redemption detection;
- coupon brute-force protection;
- customer, device, account, machine and payment velocity checks where legally allowed;
- campaign budget and usage cap enforcement;
- per-customer and per-order maximum discount limits;
- exclusive group enforcement;
- prevention of hidden UI-only discounts;
- operator action audit for trusted customer discounts;
- reason and approval metadata for manual discounts;
- suspicious stacking detection;
- time-window validation using trusted server time;
- coupon reservation expiry;
- event-driven fraud review queue;
- secure handling of coupon codes and secrets;
- personal data minimization in events and logs.

Fraud review rules:

- suspected abuse may reject a discount candidate or request review;
- fraud review must not mutate historical discount results directly;
- corrections use explicit cancellation, reversal or support workflows;
- Discount Engine can publish `DiscountFraudReviewRequested`;
- Wallet freeze or customer account freeze belongs to Wallet, Customer, CRM or Identity domains, not Discount Engine itself.

---

# 20. Future Promotion Engine Integration

Promotion Engine will eventually own campaign authoring, eligibility configuration and marketing budgets.

Future split:

| Area | Owner |
|---|---|
| Campaign authoring | Promotion Engine |
| Campaign approval workflow | Promotion Engine / Product Owner |
| Segment eligibility definition | Promotion Engine / CRM |
| Campaign budget and caps | Promotion Engine |
| Coupon batch generation | Promotion Engine or Discount Engine by approved contract |
| Coupon validation and usage state | Discount Engine |
| Discount calculation | Discount Engine |
| Stacking and priority | Discount Engine |
| Bonus accrual and redemption rights | Bonus Engine |
| Payment collection | Payment Engine |
| Wallet balance | Wallet Engine |
| Financial history | Ledger |
| Customer support view | CRM |
| Messaging | Notification Engine |
| Campaign reporting | Reporting / Analytics consuming events |

Integration rules:

- Promotion Engine sends approved campaign definitions or commands to Discount Engine;
- every campaign discount carries `campaign_id`, `discount_rule_id` and `rule_version`;
- campaign edits create new versions and do not rewrite historical discount results;
- Discount Engine remains the runtime authority for stacking and payable amount calculation;
- Promotion Engine must not mutate Wallet or Ledger through discount rules;
- future AI modules may suggest campaigns, but approved Promotion and Discount rules execute them.

---

# 21. Architecture Principles

Discount architecture follows these principles:

1. Discount is not money.
2. Discount is not Wallet balance.
3. Discount does not modify Ledger.
4. Discount is calculated before payment.
5. Discount may be combined only according to stacking rules.
6. Discount Engine publishes events.
7. Pricing calculates gross price.
8. Discount Engine calculates discount effect and payable amount.
9. Bonus Engine owns bonus rights; Discount Engine owns bonus stacking and final discount effect.
10. Wallet reserves or captures only the payable amount after discounts.
11. Payment collects only the payable amount after discounts.
12. Coupon usage is state, not money.
13. Campaign rules are versioned.
14. Historical discount results are immutable records of the rule version used.
15. UI must not calculate or stack discounts locally.
16. CRM consumes discount events and read models; it is not the calculation authority.
17. Fraud controls are mandatory for coupons, campaigns and trusted customer discounts.
18. Future Promotion Engine can author campaigns without replacing Discount Engine calculation.

---

# 22. Readiness Criteria

Discount architecture is ready for implementation when:

- Discount command, query and event contracts are approved;
- Pricing Result contract is stable enough to provide gross amount and currency;
- Bonus interaction contract is approved for redemption limit, reservation and release;
- Wallet separation is confirmed;
- Ledger non-mutation rule is confirmed;
- Payment uses Discount Result payable amount;
- coupon validation and reservation policy is approved;
- stacking groups and priority rules are approved;
- campaign rule versioning is approved;
- fraud controls are defined for coupons, campaigns and trusted customer discounts;
- test scenarios cover percentage, fixed, coupon, campaign, membership, trusted customer, bonus interaction, stacking and payment boundary behavior.

---

# 23. Documentation Scope

This document is architecture-only.

It does not introduce JavaScript implementation, frontend changes, routes, styles, package changes, database migrations, payment provider integration, CRM screens, notification templates, Promotion Engine implementation or cloud infrastructure.
