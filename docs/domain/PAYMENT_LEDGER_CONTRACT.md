# Payment Ledger and Settlement Contract

Document code: DOMAIN-PAYMENT-LEDGER-001
Task: Payment implementation contracts after PAYMENT_DOMAIN_V2_REVIEW
Version: 0.1
Status: Draft
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-13
Last updated: 2026-07-13
Scope: Documentation only

Related documents:

- `docs/reviews/PAYMENT_DOMAIN_V2_REVIEW.md`
- `docs/domain/PAYMENT_DOMAIN_V2.md`
- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/domain/CLUB_ACCOUNT.md`
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/architecture/LEDGER.md`
- `docs/architecture/ACCOUNTING_ADAPTER.md`
- `docs/data/DATABASE_FOUNDATION.md`
- `docs/data/PLATFORM_DATA_MODEL.md`
- `docs/api/EVENT_API.md`
- `docs/integrations/YOOKASSA.md`

Provider references checked on 2026-07-13:

- YooKassa API reference: `https://yookassa.ru/developers/api`
- YooKassa payment process: `https://yookassa.ru/developers/payment-acceptance/getting-started/payment-process`
- YooKassa incoming notifications: `https://yookassa.ru/developers/using-api/webhooks`

---

# 1. Purpose

This document defines the missing implementation contracts identified after `PAYMENT_DOMAIN_V2_REVIEW`.

The contract clarifies:

- the Payment ledger model;
- the Payment registry;
- YooKassa status and webhook mapping;
- settlement reconciliation;
- refund lifecycle;
- the `PaymentCompleted` event contract consumed by Club Account;
- idempotency rules.

Core rule:

```text
Raw provider success is not enough to credit Club Account or mark an Order as paid.
PaymentCompleted is emitted only after provider success is normalized and the Ledger-backed recording policy is satisfied.
```

This document is documentation-only. It does not create runtime code, API routes, provider calls, webhooks, database migrations, Prisma schema changes or payment UI.

---

# 2. Scope

Included:

- Payment ledger record model and state rules;
- Payment registry record model and provider reference rules;
- YooKassa payment, refund and webhook mapping rules;
- settlement reconciliation inputs, mismatch taxonomy and resolution flow;
- refund authorization, execution, completion and failure lifecycle;
- `PaymentCompleted` event payload for Club Account top-up;
- idempotency key patterns for payment, registry, reconciliation, refund and Club Account consumption.

Out of scope:

- real YooKassa API implementation;
- webhook endpoint implementation;
- production provider credential handling;
- Prisma schema and migrations;
- payment provider SDK selection;
- fiscalization and receipt implementation;
- accounting system implementation;
- Club Account transaction code;
- Order paid-state code;
- Machine dispatch code.

---

# 3. Source-of-Truth Hierarchy

Payment contracts follow this hierarchy:

| Layer | Owns | Rule |
|---|---|---|
| Provider adapter | External provider request, response, webhook and status normalization. | Provider facts are inputs, not platform financial truth. |
| Payment Domain | PaymentIntent, PaymentSession, PaymentOperation, PaymentRegistry and Payment ledger contract state. | Payment records provider-independent payment facts and emits events. |
| Ledger | Immutable financial history. | Ledger-backed facts gate `PaymentCompleted` and refund completion. |
| Club Account | Customer-facing prepaid balance and account transactions. | Club Account credits top-up only from accepted payment event contract. |
| Order | Purchase lifecycle and paid-state transition. | Order reacts to accepted payment facts; it does not read raw provider state. |
| Accounting Adapter | Future export and external accounting synchronization. | Accounting consumes Ledger-backed facts and registry references. |

Provider status, redirect success, QR scan, webhook delivery, polling result and UI timer state are never enough by themselves to mutate Club Account balance, mark an order paid or dispatch a machine.

---

# 4. Payment Ledger Model

## 4.1 Definition

Payment ledger is the Payment Domain contract that links payment operations to Ledger-backed financial facts.

It is not a replacement for the platform Ledger. It is a payment-scoped journal and projection that makes payment completion, settlement, refund and reconciliation decisions explicit.

Payment ledger answers:

- which provider-independent payment operation happened;
- which amount and method lines were affected;
- whether a Ledger-backed financial fact exists;
- whether the operation can produce `PaymentCompleted`, `RefundCompleted` or manual review;
- which downstream domains may consume the fact.

## 4.2 Entities

Payment ledger uses these records:

| Record | Purpose |
|---|---|
| `PaymentLedgerEntry` | Payment-scoped accepted financial fact or pending financial fact requiring Ledger policy. |
| `PaymentLedgerLine` | Method-line amount inside an entry, such as YooKassa card, SBP, Club Account, wallet or future provider. |
| `PaymentLedgerLink` | Reference between Payment operation IDs, Ledger entry IDs, registry records and events. |
| `PaymentLedgerCorrection` | Compensating entry for correction, refund or manual resolution. |

## 4.3 PaymentLedgerEntry Fields

Required conceptual fields:

