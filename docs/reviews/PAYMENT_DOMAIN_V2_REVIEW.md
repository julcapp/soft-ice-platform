# Payment Domain v2 Architecture Review

Document code: REVIEW-PAYMENT-DOMAIN-V2-001
Task: FINANCE-009 / PAYMENT-DOMAIN-V2 architecture review
Status: Completed
Date: 2026-07-13
Project: Soft ICE Platform / Utimoshi
Scope: Documentation only

Reviewed documents:

- `docs/domain/PAYMENT_DOMAIN_V2.md`
- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/domain/CLUB_ACCOUNT.md`
- `docs/data/PLATFORM_DATA_MODEL.md`
- `docs/data/DATABASE_FOUNDATION.md`
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/architecture/ACCOUNTING_ADAPTER.md`
- `docs/integrations/YOOKASSA.md`
- `docs/finance/PAYMENT_REGISTRY.md`
- `docs/finance/REFUND_REGISTRY.md`
- `docs/finance/RECONCILIATION.md`
- `docs/finance/SETTLEMENT_REGISTRY.md`
- `docs/domain/PAYMENT_OPERATIONS_REGISTRY.md`
- `docs/architecture/PROJECT_DECISIONS.md`

---

# 1. Review Verdict

`docs/domain/PAYMENT_DOMAIN_V2.md` is architecturally coherent as a documentation-only Payment Domain v2 model.

No blocking conflict was found with the accepted payment, database, Club Account, YooKassa or accounting direction.

The document correctly establishes:

- provider-independent `PaymentIntent`;
- provider/channel-specific `PaymentSession`;
- append-only `PaymentOperation`;
- internal `PaymentRegistry`;
- full and partial refund as compensating records;
- no direct Payment mutation of Club Account balance;
- QR and YooKassa as session/provider presentations behind Payment contracts.

Implementation readiness is not complete yet. Before code, schema, provider integration or production payment handling starts, the platform still needs explicit Ledger-backed completion semantics, concrete registry and reconciliation records, YooKassa status mapping, webhook verification policy, refund authorization rules and event payload contracts.

Review result:

```text
Architecture-ready for documentation baseline.
Not implementation-ready for payment runtime, provider integration, reconciliation automation or refund execution.
```

---

# 2. Findings

## P2 - Payment success fact needs Ledger-backed completion semantics before implementation

Payment Domain v2 uses `PAYMENT_CONFIRMED` as the successful payment fact consumed by Order, Club Account, Ledger/Finance, Notification and other domains.

The older Payment Engine, Checkout and Accounting Adapter direction is stricter: provider success should become downstream payment completion only after Ledger-backed financial recording, or after an explicitly approved Ledger policy says the payment may proceed.

Impact:

If future code treats raw provider success or QR session `SUCCESS` as enough to credit Club Account or dispatch an order, the platform could mutate customer-facing balance or start fulfillment before financial history is safely recorded.

Recommendation:

Before implementation, define one of these rules explicitly:

- `PAYMENT_CONFIRMED` means provider success only, and a separate `PAYMENT_COMPLETED` or Ledger-backed operation gates Club Account credit and Order paid transition; or
- `PAYMENT_CONFIRMED` already means provider success plus accepted Ledger/Finance recording policy.

The second option is simpler, but it must be written into command, event and state contracts so adapters, Order and Club Account do not infer payment success differently.

## P2 - Registry and reconciliation are conceptually described but not yet specified independently

Payment Domain v2 defines `PaymentRegistry` responsibilities for provider reconciliation, external references, reports and future accounting export.

The dedicated registry files currently exist as empty placeholders:

- `docs/finance/PAYMENT_REGISTRY.md`
- `docs/finance/REFUND_REGISTRY.md`
- `docs/finance/RECONCILIATION.md`
- `docs/finance/SETTLEMENT_REGISTRY.md`
- `docs/domain/PAYMENT_OPERATIONS_REGISTRY.md`

Impact:

The V2 model is directionally ready, but future implementation does not yet have enough detail for import batches, provider report checksums, reconciliation runs, mismatch statuses, manual review lifecycle, storage ownership or accounting handoff.

Recommendation:

Before YooKassa production work, create or fill the registry specifications with:

- `ProviderReportImport`;
- `PaymentRegistry` record types and statuses;
- `ReconciliationRun` and `ReconciliationResult`;
- mismatch taxonomy such as provider missing, internal missing, amount mismatch, currency mismatch and duplicate provider reference;
- manual review states and resolution records;
- idempotency rules for repeated report imports;
- Ledger and Accounting Adapter references.

## P2 - Refund model is sound, but refund policy is not execution-ready

Payment Domain v2 correctly models refund as a compensating process, not an edit to original payment history. It defines full refund, partial refund, refund reason, provider reference, states and `REFUND_CREATED` / `REFUND_COMPLETED` operations.

Execution policy is still intentionally open.

Impact:

Future refund implementation could diverge on when refund is allowed, how remaining refundable amount is calculated, whether refund returns to original method or Club Account, how mixed payments are attributed, and when Order or Club Account should react.

Recommendation:

Before refund execution code, define:

- refund authorization roles and required reasons;
- remaining refundable amount calculation;
- full versus partial refund policy for MVP;
- method-line attribution for card, SBP, Club Account, Wallet and mixed payments;
- original-method versus Club Account refund destination policy;
- refund failure and retry policy;
- Ledger and Accounting Adapter mapping;
- Order, Club Account and Notification event contracts.

