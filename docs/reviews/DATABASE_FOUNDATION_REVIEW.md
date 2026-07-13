# Database Foundation Consistency Review

Document code: REVIEW-DATABASE-FOUNDATION-001
Task: EPIC-351 / DATA-002 consistency review
Status: Completed
Date: 2026-07-13
Project: Soft ICE Platform / Utimoshi
Scope: Documentation only

Reviewed documents:

- `docs/data/DATABASE_FOUNDATION.md`
- `docs/data/PLATFORM_DATA_MODEL.md`
- `docs/architecture/PROJECT_DECISIONS.md`
- `docs/architecture/MVP_BACKEND_ARCHITECTURE.md`
- `docs/domain/CLUB_ACCOUNT.md`
- `docs/domain/BONUS_DOMAIN.md`
- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/domain/MACHINE_DOMAIN.md`

---

# 1. Review Verdict

`docs/data/DATABASE_FOUNDATION.md` is broadly consistent with the current platform architecture and `docs/architecture/PROJECT_DECISIONS.md`.

No blocking architecture conflict was found.

The document correctly preserves:

- Club Account and Bonus Account separation;
- provider-agnostic payment direction;
- append-only payment operation and financial-adjacent records;
- machine execution as a paid-fulfillment boundary;
- PostgreSQL and Prisma as future implementation direction without creating migrations or tables.

The main follow-up is clarification before physical database design: the foundation should make the existing `Payment` aggregate and `PaymentSession` role explicit so future Prisma models do not collapse intent, payment attempt, session and operation concepts.

---

# 2. Findings

## P2 - Payment aggregate is underrepresented in the foundation relationship model

`DATABASE_FOUNDATION.md` documents `PaymentIntent` and `PaymentOperation` as core entities and states `PaymentIntent -> PaymentOperation` as a direct 1 -> N relationship (`docs/data/DATABASE_FOUNDATION.md:338`, `docs/data/DATABASE_FOUNDATION.md:397`, `docs/data/DATABASE_FOUNDATION.md:598`).

The surrounding model defines a separate `Payment` aggregate with `payment_id` as platform payment identity. `Payment` owns method lines, sessions and operations, while `PaymentIntent` groups approved collection purpose and attempts (`docs/data/PLATFORM_DATA_MODEL.md:323`, `docs/data/PLATFORM_DATA_MODEL.md:324`, `docs/data/PLATFORM_DATA_MODEL.md:326`, `docs/data/PLATFORM_DATA_MODEL.md:328`, `docs/data/PLATFORM_DATA_MODEL.md:459`, `docs/data/PLATFORM_DATA_MODEL.md:461`). `Payment Domain` also treats `Payment ID` as a stable platform identifier and has first-class payment session and operations registry sections (`docs/domain/PAYMENT_DOMAIN.md:153`, `docs/domain/PAYMENT_DOMAIN.md:575`, `docs/domain/PAYMENT_DOMAIN.md:1106`).

Impact:

Future schema work could accidentally attach operations directly to intents and skip the `Payment` aggregate or `PaymentSession` entity. That would weaken support for retries, mixed methods, replacement sessions, provider-specific attempts and reconciliation.

Recommendation:

Before Prisma schema work, update the foundation or implementation task to state that:

- `PaymentIntent` defines approved purpose, amount and policy;
- `Payment` or payment attempt is the platform payment identity for a concrete collection attempt;
- `PaymentSession` is the limited-lifetime confirmation context;
- `PaymentOperation` is append-only and normally references `payment_id`, with `payment_intent_id` retained for correlation.

## P3 - Payment lifecycle and operation naming should be aligned before DDL

The foundation uses intent lifecycle states `created`, `awaiting_confirmation`, `processing`, `completed` and operation names such as `intent_created` and `session_created` (`docs/data/DATABASE_FOUNDATION.md:371`, `docs/data/DATABASE_FOUNDATION.md:373`, `docs/data/DATABASE_FOUNDATION.md:375`, `docs/data/DATABASE_FOUNDATION.md:377`, `docs/data/DATABASE_FOUNDATION.md:424`, `docs/data/DATABASE_FOUNDATION.md:425`).

`PAYMENT_DOMAIN.md` uses a richer split: intent states such as `draft`, `active`, `session_created`, `confirmed`, session states such as `created`, `active`, `awaiting_customer`, `provider_processing`, and operation names such as `payment_intent_created`, `payment_created`, `payment_session_created` (`docs/domain/PAYMENT_DOMAIN.md:540`, `docs/domain/PAYMENT_DOMAIN.md:547`, `docs/domain/PAYMENT_DOMAIN.md:557`, `docs/domain/PAYMENT_DOMAIN.md:600`, `docs/domain/PAYMENT_DOMAIN.md:606`, `docs/domain/PAYMENT_DOMAIN.md:1140`, `docs/domain/PAYMENT_DOMAIN.md:1141`, `docs/domain/PAYMENT_DOMAIN.md:1142`).

Impact:

This is not an architecture conflict, but it can create enum drift if database tables are introduced from the shorter foundation vocabulary.

Recommendation:

Choose one canonical enum set during the future payment schema task. Prefer the Payment Domain naming for concrete payment tables because it already distinguishes intent, payment aggregate, session and operation.

## P3 - Club Account wording can be confused with Wallet

The foundation calls `ClubAccount` a "prepaid wallet" and "prepaid customer wallet" (`docs/data/DATABASE_FOUNDATION.md:239`, `docs/data/DATABASE_FOUNDATION.md:251`).

The Club Account domain says the Club Account is not a bank account and that its balance is not bonus balance (`docs/domain/CLUB_ACCOUNT.md:53`, `docs/domain/CLUB_ACCOUNT.md:55`). The platform data model also defines `Wallet` as a separate monetary projection and `Club Account` as a separate customer-facing prepaid model (`docs/data/PLATFORM_DATA_MODEL.md:226`).

Impact:

The current meaning is understandable, but future database naming could blur `club_account` and `wallet` ownership.

Recommendation:

Use "prepaid account" or "customer-facing prepaid account" in future revisions and reserve `Wallet` for the Ledger-backed Wallet boundary.

## P3 - Club Account transaction naming differs from the domain document

The foundation uses `purchase_debit` for completed purchase settlement (`docs/data/DATABASE_FOUNDATION.md:277`).

`CLUB_ACCOUNT.md` uses `purchase_capture` for reserved funds spent and exposes `ClubAccounts.SpendingCaptured` as the event name (`docs/domain/CLUB_ACCOUNT.md:553`, `docs/domain/CLUB_ACCOUNT.md:1320`).

Impact:

This is minor, but transaction type drift can make projections, support views and test scenarios harder to reconcile.

Recommendation:

Before storage implementation, align the Club Account transaction enum. `purchase_capture` is closer to the domain language already in use.

## P3 - Payment provider, method and presentation terms should stay distinct

The foundation supports multiple providers and correctly keeps provider references out of platform identity (`docs/data/DATABASE_FOUNDATION.md:363`, `docs/data/DATABASE_FOUNDATION.md:612`, `docs/data/DATABASE_FOUNDATION.md:655`). It also says "SBP, QR, payment links, cards, Club Account and future methods use the same payment model" under multiple payment providers (`docs/data/DATABASE_FOUNDATION.md:659`).

This agrees with the Payment Domain direction, but mixes provider, method and presentation terms in one sentence. YooKassa is a provider. Cards, SBP and Club Account are methods or method lines. QR and payment links are confirmation presentations.

Impact:

No immediate conflict. The risk appears during schema design if `provider`, `method_type` and `confirmation_type` are collapsed into one field.

Recommendation:

Future schema work should keep at least:

- `provider` for external adapter/provider identity;
- `method_type` for card, SBP, Club Account, Wallet and future methods;
- `confirmation_type` for QR, payment link, redirect or similar session presentation.

---

# 3. Requested Consistency Checks

## 3.1 ClubAccount and BonusAccount separation

Verdict: Pass.

The foundation defines separate owners, IDs, responsibilities and transaction histories for `ClubAccount` and `BonusAccount` (`docs/data/DATABASE_FOUNDATION.md:239`, `docs/data/DATABASE_FOUNDATION.md:293`). It explicitly states that bonus points are not money, not Club Account balance and not a payment method (`docs/data/DATABASE_FOUNDATION.md:314`, `docs/data/DATABASE_FOUNDATION.md:315`, `docs/data/DATABASE_FOUNDATION.md:316`).

This matches:

- `PROJECT_DECISIONS.md` decision language that Club Account prepaid balance and Bonus Account discount points are separate domains with separate transaction histories (`docs/architecture/PROJECT_DECISIONS.md:51`);
- `PLATFORM_DATA_MODEL.md` model principle that Club Account prepaid balance and Bonus Account are separate (`docs/data/PLATFORM_DATA_MODEL.md:99`);
- `BONUS_DOMAIN.md` rule that bonus is not money and redemption creates a discount effect before payment (`docs/domain/BONUS_DOMAIN.md:60`, `docs/domain/BONUS_DOMAIN.md:65`).

No architecture conflict found.

## 3.2 PaymentIntent and PaymentOperation boundaries

Verdict: Pass with clarification required.

The foundation correctly defines:

- `PaymentIntent` as provider-independent request to collect money for an approved purpose (`docs/data/DATABASE_FOUNDATION.md:340`);
- `PaymentOperation` as append-only accepted payment-related action or fact (`docs/data/DATABASE_FOUNDATION.md:399`);
- provider payment IDs as references, not platform IDs (`docs/data/DATABASE_FOUNDATION.md:361`);
- no secrets, raw card data or raw webhook signatures inside `PaymentOperation` (`docs/data/DATABASE_FOUNDATION.md:445`);
- Order dispatch only after Payment Runtime accepts a completed payment fact (`docs/data/DATABASE_FOUNDATION.md:366`).

This matches `DECISION-034`, `DECISION-035`, `DECISION-036` and `DECISION-041`.

The clarification is the P2 finding above: `Payment`, `PaymentSession`, `PaymentMethodLine` and `RefundOperation` are already first-class in the logical platform model and should not disappear during physical design.

## 3.3 Support for multiple payment providers

Verdict: Pass.

The foundation explicitly states readiness for multiple payment providers (`docs/data/DATABASE_FOUNDATION.md:53`) and names YooKassa, SBP, QR payments, payment links and future providers as using the same intent model (`docs/data/DATABASE_FOUNDATION.md:363`).

It also requires provider name and masked provider references on payment operations while keeping provider payloads in protected integration records (`docs/data/DATABASE_FOUNDATION.md:417`, `docs/data/DATABASE_FOUNDATION.md:612`, `docs/data/DATABASE_FOUNDATION.md:714`).

This is consistent with:

- `DECISION-036 - Payment Provider Agnostic Model` (`docs/architecture/PROJECT_DECISIONS.md:372`);
- `DECISION-035 - Financial Registry Is Internal` (`docs/architecture/PROJECT_DECISIONS.md:437`);
- the MVP backend schema direction for payment module ownership (`docs/architecture/MVP_BACKEND_ARCHITECTURE.md:501`).

No architecture conflict found. The only follow-up is the provider/method/presentation terminology split noted above.

## 3.4 Machine scalability model

Verdict: Pass with future detail recommended.

The foundation supports multiple vending machines from the beginning (`docs/data/DATABASE_FOUNDATION.md:623`) and requires stable `machine_id`, vendor aliases, location/configuration references, order fulfillment references, machine-scoped telemetry, readiness projections and idempotent paid dispatch.

It also states that multiple machines must not require changes to Order, Payment or Customer identity models and explicitly supports multiple machines per location (`docs/data/DATABASE_FOUNDATION.md:529`, `docs/data/DATABASE_FOUNDATION.md:535`).

This is consistent with:

- Machine Domain ownership of identity, lifecycle, location, configuration, capabilities, dispatch queue, commands, operation outcomes, inventory and telemetry (`docs/architecture/PROJECT_DECISIONS.md:190`);
- Platform Data Model support for `MachineGroup`, `Location`, `Machine`, `DispatchQueueEntry`, `MachineOperation`, telemetry and incidents (`docs/data/PLATFORM_DATA_MODEL.md:363`, `docs/data/PLATFORM_DATA_MODEL.md:364`, `docs/data/PLATFORM_DATA_MODEL.md:365`, `docs/data/PLATFORM_DATA_MODEL.md:468`, `docs/data/PLATFORM_DATA_MODEL.md:469`, `docs/data/PLATFORM_DATA_MODEL.md:472`, `docs/data/PLATFORM_DATA_MODEL.md:473`);
- MVP backend rule that machine module creates dispatch queue entries for paid orders only (`docs/architecture/MVP_BACKEND_ARCHITECTURE.md:438`).

No conflict found. Future physical schema work should include the supporting entities already named in the Platform Data Model, not only `Machine` and `MachineEvent`.

## 3.5 Architecture conflicts with PROJECT_DECISIONS.md

Verdict: No blocking conflict found.

`DATABASE_FOUNDATION.md` aligns with the current accepted decisions:

- `DECISION-041` accepts the database foundation strategy and restates the exact separation, immutability, provider-agnostic payment and machine boundary rules (`docs/architecture/PROJECT_DECISIONS.md:9`, `docs/architecture/PROJECT_DECISIONS.md:51`, `docs/architecture/PROJECT_DECISIONS.md:53`, `docs/architecture/PROJECT_DECISIONS.md:57`);
- `DECISION-040` keeps the MVP as one backend deployable and one primary PostgreSQL database, while preserving module boundaries (`docs/architecture/PROJECT_DECISIONS.md:88`, `docs/architecture/PROJECT_DECISIONS.md:110`, `docs/architecture/PROJECT_DECISIONS.md:132`);
- `DECISION-039` keeps Machine Domain outside payment decisions (`docs/architecture/PROJECT_DECISIONS.md:170`);
- `DECISION-036` keeps Payment provider agnostic (`docs/architecture/PROJECT_DECISIONS.md:372`);
- `DECISION-034` requires an internal append-only Payment Operations Registry (`docs/architecture/PROJECT_DECISIONS.md:494`).

The foundation is also correctly documentation-only and does not create runtime code, migrations or tables (`docs/data/DATABASE_FOUNDATION.md:46`, `docs/data/DATABASE_FOUNDATION.md:117`).

---

# 4. Conclusion

`DATABASE_FOUNDATION.md` is consistent enough to remain accepted as the database foundation v1 strategy.

Recommended next action before implementation:

```text
Create a follow-up documentation or schema-prep task to align Payment aggregate/session terminology, payment operation enum names and Club Account transaction naming before Prisma models are created.
```