| Field | Meaning |
|---|---|
| `payment_ledger_entry_id` | Stable Payment ledger entry ID. |
| `payment_intent_id` | Related PaymentIntent. |
| `payment_session_id` | Related PaymentSession when provider attempt exists. |
| `payment_operation_id` | PaymentOperation that caused the entry. |
| `purpose` | `club_account_top_up`, `product_purchase`, `support_payment` or approved future purpose. |
| `customer_id` | Customer reference when available. |
| `club_account_id` | Present for top-up destination correlation only. |
| `order_id` | Present for product purchase correlation. |
| `entry_type` | Financial operation type. |
| `entry_status` | Payment ledger state. |
| `amount` | Total entry amount. |
| `currency` | Currency, MVP default `RUB`. |
| `ledger_entry_ids` | Ledger entry references accepted by Ledger policy. |
| `registry_record_ids` | PaymentRegistry records used for provider and reconciliation traceability. |
| `correlation_id` | End-to-end business flow ID. |
| `causation_id` | Command, event or provider fact that caused the entry. |
| `idempotency_key` | Duplicate side-effect protection. |
| `created_at` | UTC creation timestamp. |
| `recorded_at` | UTC timestamp when the entry was accepted by Payment ledger policy. |

Entry types:

| Type | Meaning |
|---|---|
| `payment_created` | Payment collection was initialized. |
| `provider_payment_succeeded` | Provider reported success, but Ledger-backed completion is not yet accepted. |
| `payment_completed` | Ledger-backed payment completion is accepted. |
| `payment_failed` | Payment failed before completion. |
| `payment_cancelled` | Payment was cancelled before captured funds existed. |
| `payment_expired` | Payment confirmation or capture window expired. |
| `refund_requested` | Refund workflow was accepted. |
| `provider_refund_succeeded` | Provider reported refund success, but Ledger-backed refund completion is not yet accepted. |
| `refund_completed` | Ledger-backed refund completion is accepted. |
| `manual_adjustment` | Approved support or finance correction entry. |

Entry statuses:

| Status | Meaning |
|---|---|
| `pending_provider` | Waiting for provider or internal method outcome. |
| `pending_ledger` | Provider/internal outcome is known and Ledger policy is pending. |
| `ledger_recorded` | Required Ledger references are recorded. |
| `completed` | Entry can be consumed by downstream domains. |
| `failed` | Entry failed before completion. |
| `cancelled` | Entry was cancelled before completion. |
| `expired` | Entry expired before completion. |
| `manual_review` | Entry outcome is ambiguous or risky. |
| `compensated` | Entry was offset by a later correction or refund entry. |

## 4.4 PaymentLedgerLine Fields

Each line represents one method or settlement component.

| Field | Meaning |
|---|---|
| `payment_ledger_line_id` | Stable line ID. |
| `payment_ledger_entry_id` | Parent Payment ledger entry. |
| `method` | `yookassa_card`, `yookassa_sbp`, `club_account`, `wallet`, `cashless_provider`, `manual` or future approved method. |
| `provider` | Provider adapter such as `yookassa`, when external. |
| `amount` | Line amount. |
| `currency` | Line currency. |
| `direction` | `inbound`, `outbound`, `reservation`, `release` or `correction`. |
| `external_reference` | Masked provider payment or refund reference. |
| `ledger_entry_id` | Ledger entry for this line when available. |
| `status` | `pending`, `recorded`, `failed`, `manual_review` or `compensated`. |

Method-line rules:

- method-line amounts must sum to the approved payable or refund amount;
- provider references are correlation metadata, not platform identity;
- discount and bonus amounts are not payment ledger lines because they are not collected money;
- Club Account lines are internal prepaid balance lines and must be handled through Club Account and Ledger contracts;
- mixed payments must preserve method-line attribution through payment completion and refund.

## 4.5 Completion Semantics

Payment success has three distinct facts:

| Fact | Meaning | Downstream effect |
|---|---|---|
| Provider success | Provider reported success, for example YooKassa `succeeded`. | Creates normalized provider fact and registry record only. |
| Ledger policy satisfied | Required Ledger entries or approved Ledger recording policy exist. | Payment ledger may accept completion. |
| `PaymentCompleted` | Payment ledger entry is completed and event is emitted. | Club Account, Order and other consumers may react idempotently. |

Completion flow:

```text
Provider success or internal method success
-> normalized PaymentOperation
-> PaymentRegistry record
-> PaymentLedgerEntry pending_ledger
-> Ledger entry recorded or Ledger policy accepted
-> PaymentLedgerEntry completed
-> PaymentCompleted event
```

If Ledger recording fails, times out or conflicts with provider data, the payment enters `manual_review`. Club Account must not credit balance and Order must not dispatch from the raw provider status.

## 4.6 Payment Ledger Example