## P3 - PaymentIntent and PaymentSession separation passes, but must be reconciled with the existing Payment aggregate model

Payment Domain v2 clearly separates `PaymentIntent` as the approved provider-independent request from `PaymentSession` as a concrete YooKassa, SBP, QR or Telegram attempt.

The wider platform data model also names a `Payment` aggregate and `PaymentMethodLine` between intent/session and operations.

Impact:

This is not a blocker for V2 as an architecture document. It becomes a risk during schema work if future models collapse intent, payment attempt, session, method line and operation into one table or one status enum.

Recommendation:

The future payment schema task should state whether Payment Domain v2 intentionally removes the separate `Payment` aggregate or whether:

- `PaymentIntent` owns approved purpose and amount;
- `Payment` or payment attempt owns method lines and settlement identity;
- `PaymentSession` owns limited-lifetime confirmation presentation;
- `PaymentOperation` owns append-only facts.

## P3 - YooKassa boundary is correct, but status mapping and webhook verification remain future work

Payment Domain v2 keeps YooKassa inside an adapter boundary, treats YooKassa IDs as provider references and prevents raw provider payloads, credentials and statuses from leaking into other domains.

The document also correctly defines webhook and polling as confirmation inputs.

Impact:

The architecture is safe, but implementation cannot start until provider-specific behavior is mapped into platform states.

Recommendation:

Before integration, define:

- YooKassa payment status mapping;
- YooKassa refund status mapping;
- webhook authenticity verification policy;
- duplicate webhook detection keys;
- polling retry schedule and stop conditions;
- ambiguous result handling;
- masked provider reference format;
- protected raw payload retention policy.

---

# 3. Requested Checks

## 3.1 PaymentIntent vs PaymentSession separation

Verdict: Pass with schema-prep follow-up.

Payment Domain v2 defines `PaymentIntent` as the provider-independent request to collect money for a purpose, amount and currency. It defines `PaymentSession` as a concrete external or channel-specific attempt with provider, URL, QR payload, external reference, expiration and status.

The separation supports:

- one intent with multiple sessions over time;
- replacement session after expiration or failure;
- YooKassa, SBP, QR and Telegram payment without changing intent semantics;
- provider IDs as references rather than platform identity;
- auditability of old sessions.

Follow-up:

Future storage and runtime contracts must preserve a separate payment attempt or method-line model if mixed payments, internal Club Account lines or Wallet lines are implemented.

## 3.2 QR payment lifecycle

Verdict: Pass for architecture, not yet policy-complete.

Payment Domain v2 covers the required lifecycle:

- QR generation from valid intent/session;
- QR lifetime through `expiration_time`;
- expiration as platform/provider policy, not frontend timer state;
- payment checking through webhook first and polling fallback;
- successful confirmation through normalized provider state and `PAYMENT_CONFIRMED`;
- expired QR audit retention;
- late success after expiration routed to reconciliation before downstream changes.

Follow-up:

Future implementation must define exact QR lifetime policy, refresh/replacement rules, customer-safe expiration display, polling limits, late-success manual review and machine-context safety when a QR is tied to a selected vending machine.

## 3.3 YooKassa registry and reconciliation readiness

Verdict: Partial.

The V2 document is directionally ready:

- YooKassa remains adapter-owned;
- YooKassa payment ID is provider reference only;
- provider reports are inputs, not platform financial history;
- PaymentRegistry records matched, unknown or mismatched provider facts;
- unresolved mismatches require manual review or compensating operations.

The independent registry/reconciliation specifications are not ready yet because the dedicated registry files are empty.

Required next step:

Fill the registry and reconciliation documents before production YooKassa integration or reconciliation automation.

## 3.4 Refund model

Verdict: Pass for domain model, partial for implementation readiness.

The refund model correctly preserves:

- refund as a compensating process;
- full and partial refund;
- original payment references;
- provider refund references as correlation metadata only;
- immutable `REFUND_CREATED` and `REFUND_COMPLETED` operations;
- failure and manual review states;
- rule that refund failure must not silently change Order, Club Account or Machine state.

Follow-up:

Refund execution needs explicit policy for authorization, refundable amount, partial refund limits, destination, method-line attribution, Ledger recording, provider retry and Order/Club Account reactions.

## 3.5 Separation between Payment Domain and Club Account

Verdict: Pass.

Payment Domain v2 explicitly states:

- Payment does not store business balance;
- Payment does not modify Club Account directly;
- Club Account consumes payment facts through its own contract;
- Club Account appends its own transaction;
- failed top-up does not credit balance;
- duplicate provider confirmations must credit only once by idempotency.

This preserves the Club Account boundary and avoids mixing provider settlement with customer-facing prepaid balance.

Follow-up:

The future event contract should define whether Club Account consumes `PAYMENT_CONFIRMED`, `PAYMENT_COMPLETED` or a Ledger-backed top-up-specific event. That is the key detail needed to keep balance updates deterministic.

---

# 4. Conclusion

Payment Domain v2 is a strong documentation baseline and should remain the current architectural direction.

Recommended next action before implementation:

```text
Create a payment implementation-prep documentation task covering Ledger-backed completion semantics, registry/reconciliation specs, YooKassa mappings, refund policy and Payment-to-Club-Account event contracts.
```

No source code, build output, runtime configuration, API keys, payment provider calls, database migrations or existing architecture documents were changed by this review.
