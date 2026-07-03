# Accounting Adapter

Document code: ARCH-FIN-ACCOUNTING-001
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
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/architecture/EVENT_PLATFORM.md`
- `docs/tasks/FINANCE-008_ACCOUNTING_ADAPTER.md`
- `docs/governance/ENGINEERING_PROCESS.md`
- `docs/governance/QUALITY_GATES.md`

---

# 1. Purpose

Accounting Adapter defines how Soft ICE Platform exchanges financial facts with external accounting systems without making those systems part of the platform core.

Accounting Adapter exists so the platform can:

- export Ledger-backed financial facts to accounting systems;
- preserve Ledger as the source of truth for financial history;
- map platform operation types to accounting documents, postings and reports;
- import external accounting acknowledgements, references and reconciliation results;
- support manual accounting exports before direct API integrations are approved;
- isolate accounting system formats, credentials and API behavior behind adapters;
- make accounting synchronization auditable, idempotent and repeatable.

Core boundary:

```text
Ledger is the financial source of truth.
Accounting Adapter translates Ledger-backed facts for external systems.
Accounting Adapter does not calculate prices, collect payments or mutate original Ledger entries.
```

Accounting Adapter is not a payment provider, fiscalization engine, tax advisory module, CRM screen or reporting database.

---

# 2. Architecture Role

Accounting Adapter belongs to the Finance Platform integration boundary.

Architecture position:

```text
Payment / Wallet / Bonus / Discount / Refund flow
->
Transaction
->
Ledger
->
Accounting Adapter
->
External accounting system
```

Accounting Adapter owns:

- accounting export preparation;
- accounting import preparation;
- mapping from platform finance concepts to external accounting documents;
- external accounting system adapter contracts;
- synchronization state for export and import batches;
- external accounting reference storage;
- accounting-specific idempotency keys;
- accounting synchronization audit trail;
- reconciliation reports.

Accounting Adapter does not own:

- Product Catalog;
- Configuration;
- Pricing;
- Discount calculation;
- Bonus lifecycle;
- Wallet projection;
- Payment provider settlement;
- original Ledger entries;
- external accounting system configuration as source of platform truth;
- fiscal receipt generation unless a future fiscalization decision explicitly assigns it.

Accounting Adapter may read Ledger entries, Payment references, Order references and Customer references needed for accounting export. It must not use external accounting state to rewrite accepted platform financial history.

---

# 3. Why Adapter Pattern

Accounting integration must use the Adapter pattern because accounting systems differ in API shape, file formats, document models, chart of accounts, tax fields, posting rules, retry behavior and validation errors.

Adapter pattern gives the platform:

- a stable platform-owned accounting contract;
- replaceable external accounting integrations;
- isolation from vendor-specific request and response formats;
- controlled mapping from Ledger operation types to accounting documents;
- local testability without calling external accounting systems;
- safe transition from manual file export to direct API integration;
- idempotency and retry behavior independent from vendor APIs;
- reduced risk that accounting system changes leak into Payment, Ledger, Wallet, Order or UI code.

Required boundary:

```text
Ledger Entry
->
Platform Accounting Export Model
->
Accounting System Adapter
->
External System Format
```

Never:

```text
Payment / UI / Wallet -> External accounting API
```

Each external accounting system receives its own adapter. Platform domains depend only on platform contracts, not vendor SDKs or document schemas.

---

# 4. Supported Accounting Systems

This document defines supported accounting system categories, not production approval for a specific vendor.

Supported integration categories:

| Category | Initial support model | Notes |
|---|---|---|
| File export | CSV, XLSX or JSON batch export | MVP-friendly manual accounting handoff. |
| Russian accounting systems | Future adapter candidate such as 1C accounting products | Requires legal, tax and operator approval before production use. |
| Cloud accounting systems | Future API adapter candidate | Must preserve platform contracts and idempotency. |
| ERP systems | Future ERP adapter | Covered by future ERP integration rules. |
| Data warehouse / BI | Read-only financial fact export | Must not become the accounting source of truth. |

System approval rules:

- a named accounting system is not considered production-supported until Product Owner approval;
- tax, fiscalization and legal requirements require separate review;
- provider credentials must never be stored in frontend code;
- vendor-specific schemas stay inside that vendor adapter;
- historical exports must remain reproducible after adding a new system.

Initial implementation should prefer export files or a local adapter contract before direct external API calls.

---

# 5. Ledger Integration

Ledger is the only source of truth for financial history.

Accounting Adapter reads Ledger entries and related references. It does not create, update or delete original Ledger entries.

Ledger integration rules:

- every accounting export item must reference one or more Ledger entry IDs;
- export uses immutable Ledger facts, not UI state or provider callback payloads;
- refunds and corrections are exported as separate compensating facts;
- external accounting acknowledgement does not change the original Ledger entry;
- if an external accounting system rejects a record, the platform records an accounting sync error and keeps the Ledger unchanged;
- any platform financial correction must go through approved Transaction and Ledger workflows;
- Ledger wins when external accounting data conflicts with platform financial history.

Minimum Ledger references:

```text
ledger_entry_id
transaction_id
operation_type
amount
currency
debit
credit
created_at
reference_id
status
metadata
```

Accounting Adapter may create its own synchronization records that reference Ledger entries. Those records are operational integration state, not financial history.

---

# 6. Export Model

Export Model is the platform-owned representation of accounting facts prepared from Ledger.

Export model responsibilities:

- group Ledger entries into export batches;
- normalize operation types for accounting mapping;
- include stable platform IDs for traceability;
- include amount, currency, debit, credit and tax classification fields when approved;
- include order, payment, refund, wallet and customer references when required;
- include mapping version and adapter target;
- keep provider secrets and raw payment credentials out of the payload;
- preserve enough detail for reconciliation.

Minimal export batch:

```json
{
  "accounting_export_batch_id": "accounting_export_batch_01JZ0000000000000000000000",
  "target_system": "manual_file",
  "adapter_version": 1,
  "created_at": "2026-07-02T00:00:00Z",
  "currency": "RUB",
  "items": [
    {
      "accounting_export_item_id": "accounting_export_item_01JZ0000000000000000000000",
      "ledger_entry_id": "ledger_entry_01JZ0000000000000000000000",
      "transaction_id": "transaction_01JZ0000000000000000000000",
      "operation_type": "PAYMENT",
      "amount": 117,
      "currency": "RUB",
      "debit": 117,
      "credit": 0,
      "order_id": "order_01JZ0000000000000000000000",
      "payment_id": "payment_01JZ0000000000000000000000",
      "occurred_at": "2026-07-02T00:00:00Z"
    }
  ]
}
```

Export statuses:

| Status | Meaning |
|---|---|
| `prepared` | Export batch was built from Ledger facts. |
| `exported` | Batch was written to file or sent to adapter target. |
| `acknowledged` | External system accepted the batch or item. |
| `partially_acknowledged` | Some items were accepted and some need review. |
| `rejected` | External system rejected the batch or item. |
| `failed` | Technical export failure occurred. |
| `manual_review` | Operator review is required. |

The export model is a contract. External formats are generated from it by adapters.

---

# 7. Import Model

Import Model handles data coming back from accounting systems.

Allowed import data:

- external accounting document ID;
- external posting ID;
- external batch acknowledgement;
- item-level accepted or rejected status;
- validation error code and message;
- external accounting period reference;
- reconciliation result;
- manual operator note;
- external system timestamp;
- external adapter metadata.

Import data must not:

- create a new platform financial fact by itself;
- change product price;
- change payment amount;
- change wallet balance;
- edit or delete Ledger entries;
- introduce external accounting IDs as primary platform IDs;
- import secrets, credentials or raw payment data into events.

Minimal import item:

```json
{
  "accounting_import_item_id": "accounting_import_item_01JZ0000000000000000000000",
  "accounting_export_item_id": "accounting_export_item_01JZ0000000000000000000000",
  "ledger_entry_id": "ledger_entry_01JZ0000000000000000000000",
  "target_system": "manual_file",
  "external_document_id": "external_doc_ref_masked",
  "external_status": "accepted",
  "received_at": "2026-07-02T00:00:00Z"
}
```

Import is operational integration feedback. It is not the financial source of truth.

---

# 8. Synchronization

Accounting synchronization moves Ledger-backed facts to external accounting systems and records the result.

Supported synchronization modes:

- manual export file generation;
- scheduled batch export;
- event-triggered export preparation;
- direct API export through a future adapter;
- manual import of acknowledgement or reconciliation files;
- future API-based status polling.

Recommended synchronization flow:

```text
LedgerEntryRecorded
->
Accounting export eligibility check
->
AccountingExportBatch prepared
->
Adapter exports file or sends API request
->
External acknowledgement imported
->
Accounting sync state updated
->
Reconciliation report produced
```

Synchronization rules:

- only Ledger-backed facts are eligible for accounting export;
- export windows must be explicit;
- closed accounting periods must not be silently rewritten;
- a failed export item can be retried with the same idempotency identity;
- partial success must preserve item-level status;
- manual correction requires operator actor, reason and audit record;
- synchronization records are append-only where possible.

The first implementation may be file-based. The architecture must still preserve adapter boundaries so API integration can be added later.

---

# 9. Event Interaction

Accounting Adapter follows Event Platform rules.

Accounting Adapter may consume events such as:

| Event | Purpose |
|---|---|
| `LedgerEntryRecorded` | Marks a financial fact as available for export. |
| `PaymentCompleted` | Provides settlement correlation when payment is complete. |
| `RefundCompleted` | Provides refund correlation for compensating export. |
| `AccountingExportRequested` | Future operational command-like request represented as an accepted workflow fact. |

Accounting Adapter may publish events such as:

| Event | Type | Meaning |
|---|---|---|
| `AccountingExportPrepared` | domain | Export batch was prepared from Ledger facts. |
| `AccountingExported` | integration | Export was sent or generated for an external system. |
| `AccountingExportAcknowledged` | integration | External system acknowledged export. |
| `AccountingExportRejected` | integration | External system rejected export or item. |
| `AccountingImportProcessed` | domain | Import feedback was processed. |
| `AccountingReconciliationCompleted` | integration | Reconciliation report completed. |
| `AccountingManualReviewRequested` | integration | Operator review is required. |

Event rules:

- events are facts, not external accounting commands;
- payloads include stable platform IDs and external references only when safe;
- event payloads must not include accounting credentials, tokens or payment secrets;
- consumers must be idempotent;
- Event Storage does not replace Ledger or accounting sync records.

---

# 10. Error Handling

Accounting Adapter separates business validation errors, mapping errors, external system errors and technical failures.

Error categories:

| Category | Examples | Handling |
|---|---|---|
| Validation error | Missing required accounting field, unsupported currency | Mark item rejected or manual review. |
| Mapping error | No mapping for operation type or account code | Stop item export and request mapping review. |
| External rejection | External system rejects document | Store rejection details and keep Ledger unchanged. |
| Technical failure | Network timeout, file write failure, unavailable API | Retry if idempotent and safe. |
| Security failure | Invalid credentials, unauthorized adapter response | Stop synchronization and alert operator. |
| Data conflict | External amount differs from Ledger amount | Mark manual review and reconcile. |

Error handling rules:

- never hide failed accounting export;
- never change Ledger to satisfy external validation;
- preserve original error code and normalized error category;
- mask sensitive values in logs, events and audit views;
- operator action must include actor ID and reason;
- repeated failures must produce manual review or dead-letter state.

---

# 11. Retry Policy

Accounting retries must be idempotent and bounded.

Retry applies to:

- export batch generation;
- file write or upload;
- API send operation;
- acknowledgement import;
- status polling;
- event publication;
- reconciliation job.

Retry rules:

- retry only operations with a stable idempotency key;
- retry with the same semantic payload;
- do not retry rejected business validation as a technical retry;
- use exponential backoff with a bounded retry count for technical failures;
- read current synchronization state before repeating an external side effect;
- preserve item-level statuses for partial success;
- route repeated failures to `manual_review`;
- never create duplicate accounting documents for the same Ledger entry and target system.

Recommended retry identity:

```text
target_system + ledger_entry_id + operation_type + amount + currency + accounting_period
```

Retry must favor reconciliation and status checks over duplicate exports.

---

# 12. Reconciliation

Reconciliation compares platform Ledger facts with accounting export/import state and external accounting reports.

Reconciliation inputs:

- Ledger entries;
- accounting export batches;
- accounting import acknowledgements;
- external accounting document references;
- provider settlement reports when relevant;
- payment and refund references;
- operator manual corrections.

Reconciliation checks:

- Ledger entry exists for every exported item;
- exported amount equals Ledger amount;
- currency matches;
- operation type mapping is valid;
- external acknowledgement exists where required;
- refund or correction is represented as a separate compensating item;
- no duplicate external accounting document exists for the same Ledger entry;
- accounting period assignment is valid;
- unresolved errors are visible.

Reconciliation outcomes:

| Outcome | Meaning |
|---|---|
| `matched` | Ledger, export and external acknowledgement agree. |
| `missing_export` | Ledger fact has not been exported. |
| `missing_acknowledgement` | Export happened but external acceptance is unknown. |
| `amount_mismatch` | External amount differs from Ledger. |
| `duplicate_external_document` | Same Ledger fact appears more than once externally. |
| `manual_review` | Operator or accountant review is required. |

Reconciliation never edits original Ledger entries. Corrections are handled through approved finance correction workflows.

---

# 13. Idempotency

Accounting Adapter operations must be idempotent.

Idempotency applies to:

- export batch creation;
- export item creation;
- file generation;
- API export;
- acknowledgement import;
- event publishing;
- retry workers;
- reconciliation runs;
- operator replays.

Rules:

- every export item has a stable platform ID;
- every external side-effect operation has an idempotency key;
- the same Ledger entry cannot be exported twice to the same target, accounting period and operation identity unless explicitly marked as a corrected export;
- duplicate import acknowledgements update synchronization state only once;
- duplicate events must be deduplicated by `event_id`;
- same idempotency key with different payload must be rejected;
- idempotency records must not contain credentials or secrets.

Idempotency is mandatory because accounting synchronization can be at-least-once, manual and retried.

---

# 14. Audit

Accounting Adapter must be auditable.

Audit records should capture:

- actor type and actor ID;
- system or adapter name;
- export batch ID;
- export item IDs;
- Ledger entry IDs;
- external document references;
- operation type;
- amount and currency;
- status transitions;
- retry count;
- error category;
- manual review reason;
- timestamp;
- correlation ID and causation ID.

Audit rules:

- audit records are append-only where possible;
- manual export, import, retry and correction actions require actor and reason;
- audit logs must not contain credentials, tokens, raw payment credentials or unmasked secrets;
- audit data must support accountant review, support review and incident investigation;
- retention policy must follow legal, privacy and business requirements.

Audit does not replace Ledger. Ledger remains the financial history; audit explains synchronization behavior around that history.

---

# 15. Security

Accounting Adapter is security-sensitive because it handles financial facts and external system credentials.

Security rules:

- credentials and API tokens must be stored outside frontend code;
- adapter secrets must not appear in events, logs, examples or exported files;
- export files must be protected from unauthorized access;
- external accounting API calls require authenticated service identity;
- operator access requires role-based authorization;
- imports must be validated before processing;
- external file uploads must be checked for expected format and source;
- personal data must be minimized in exports;
- payment provider secrets and raw card data are forbidden in accounting payloads;
- accounting events must mask external references when needed;
- closed accounting period operations require elevated permission and explicit reason.

Security-sensitive actions:

- creating export batch;
- sending export to external system;
- importing acknowledgement;
- changing mapping rules;
- retrying failed export;
- marking item as manually reconciled;
- accessing export files.

---

# 16. Future ERP Integration

Future ERP integration may connect Accounting Adapter with broader enterprise systems.

ERP integration may include:

- accounting documents;
- sales documents;
- inventory cost references;
- revenue reports;
- machine location or branch accounting;
- supplier and procurement references;
- franchise or partner settlement reports;
- consolidated reporting.

ERP rules:

- ERP must not become the source of platform product, payment or Ledger truth;
- ERP integration uses the same Accounting Adapter boundary;
- ERP-specific schemas stay inside ERP adapters;
- ERP import must not overwrite platform financial history;
- ERP reconciliation must reference Ledger entry IDs;
- inventory or procurement integration requires separate architecture decision;
- franchise settlement requires Product Owner and legal approval.

ERP integration is a future capability and is out of scope for the documentation task implementation.

---

# 17. Future API Integration

Future API integration replaces or complements manual file export with direct accounting system APIs.

API integration requirements:

- adapter contract must hide vendor SDK and request shapes;
- API authentication must use secure backend-side secret storage;
- every API side effect must use idempotency keys when supported;
- API status polling must be reconciled with export state;
- webhook or callback inputs must be authenticated before processing;
- external rate limits must be respected;
- API errors must be normalized into platform categories;
- API contract version changes must be documented;
- file export fallback should remain available for operational resilience.

Future API flow:

```text
LedgerEntryRecorded
->
AccountingExportBatch prepared
->
AccountingSystemAdapter.sendExport()
->
External API acknowledgement
->
AccountingImportProcessed
->
Reconciliation
```

Adding API integration must not require changes to Payment, Wallet, Ledger, Pricing, Discount, Bonus, Order or UI business logic.

---

# 18. Architecture Principles

Accounting Adapter architecture follows these principles:

1. Ledger remains the source of truth for financial history.
2. Accounting Adapter translates Ledger-backed facts; it does not create financial truth.
3. External accounting systems are integrations, not platform core.
4. Adapter pattern is mandatory for external accounting systems.
5. Vendor-specific schemas stay inside vendor adapters.
6. Export and import models are platform-owned contracts.
7. Accounting import feedback cannot edit or delete original Ledger entries.
8. Refunds and corrections are exported as compensating facts.
9. Synchronization must be idempotent, auditable and retry-safe.
10. Reconciliation compares Ledger, export state and external acknowledgements.
11. Event interaction follows Event Platform contracts.
12. Accounting events must not expose credentials, tokens or payment secrets.
13. Manual actions require actor, timestamp and reason.
14. File export is acceptable for MVP if adapter boundaries remain stable.
15. Future ERP and API integrations must not change Payment, Wallet, Ledger, Pricing, Discount, Bonus, Order or UI business logic.
16. Production accounting system approval requires Product Owner approval and legal or tax review where needed.
17. Accounting Adapter is architecture-only in FINANCE-008 and does not introduce application code.