```json
{
  "payment_ledger_entry_id": "payment_ledger_01JZ0000000000000000000000",
  "payment_intent_id": "payment_intent_01JZ0000000000000000000000",
  "payment_session_id": "payment_session_01JZ0000000000000000000000",
  "payment_operation_id": "payment_op_01JZ0000000000000000000000",
  "purpose": "club_account_top_up",
  "customer_id": "customer_01JZ0000000000000000000000",
  "club_account_id": "club_account_01JZ0000000000000000000000",
  "order_id": null,
  "entry_type": "payment_completed",
  "entry_status": "completed",
  "amount": 100,
  "currency": "RUB",
  "ledger_entry_ids": [
    "ledger_entry_01JZ0000000000000000000000"
  ],
  "registry_record_ids": [
    "payment_registry_01JZ0000000000000000000000"
  ],
  "lines": [
    {
      "payment_ledger_line_id": "payment_ledger_line_01JZ0000000000000000000000",
      "method": "yookassa_card",
      "provider": "yookassa",
      "amount": 100,
      "currency": "RUB",
      "direction": "inbound",
      "external_reference": "yookassa_payment_ref_masked",
      "ledger_entry_id": "ledger_entry_01JZ0000000000000000000000",
      "status": "recorded"
    }
  ],
  "correlation_id": "top_up_01JZ0000000000000000000000",
  "causation_id": "provider_event_01JZ0000000000000000000000",
  "idempotency_key": "payment_completed:payment_intent_01JZ:ledger_entry_01JZ",
  "created_at": "2026-07-13T00:00:00Z",
  "recorded_at": "2026-07-13T00:00:05Z"
}
```

---

# 5. Payment Registry

## 5.1 Definition

PaymentRegistry is the internal traceability layer for provider references, provider reports, provider webhooks, status polls, PaymentOperations, Payment ledger entries and reconciliation runs.

PaymentRegistry is not:

- the provider cabinet;
- the global Ledger;
- the Club Account balance;
- the accounting system;
- a place to store raw card data or provider secrets.

## 5.2 Registry Record Families

| Record | Purpose |
|---|---|
| `PaymentRegistryRecord` | Canonical internal registry row for one provider or payment fact correlation. |
| `ProviderWebhookFact` | Verified provider webhook metadata and normalized provider object snapshot. |
| `ProviderStatusSnapshot` | Status read by polling or explicit provider lookup. |
| `ProviderReportImport` | Imported provider settlement report batch. |
| `ProviderReportLine` | One provider report line in a report batch. |
| `ReconciliationRun` | One reconciliation execution over a period or target set. |
| `ReconciliationResult` | Match or mismatch outcome for one internal/provider item. |
| `ManualReviewRecord` | Operator or support review state for unresolved mismatches. |

## 5.3 PaymentRegistryRecord Fields

| Field | Meaning |
|---|---|
| `payment_registry_id` | Stable registry record ID. |
| `registry_type` | `webhook`, `status_poll`, `provider_report`, `manual_review`, `accounting_export` or `settlement_reconciliation`. |
| `provider` | Provider adapter such as `yookassa`. |
| `external_payment_reference` | Masked provider payment ID. |
| `external_refund_reference` | Masked provider refund ID when applicable. |
| `external_event_reference` | Provider webhook or event reference when available. |
| `external_report_reference` | Provider report or import batch reference when applicable. |
| `payment_intent_id` | Platform PaymentIntent reference when matched. |
| `payment_session_id` | Platform PaymentSession reference when matched. |
| `payment_operation_id` | Platform PaymentOperation reference when created. |
| `payment_ledger_entry_id` | Payment ledger entry reference when created. |
| `ledger_entry_ids` | Ledger references when completion/refund is recorded. |
| `provider_status` | Provider-native status as normalized safe string. |
| `platform_status` | Provider-independent platform state. |
| `amount` | Provider or platform amount for comparison. |
| `currency` | Currency. |
| `match_status` | Registry match state. |
| `review_status` | Manual review state when needed. |
| `idempotency_key` | Duplicate import or processing protection. |
| `created_at` | UTC creation timestamp. |
| `updated_at` | UTC update timestamp for operational registry state. |

Registry match statuses:

| Status | Meaning |
|---|---|
| `registered` | Registry record exists but is not reconciled yet. |
| `matched` | Provider, Payment ledger and Ledger agree. |
| `internal_missing` | Provider fact exists but platform payment record is missing. |
| `provider_missing` | Internal payment fact exists but provider report/status is missing. |
| `amount_mismatch` | Amount differs between provider, Payment ledger or Ledger. |
| `currency_mismatch` | Currency differs. |
| `duplicate_provider_reference` | Same provider reference maps to more than one platform item. |
| `duplicate_internal_reference` | Same platform payment maps to more than one provider item unexpectedly. |
| `late_success_after_expiry` | Provider success arrived after platform session or intent expiry. |
| `ledger_missing` | Provider/platform success exists but Ledger-backed record is absent. |
| `manual_review` | Automated reconciliation cannot safely resolve the item. |
| `resolved` | Manual or automated resolution is accepted. |
| `compensated` | Mismatch was resolved by refund, correction or support compensation. |

## 5.4 Registry Rules

- every provider webhook, status poll and provider report line must be registered or explicitly rejected with an audit reason;
- raw provider payloads may be retained only in protected integration storage, not in domain events;
- provider IDs must be masked in customer-visible and broad operational views;
- provider reports are reconciliation inputs, not automatic financial truth;
- registry records may track operational status updates, but accepted financial corrections use new Payment ledger and Ledger entries;
- unresolved registry mismatches must block `PaymentCompleted` or `RefundCompleted` when financial safety is uncertain;
- registry import replay must not create duplicate PaymentOperations, Ledger entries or Club Account transactions.

