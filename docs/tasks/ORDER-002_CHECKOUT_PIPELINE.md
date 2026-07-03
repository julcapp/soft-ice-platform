# ORDER-002 Checkout Pipeline

Status: Architecture documented
Version: 0.1
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-02
Last updated: 2026-07-02

Related documents:

- `docs/architecture/CHECKOUT.md`
- `docs/architecture/ORDER_PLATFORM.md`
- `docs/architecture/CONFIGURATION_ENGINE.md`
- `docs/architecture/PRICING_ENGINE.md`
- `docs/architecture/DISCOUNT_ENGINE.md`
- `docs/architecture/BONUS_ENGINE.md`
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/architecture/EVENT_PLATFORM.md`
- `docs/tasks/EPIC-230_ORDER_PLATFORM.md`
- `docs/tasks/ORDER-001_ORDER_DOMAIN.md`

---

# Goal

Document the complete checkout pipeline from customer product selection to confirmed order creation, successful payment handling and machine queue handoff.

ORDER-002 is documentation only. It prepares future checkout implementation by defining the deterministic orchestration order, domain boundaries, failure handling, retry policy, idempotency and timeout rules.

---

# Business Value

The checkout pipeline protects the MVP purchase flow:

```text
A customer can select a dessert, pay for it and receive it from a vending machine.
```

Business value:

- customer payment starts only after product, configuration, availability, pricing, discount and bonus decisions are accepted;
- support can explain failed checkout, failed payment and failed machine preparation states;
- duplicate taps, refreshes, webhooks and retries do not create duplicate orders or duplicate payments;
- confirmed orders preserve immutable snapshots for audit, CRM, refunds and reporting;
- machine preparation starts only after payment success policy is satisfied.

---

# Required Pipeline

The canonical pipeline is:

1. Product selection.
2. Checkout intent creation.
3. Configuration validation.
4. Availability validation.
5. Pricing calculation.
6. Discount calculation.
7. Bonus reservation.
8. Order snapshot acceptance.
9. Payment initialization.
10. Payment confirmation.
11. Order confirmation.
12. Event publication.
13. Machine queue handoff.
14. Customer-visible fulfillment tracking.

The order is mandatory. Future implementation must not skip directly from UI selection to payment.

---

# Domain Boundaries

| Area | Owner | Checkout responsibility |
|---|---|---|
| Product facts | Product Catalog | Read selected semantic IDs and availability. |
| Configuration | Configuration Engine | Request validation and consume accepted result. |
| Availability | Product, Machine and channel policies | Validate before payment and revalidate when stale. |
| Gross pricing | Pricing Engine | Request Pricing Result and pass it forward. |
| Discounts | Discount Engine | Request Discount Result and accepted payable amount. |
| Bonuses | Bonus Engine | Reserve, redeem or release bonus rights through Bonus contracts. |
| Order history | Order Platform | Create accepted snapshots and later confirm paid order. |
| Payment | Payment Engine | Initialize settlement from accepted payable amount. |
| Financial truth | Ledger | Reference Ledger-backed payment facts. |
| Events | Event Platform | Publish facts after accepted state changes. |
| Machine queue | Machine Platform | Request fulfillment after Order confirmation. |

Checkout must not calculate prices, stack discounts, mutate bonuses, store payment credentials, write Ledger entries or send machine hardware commands.

---

# Acceptance Criteria

ORDER-002 is complete when:

- `docs/architecture/CHECKOUT.md` describes the full checkout pipeline from product selection to machine queue handoff;
- pipeline order includes product selection, configuration validation, availability validation, pricing calculation, discount calculation, bonus reservation, payment initialization, payment confirmation, order confirmation, event publication and machine queue;
- financial calculations are explicitly documented as occurring before payment;
- payment amount is explicitly derived from accepted payable amount;
- Order snapshot acceptance and post-confirmation immutability are documented;
- failure scenarios are documented;
- retry scenarios are documented;
- idempotency boundaries are documented;
- timeout handling is documented;
- architecture principles are documented;
- no application source code is modified;
- no frontend files are modified.

---

# Failure Handling Summary

Failure handling must follow these rules:

- invalid product or configuration fails before pricing;
- unavailable product, machine or payment method fails before payment;
- pricing or discount conflicts require recalculation before acceptance;
- bonus, coupon and wallet reservation failures must be released through owning domains;
- payment decline does not mutate pricing, discount or bonus rules;
- ambiguous payment result requires reconciliation before retry;
- payment success with fulfillment failure enters recovery, support or refund policy;
- event delivery failures are retried with the same event ID;
- machine queue or fulfillment failures must not edit payment history.

---

# Retry and Idempotency Summary

Retry behavior:

- retry only idempotent operations automatically;
- reconcile provider, Order, Bonus and Machine state before repeating side effects;
- preserve original correlation and causation IDs;
- use bounded retries and support review for repeated failures;
- prefer reconciliation over duplicate settlement or duplicate preparation.

Idempotency is required for:

- checkout intent creation;
- Order snapshot acceptance;
- bonus reservation, redemption and release;
- payment creation, callbacks and confirmation;
- event publication;
- fulfillment request and machine queue handoff;
- cancellation and timeout expiration.

---

# Timeout Summary

Timeouts are explicit states, not hidden UI failures.

Timeout handling must cover:

- checkout intent expiration;
- coupon and bonus reservation expiration;
- wallet reservation expiration;
- payment confirmation timeout;
- provider callback delay;
- Ledger recording delay;
- machine queue timeout;
- fulfillment timeout.

Temporary reservations must be released only through their owning domains.

---

# Out of Scope

ORDER-002 does not include:

- JavaScript implementation;
- frontend changes;
- Mini App UI changes;
- React component changes;
- payment provider integration;
- YooKassa credentials;
- machine hardware commands;
- database migrations;
- CRM screens;
- notification templates;
- cloud event bus implementation.

---

# Completion Evidence

Documentation updated:

- `docs/architecture/CHECKOUT.md`
- `docs/tasks/ORDER-002_CHECKOUT_PIPELINE.md`

Verification expected:

- documentation-only diff;
- no application source code changes;
- no generated build output.