---

# 6. YooKassa Mapping

## 6.1 Boundary

YooKassa is an adapter boundary.

YooKassa request shapes, response shapes, credentials, signatures, raw webhook payloads and provider-native error details must not leak into Club Account, Order, Machine, Product, Bonus, Discount, frontend UI or generic Payment contracts.

The YooKassa adapter maps:

```text
YooKassa payment/refund/webhook/status
-> normalized provider fact
-> PaymentOperation
-> PaymentRegistryRecord
-> PaymentLedgerEntry
```

## 6.2 Payment Status Mapping

| YooKassa status | Platform session state | Payment ledger action | Downstream event |
|---|---|---|---|
| `pending` | `ACTIVE` or `WAITING_CONFIRMATION` | Keep `PaymentLedgerEntry` in `pending_provider`; record status snapshot. | No completion event. |
| `waiting_for_capture` | `AUTHORIZED` or `CAPTURE_PENDING` | Record authorization/capture-needed operation; no completion until capture and Ledger policy. | No completion event. |
| `succeeded` | `SUCCESS` | Create `provider_payment_succeeded`, register provider reference, then wait for Ledger policy before `payment_completed`. | Emit `PaymentCompleted` only after Payment ledger is `completed`. |
| `canceled` | `FAILED`, `CANCELLED` or `EXPIRED` according to reason. | Create failure, cancellation or expiry operation; register reason. | Emit failed/cancelled/expired event only after platform mapping is accepted. |

Mapping notes:

- `pending` is not paid;
- `waiting_for_capture` is not completed settlement;
- `succeeded` is provider success, not yet Club Account credit;
- `canceled` must inspect provider cancellation reason and platform context;
- unknown or unsupported YooKassa status enters `manual_review`.

## 6.3 Cancellation Reason Mapping

| YooKassa cancellation reason category | Platform interpretation |
|---|---|
| Confirmation time expired, such as `expired_on_confirmation`. | `payment_expired` when no captured funds exist. |
| Capture time expired, such as `expired_on_capture`. | `payment_expired` or `payment_cancelled` according to authorized/capture state. |
| Merchant or platform cancelled before capture. | `payment_cancelled`. |
| Provider, bank or payment method declined. | `payment_failed`. |
| Fraud, risk or compliance rejection. | `payment_failed` plus risk/audit reason. |
| Unknown or inconsistent reason. | `manual_review`. |

## 6.4 Webhook Mapping

| YooKassa webhook event | Provider fact | Platform action |
|---|---|---|
| `payment.waiting_for_capture` | Payment is authorized and waiting for capture. | Register webhook, update session to capture-needed state, no downstream completion. |
| `payment.succeeded` | Provider payment succeeded. | Register webhook, create provider success operation, reconcile amount/currency, wait for Ledger policy, then emit `PaymentCompleted`. |
| `payment.canceled` | Provider payment cancelled. | Register webhook, map cancellation reason, emit failed/cancelled/expired event if safe. |
| `refund.succeeded` | Provider refund succeeded. | Register webhook, create provider refund success operation, wait for Ledger refund policy, then emit `RefundCompleted`. |

Webhook rules:

- webhook authenticity must be verified before any state change;
- webhook processing must be idempotent;
- webhook payload must be normalized before entering Payment Domain;
- duplicate webhook delivery returns existing processing result;
- webhook data must not contain secrets in domain events;
- webhook and polling must converge to the same platform state;
- conflicting webhook and poll results enter reconciliation.

## 6.5 Polling Mapping

Polling is a fallback or reconciliation input.

Polling rules:

- polling reads provider state and does not create duplicate provider side effects;
- polling result creates `ProviderStatusSnapshot`;
- polling cannot skip Payment ledger and Ledger policy;
- repeated polling of the same provider state must not create duplicate PaymentOperations;
- polling must stop when terminal platform state is safely accepted or when manual review owns the case;
- polling a missing provider object for an internal payment enters reconciliation.

## 6.6 YooKassa Idempotency

YooKassa side-effect requests must use provider idempotency keys derived from platform operation identity.

Recommended provider key shape:

```text
yookassa:{operation_type}:{payment_session_id}:{amount}:{currency}:{operation_version}
```

Provider idempotency keys must never include secrets, raw personal data, raw card data or unmasked customer contact data.

---

# 7. Settlement Reconciliation

## 7.1 Definition

Settlement reconciliation compares internal Payment ledger and Ledger facts with provider facts and reports.

It exists to detect:

- provider success not recorded internally;
- internal success missing from provider reports;
- missing Ledger records;
- amount or currency mismatch;
- duplicate provider references;
- late success after expiry;
- refund mismatches;
- accounting export readiness gaps.

## 7.2 Inputs

Reconciliation inputs:

| Input | Owner |
|---|---|
| PaymentIntent, PaymentSession and PaymentOperation | Payment Domain |
| PaymentLedgerEntry and PaymentLedgerLine | Payment Domain |
| Ledger entries | Ledger |
| PaymentRegistry records | Payment Domain |
| YooKassa webhooks and status snapshots | YooKassa adapter / Payment registry |
| YooKassa settlement or payment/refund reports | Provider report import |
| Refund records | Payment Domain |
| Accounting export records | Accounting Adapter, future |
| Manual review records | Support, finance or CRM workflow |

## 7.3 ReconciliationRun Fields

| Field | Meaning |
|---|---|
| `reconciliation_run_id` | Stable run ID. |
| `run_type` | `provider_report`, `webhook_gap`, `ledger_gap`, `refund_gap`, `manual_review` or `accounting_export_readiness`. |
| `provider` | Provider such as `yookassa`. |
| `period_start` | Inclusive UTC period start. |
| `period_end` | Exclusive UTC period end. |
| `input_reference_ids` | Report, registry, Ledger or payment references used. |
| `status` | `created`, `running`, `completed`, `completed_with_mismatches`, `failed` or `manual_review`. |
| `matched_count` | Count of matched items. |
| `mismatch_count` | Count of mismatch items. |
| `created_at` | UTC creation timestamp. |
| `completed_at` | UTC completion timestamp when complete. |

## 7.4 Matching Keys

Primary matching keys:

```text
provider + external_payment_reference
provider + external_refund_reference
payment_intent_id + payment_session_id
payment_ledger_entry_id + ledger_entry_id
amount + currency + provider + operation_type + occurred_at_window
```

Provider metadata such as order ID may assist matching, but it must not replace platform IDs.

## 7.5 Mismatch Taxonomy

| Mismatch | Required behavior |
|---|---|
| `internal_missing` | Create registry record and route to manual review before creating platform financial facts. |
| `provider_missing` | Hold or review internal payment completion depending on Ledger and provider evidence. |
| `ledger_missing` | Block `PaymentCompleted` or `RefundCompleted` until Ledger policy is satisfied or manual review resolves. |
| `amount_mismatch` | Block downstream financial events and route to manual review. |
| `currency_mismatch` | Reject automated completion and route to manual review. |
| `duplicate_provider_reference` | Block duplicate completion and route to manual review. |
| `duplicate_internal_reference` | Keep only canonical internal reference and route duplicates to review. |
| `late_success_after_expiry` | Do not credit or dispatch automatically; route to reconciliation and possible refund or support resolution. |
| `refund_missing` | Keep refund pending or manual review; do not mark refund completed. |
| `provider_refund_without_request` | Register as unknown provider refund and route to manual review. |

## 7.6 Resolution States

| State | Meaning |
|---|---|
| `open` | Mismatch exists and is unresolved. |
| `investigating` | Operator or automated review is in progress. |
| `matched_after_retry` | Retry or delayed data resolved the mismatch. |
| `accepted_as_provider_truth` | Provider fact was accepted through approved policy and Ledger entry is created. |
| `accepted_as_internal_truth` | Internal Ledger-backed fact is accepted and provider gap is documented. |
| `compensated_by_refund` | Refund resolved financial exposure. |
| `compensated_by_adjustment` | Ledger correction or approved adjustment resolved the mismatch. |
| `closed_no_action` | No financial action is required and reason is audited. |

Resolution rules:

- reconciliation never edits accepted Ledger entries;
- corrections use new Payment ledger and Ledger entries;
- manual resolution requires actor, role, reason and timestamp;
- `PaymentCompleted` and `RefundCompleted` may be emitted only after resolution creates or confirms the required Ledger-backed fact;
- accounting export should exclude unresolved mismatches unless finance policy explicitly marks them exportable.

---

# 8. Refund Lifecycle

## 8.1 Definition

Refund is a compensating payment process linked to original successful payment settlement.

Refund never edits the original payment, Payment ledger entry, provider record or Ledger entry. It creates new refund records, Payment ledger entries, provider references and Ledger entries.

## 8.2 Refund Preconditions

A refund may start only when:

- original payment has a completed Payment ledger entry;
- original payment has Ledger-backed settlement references;
- refund amount is greater than zero;
- refund currency matches original settlement currency;
- refund reason is present;
- requester is authorized;
- idempotency key is present;
- remaining refundable amount is sufficient;
- method-line attribution can be determined or manual review accepts the case.

Remaining refundable amount:

```text
original_captured_amount - sum(completed_refunds) - sum(pending_authorized_refunds)
```

## 8.3 Refund States

| State | Meaning |
|---|---|
| `requested` | Refund request was received and recorded. |
| `authorized` | Policy, actor and amount checks passed. |
| `rejected` | Refund request failed validation or authorization. |
| `provider_requested` | External provider refund command was sent. |
| `processing` | Provider or internal refund is in progress. |
| `provider_succeeded` | Provider reported refund success, Ledger policy pending. |
| `ledger_recorded` | Refund Ledger entry is recorded or accepted by Ledger policy. |
| `completed` | Refund is complete and may be consumed by downstream domains. |
| `failed` | Refund failed and may be retried or reviewed. |
| `cancelled` | Refund was cancelled before provider/internal side effect where policy allows. |
| `manual_review` | Outcome is ambiguous or risky. |

Allowed high-level transitions:

```text
requested -> authorized
requested -> rejected
authorized -> provider_requested
authorized -> processing
provider_requested -> processing
processing -> provider_succeeded
provider_succeeded -> ledger_recorded
ledger_recorded -> completed
processing -> failed
processing -> manual_review
failed -> authorized
failed -> manual_review
manual_review -> completed
manual_review -> failed
```

## 8.4 Refund Types

| Type | Meaning |
|---|---|
| `full_refund` | Refunds all remaining refundable amount. |
| `partial_refund` | Refunds less than remaining refundable amount. |
| `method_line_refund` | Refunds a specific payment method line. |
| `manual_compensation` | Approved support or finance compensation when normal provider refund is unavailable. |

MVP policy:

- refund to original external provider method is preferred for external payments;
- refund to Club Account is allowed only when original settlement line or approved support policy says Club Account is the destination;
- mixed-payment refunds must preserve method-line attribution;
- partial refund support requires explicit product/order/refund policy before customer-facing use.

## 8.5 Refund Record Fields

| Field | Meaning |
|---|---|
| `refund_id` | Stable platform refund ID. |
| `original_payment_intent_id` | Original PaymentIntent. |
| `original_payment_ledger_entry_id` | Original completed Payment ledger entry. |
| `original_ledger_entry_ids` | Original Ledger entries being compensated. |
| `refund_type` | Refund type. |
| `refund_status` | Refund lifecycle state. |
| `amount` | Refund amount. |
| `currency` | Currency. |
| `reason_code` | Refund reason. |
| `requested_by` | Actor reference. |
| `authorized_by` | Actor or policy reference when authorized. |
| `provider` | Provider used for external refund. |
| `external_refund_reference` | Masked provider refund reference. |
| `payment_ledger_entry_id` | Refund Payment ledger entry. |
| `ledger_entry_ids` | Refund Ledger entries. |
| `correlation_id` | End-to-end flow ID. |
| `causation_id` | Command, event or provider fact that caused the refund state. |
| `idempotency_key` | Duplicate refund protection. |
| `created_at` | UTC creation timestamp. |
| `completed_at` | UTC completion timestamp when complete. |

## 8.6 Refund Events

| Event | Emitted when | Ledger requirement |
|---|---|---|
| `RefundRequested` | Refund request is accepted for workflow. | Ledger not required yet. |
| `RefundRejected` | Refund request fails validation or authorization. | Ledger not required. |
| `RefundProcessing` | Provider or internal refund execution begins. | Ledger not required yet. |
| `RefundCompleted` | Refund Payment ledger entry is completed. | Required. |
| `RefundFailed` | Refund cannot complete normally. | Ledger only if failure has financial effect. |
| `RefundManualReviewRequested` | Automated outcome is unsafe or ambiguous. | Ledger depends on case. |

`RefundCompleted` must not be emitted from YooKassa `refund.succeeded` alone. It requires Payment ledger and Ledger refund policy to be satisfied.

---

# 9. PaymentCompleted Event Contract With Club Account

## 9.1 Event Identity

Canonical Event API name:

```text
Payments.Completed
```

Payment Engine business alias:

```text
PaymentCompleted
```

Future implementation must choose one canonical publication name in the Event Registry. It must not publish both names for the same fact unless an explicit migration bridge is approved.

## 9.2 Producer and Consumers

Producer:

- Payment Runtime or future Payment Engine implementation.

Required consumers:

- Club Account for `club_account_top_up`;
- Order for `product_purchase`;
- Notification for customer-safe messages;
- CRM/support projections;
- Analytics and future Accounting Adapter through approved contracts.

Club Account must consume `PaymentCompleted` as a fact and apply its own command or transaction policy. Payment must not call Club Account storage or mutate Club Account balance directly.

## 9.3 Emission Preconditions

`PaymentCompleted` may be emitted only when:

1. PaymentIntent is known and not already completed by another canonical completion event.
2. PaymentSession or internal payment line outcome is accepted.
3. PaymentOperation exists for the successful payment.
4. PaymentRegistry has registered provider or internal method references.
5. PaymentLedgerEntry is in `completed`.
6. Required Ledger entry IDs or approved Ledger policy references exist.
7. Amount and currency match the approved payable or top-up amount.
8. Event idempotency key is stable.

## 9.4 Payload Contract

Required payload fields:

| Field | Meaning |
|---|---|
| `payment_completed_id` | Stable payment completion fact ID. |
| `payment_intent_id` | PaymentIntent ID. |
| `payment_session_id` | PaymentSession ID when applicable. |
| `payment_operation_id` | Successful PaymentOperation ID. |
| `payment_ledger_entry_id` | Completed Payment ledger entry ID. |
| `ledger_entry_ids` | Ledger entries backing completion. |
| `purpose` | `club_account_top_up`, `product_purchase` or approved future purpose. |
| `customer_id` | Customer reference. |
| `amount` | Completed amount. |
| `currency` | Currency. |
| `method_lines` | Payment method lines. |
| `occurred_at` | UTC time when completion was accepted. |
| `correlation_id` | End-to-end flow ID. |
| `causation_id` | Provider, ledger or command fact that caused completion. |
| `idempotency_key` | Stable key for event and consumer deduplication. |

Conditionally required fields:

| Field | Required when |
|---|---|
| `club_account_id` | `purpose = club_account_top_up` or when Club Account line is part of mixed payment. |
| `top_up_id` | Club Account top-up workflow exists. |
| `order_id` | `purpose = product_purchase`. |
| `machine_id` | Payment was tied to selected machine context. |
| `provider` | External provider method was used. |
| `external_payment_reference` | External provider payment reference exists. |

Forbidden payload fields:

- raw card number;
- CVV or PIN;
- provider secret key;
- authorization headers;
- raw webhook signature;
- raw provider payload;
- unmasked provider customer reference;
- unnecessary phone, email or personal data.

## 9.5 Payload Example for Club Account Top-Up

```json
{
  "payment_completed_id": "payment_completed_01JZ0000000000000000000000",
  "payment_intent_id": "payment_intent_01JZ0000000000000000000000",
  "payment_session_id": "payment_session_01JZ0000000000000000000000",
  "payment_operation_id": "payment_op_01JZ0000000000000000000000",
  "payment_ledger_entry_id": "payment_ledger_01JZ0000000000000000000000",
  "ledger_entry_ids": [
    "ledger_entry_01JZ0000000000000000000000"
  ],
  "purpose": "club_account_top_up",
  "customer_id": "customer_01JZ0000000000000000000000",
  "club_account_id": "club_account_01JZ0000000000000000000000",
  "top_up_id": "top_up_01JZ0000000000000000000000",
  "order_id": null,
  "amount": 100,
  "currency": "RUB",
  "method_lines": [
    {
      "method": "yookassa_card",
      "provider": "yookassa",
      "amount": 100,
      "currency": "RUB",
      "external_payment_reference": "yookassa_payment_ref_masked",
      "payment_ledger_line_id": "payment_ledger_line_01JZ0000000000000000000000",
      "ledger_entry_id": "ledger_entry_01JZ0000000000000000000000"
    }
  ],
  "occurred_at": "2026-07-13T00:00:05Z",
  "correlation_id": "top_up_01JZ0000000000000000000000",
  "causation_id": "payment_ledger_01JZ0000000000000000000000",
  "idempotency_key": "payments.completed:payment_intent_01JZ:payment_ledger_01JZ"
}
```

## 9.6 Club Account Consumption Rules

Club Account may credit a top-up only when:

- event name and version are supported;
- `purpose = club_account_top_up`;
- `club_account_id` belongs to the same `customer_id`;
- `amount > 0`;
- `currency = RUB` for MVP;
- `payment_ledger_entry_id` and `ledger_entry_ids` are present;
- event idempotency key has not already produced a posted Club Account transaction;
- Club Account policy allows crediting the target account state.

Club Account transaction mapping:

| Event field | Club Account transaction field |
|---|---|
| `payment_completed_id` | `source_id` or `source_event_id`. |
| `payment_ledger_entry_id` | `payment_ledger_entry_id`. |
| `ledger_entry_ids` | `ledger_entry_id` or Ledger reference list. |
| `amount` | `amount` and `available_delta`. |
| `currency` | `currency`. |
| `purpose` | `reason = customer_top_up`. |
| `idempotency_key` | `idempotency_key`. |

Account-state handling:

| Club Account state | Required behavior |
|---|---|
| `active` | Append one `top_up_credit` transaction and update available balance projection. |
| `suspended` | Credit may be applied if payment completed, but spending remains blocked; audit reason required. |
| `closing_pending` | Route to manual review unless closing policy allows credit. |
| `closed` | Do not silently reopen; route to support/finance policy. |
| unknown or mismatched account | Reject consumption and dead-letter or manual review. |

Duplicate handling:

- same `payment_completed_id` must create at most one Club Account transaction;
- same `payment_ledger_entry_id` must create at most one top-up credit for a Club Account;
- same provider reference must not bypass event idempotency;
- duplicate event delivery returns the already-posted transaction reference.

---

# 10. Idempotency Rules

## 10.1 General Rule

Every side-effecting payment action requires an idempotency key.

Duplicate request with the same key and same semantic payload returns the existing result.

Duplicate request with the same key and different semantic payload is rejected and audited.

## 10.2 Idempotency Scopes

| Scope | Recommended key pattern |
|---|---|
| PaymentIntent creation | `payment_intent:{purpose}:{source_id}:{amount}:{currency}` |
| PaymentSession creation | `payment_session:{payment_intent_id}:{provider}:{amount}:{currency}:{attempt_number}` |
| Provider payment creation | `provider_payment:{provider}:{payment_session_id}:{amount}:{currency}` |
| Provider webhook processing | `provider_webhook:{provider}:{event_reference}:{external_payment_reference}:{status}` |
| Provider status polling | `provider_status:{provider}:{external_payment_reference}:{status}:{observed_at_bucket}` |
| PaymentOperation creation | `payment_operation:{payment_intent_id}:{operation_type}:{amount}:{currency}:{causation_id}` |
| Payment ledger completion | `payment_ledger:{payment_intent_id}:{entry_type}:{ledger_entry_ids_hash}` |
| `PaymentCompleted` publication | `payments.completed:{payment_intent_id}:{payment_ledger_entry_id}` |
| Club Account top-up consumption | `club_top_up_credit:{club_account_id}:{payment_completed_id}` |
| Refund request | `refund_request:{original_payment_ledger_entry_id}:{amount}:{currency}:{reason_code}:{request_id}` |
| Provider refund command | `provider_refund:{provider}:{refund_id}:{amount}:{currency}` |
| Reconciliation import | `provider_report:{provider}:{report_reference}:{report_line_hash}` |
| Reconciliation result | `reconciliation:{run_id}:{provider}:{external_reference}:{internal_reference}` |

## 10.3 Idempotency Record Fields

| Field | Meaning |
|---|---|
| `idempotency_key` | Stable key. |
| `scope` | Operation scope. |
| `semantic_hash` | Hash of normalized semantic payload. |
| `status` | `processing`, `completed`, `failed`, `rejected` or `expired`. |
| `result_reference` | Existing payment, refund, ledger, event or transaction reference. |
| `first_seen_at` | First accepted timestamp. |
| `last_seen_at` | Last duplicate timestamp. |
| `expires_at` | Retention expiry when allowed. |
| `actor_context` | Safe actor reference. |
| `correlation_id` | Flow ID. |

Idempotency records must not contain provider secrets, raw card data, raw personal data, raw webhook signatures or unmasked authorization data.

## 10.4 Event Idempotency

Event producers:

- publication retries must reuse the same `event_id`;
- a new `event_id` for the same financial fact is a duplicate risk and must be rejected or bridged by explicit migration policy;
- `PaymentCompleted` must be keyed by `payment_intent_id + payment_ledger_entry_id`;
- `RefundCompleted` must be keyed by `refund_id + payment_ledger_entry_id`.

Event consumers:

- consumers deduplicate by `event_id` and domain idempotency key;
- Club Account deduplicates by `payment_completed_id`, `payment_ledger_entry_id` and top-up transaction idempotency key;
- replay must not repeat balance credits, machine commands, refunds or customer notifications unless replay policy explicitly permits a dry-run or projection rebuild mode.

## 10.5 Provider Idempotency

Provider side effects:

- use provider-supported idempotency keys for create payment, capture, cancel and refund commands;
- store provider idempotency key with PaymentSession, PaymentOperation or Refund record;
- never retry a provider side effect with a different key while provider outcome is unknown;
- read provider state before retrying after timeout;
- if provider response conflicts with platform payload hash, route to manual review.

## 10.6 Reconciliation Idempotency

Report imports and reconciliation runs:

- importing the same report twice must not create duplicate registry records;
- importing a corrected report must create a new report version or correction record;
- the same provider report line can resolve only one canonical platform payment or refund unless manual review approves split handling;
- reconciliation reruns may update operational resolution state but must not create duplicate PaymentOperations, Ledger entries or Club Account transactions.

---

# 11. Implementation Guardrails

Future implementation must preserve these guardrails:

1. Payment provider success must not mutate Club Account directly.
2. `PaymentCompleted` means provider-independent payment success plus accepted Ledger-backed policy.
3. `RefundCompleted` means provider-independent refund success plus accepted Ledger-backed policy.
4. PaymentRegistry records provider facts; it does not replace Ledger.
5. Reconciliation cannot silently edit financial history.
6. Corrections and refunds are compensating entries.
7. YooKassa statuses must stay inside adapter mapping.
8. Raw webhook payloads stay in protected integration storage.
9. Club Account credits top-up from event contract only.
10. Duplicate webhooks, retries, report imports and event deliveries must be harmless.
11. Machine dispatch must never read raw provider status as payment proof.
12. Accounting export must use Ledger-backed facts and registry references.

---

# 12. Readiness Criteria

This contract is documentation-ready when:

- Payment ledger model is defined;
- Payment registry model is defined;
- YooKassa payment, webhook and refund mapping is defined;
- settlement reconciliation workflow and mismatch taxonomy are defined;
- refund lifecycle is defined;
- `PaymentCompleted` event contract with Club Account is defined;
- idempotency rules are defined;
- `ENGINEERING_JOURNAL.md` is updated;
- `docs/architecture/PROJECT_DECISIONS.md` is updated;
- `git diff --check` passes;
- no build is run because this task is documentation-only.

Future implementation readiness additionally requires:

- database schema contract;
- command and query schemas;
- Event Registry entry for `Payments.Completed` or approved canonical name;
- webhook verification policy;
- YooKassa adapter interface;
- Ledger command contract;
- Club Account consumer command contract;
- reconciliation job contract;
- refund authorization policy;
- test scenarios for duplicate webhooks, late success, Ledger failure, refund and Club Account duplicate event consumption.

---

# 13. Documentation Scope

This document is documentation-only.

It does not introduce application code, frontend code, backend runtime code, Telegram bot code, provider calls, webhook handlers, database migrations, Prisma schema changes, environment variables, real API keys, generated build output, Club Account transaction implementation, Order transition implementation or Machine dispatch behavior.
