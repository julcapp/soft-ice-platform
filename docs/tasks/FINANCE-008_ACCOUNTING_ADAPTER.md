# FINANCE-008 - Accounting Adapter

Document: Accounting Adapter Task
Code: TASK-FINANCE-008
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
- `docs/architecture/ACCOUNTING_ADAPTER.md`
- `docs/governance/ENGINEERING_PROCESS.md`
- `docs/governance/QUALITY_GATES.md`

---

# 1. Epic Goal

Define Accounting Adapter as the Finance Platform integration boundary for external accounting systems.

FINANCE-008 prepares future Accounting Adapter implementation by documenting:

- purpose;
- architecture role;
- reason for using the Adapter pattern;
- supported accounting system categories;
- Ledger integration;
- export model;
- import model;
- synchronization;
- Event interaction;
- error handling;
- retry policy;
- reconciliation;
- idempotency;
- audit;
- security;
- future ERP integration;
- future API integration;
- architecture principles.

This task is documentation-only.

Strategic rules:

```text
Ledger remains the source of truth.
Accounting Adapter translates Ledger-backed facts.
External accounting systems are integrations, not platform core.
Accounting synchronization must be idempotent, auditable and retry-safe.
```

---

# 2. Business Value

Accounting Adapter allows Soft ICE Platform to prepare reliable accounting exports without coupling core finance domains to a specific accounting vendor.

Business value:

- accountant can receive Ledger-backed financial facts;
- external accounting systems can receive platform financial data through controlled adapters;
- manual file export can be supported before direct API integration;
- Payment, Wallet, Ledger, Pricing, Discount, Bonus, Order and UI remain independent from accounting vendor details;
- refunds and corrections remain auditable compensating operations;
- reconciliation can detect missing exports, duplicate documents and amount mismatches;
- future 1C, cloud accounting or ERP integrations can be added without rewriting Finance Platform core;
- financial traceability improves for support, accounting and operations.

Accounting Adapter supports the MVP goal by preparing the accounting path for completed purchase payments without changing the customer purchase flow.

---

# 3. Architecture Scope

Included:

- Accounting Adapter purpose;
- architecture role;
- Adapter pattern rationale;
- supported accounting system categories;
- Ledger integration rules;
- platform export model;
- platform import model;
- synchronization modes and flow;
- Event Platform interaction;
- error categories and handling rules;
- retry policy;
- reconciliation model;
- idempotency rules;
- audit model;
- security rules;
- future ERP integration;
- future API integration;
- architecture principles;
- future implementation roadmap.

Explicit architecture boundaries:

- Accounting Adapter reads Ledger-backed facts.
- Accounting Adapter does not create financial truth.
- Accounting Adapter does not edit or delete Ledger entries.
- Accounting Adapter does not calculate prices.
- Accounting Adapter does not collect payments.
- Accounting Adapter does not own Wallet balance.
- Accounting Adapter does not own Bonus, Discount, Product, Order or Machine rules.
- External accounting system schemas stay behind adapters.
- External accounting acknowledgement is operational feedback, not platform financial history.

---

# 4. Acceptance Criteria

FINANCE-008 documentation is accepted when:

- `docs/architecture/ACCOUNTING_ADAPTER.md` defines Accounting Adapter purpose;
- architecture role is documented;
- Adapter pattern rationale is documented;
- supported accounting systems are documented as categories and future candidates;
- Ledger integration states that Ledger remains the source of truth;
- export model is documented;
- import model is documented;
- synchronization is documented;
- Event interaction is documented;
- error handling is documented;
- retry policy is documented;
- reconciliation is documented;
- idempotency is documented;
- audit is documented;
- security is documented;
- future ERP integration is documented;
- future API integration is documented;
- architecture principles are documented;
- `docs/tasks/FINANCE-008_ACCOUNTING_ADAPTER.md` documents epic goal, business value, architecture scope, acceptance criteria, future roadmap and out of scope;
- no application source code is changed.

Future implementation acceptance criteria:

- Accounting Adapter follows DDD Lite and platform contract boundaries;
- Accounting Export Batch model exists;
- Accounting Export Item model exists;
- Accounting Import or Acknowledgement model exists;
- Accounting System Adapter contract exists;
- manual file export adapter exists before direct API integration if selected for MVP;
- each export item references Ledger entry IDs;
- external accounting references are stored as integration metadata;
- retry is idempotent and bounded;
- reconciliation report identifies matched, missing, duplicate and mismatched items;
- accounting events follow Event Platform envelope rules;
- secrets are stored outside frontend code;
- UI and finance domains do not import vendor SDKs;
- build is required only when source implementation is introduced.

---

# 5. Future Roadmap

## Phase 0 - Documentation

Deliverables:

- update `docs/architecture/ACCOUNTING_ADAPTER.md`;
- update `docs/tasks/FINANCE-008_ACCOUNTING_ADAPTER.md`;
- optionally update documentation trackers;
- do not change application source code.

## Phase 1 - Contract Alignment

Deliverables:

- Accounting Export Batch contract;
- Accounting Export Item contract;
- Accounting Import Acknowledgement contract;
- accounting synchronization state contract;
- accounting event contracts;
- idempotency key policy;
- audit record contract;
- reconciliation result contract.

## Phase 2 - Ledger Mapping

Deliverables:

- Ledger operation type to accounting operation mapping;
- sale mapping;
- payment mapping;
- refund mapping;
- wallet movement mapping;
- bonus and discount reference rules;
- correction and adjustment mapping;
- accounting period assignment policy.

## Phase 3 - Manual Export

Deliverables:

- CSV export format;
- XLSX export format if needed;
- JSON export format for technical audit;
- export batch generation workflow;
- manual download or storage policy;
- import acknowledgement workflow;
- operator audit fields.

## Phase 4 - Accounting Adapter Foundation

Deliverables:

- Accounting Export Batch Entity;
- Accounting Export Item Entity;
- Accounting Import Entity or Acknowledgement Entity;
- Accounting Repository;
- Accounting Service;
- Accounting Adapter facade;
- Accounting System Adapter interface;
- module exports;
- unit test fixtures for export, import, retry and idempotency.

## Phase 5 - Reconciliation

Deliverables:

- Ledger versus export reconciliation;
- export versus acknowledgement reconciliation;
- duplicate external document detection;
- amount mismatch detection;
- missing export report;
- missing acknowledgement report;
- manual review queue contract.

## Phase 6 - Direct API Adapter

Deliverables:

- selected accounting API adapter;
- secure credential storage;
- send export operation;
- read status operation;
- import acknowledgement operation;
- external error normalization;
- rate limit and retry handling;
- file export fallback.

## Phase 7 - ERP Expansion

Deliverables:

- ERP adapter assessment;
- branch, machine or location accounting dimensions;
- franchise or partner settlement assessment;
- inventory and procurement integration boundaries;
- consolidated reporting requirements;
- legal and tax review checkpoints.

## Phase 8 - Production Hardening

Deliverables:

- observability for accounting synchronization;
- audit retention policy;
- incident runbook for duplicate export, missing export and external rejection;
- closed period policy;
- access control review;
- data minimization review;
- backup and recovery checks for export and import records.

---

# 6. Out of Scope

Out of scope for this documentation task:

- writing JavaScript;
- modifying `frontend/`;
- modifying `backend/`;
- modifying `App.jsx`;
- modifying routes;
- modifying styles;
- adding dependencies;
- running build;
- creating backend APIs;
- adding database migrations;
- implementing Accounting Adapter code;
- implementing file export;
- implementing direct accounting API calls;
- selecting or approving a production accounting vendor;
- adding accounting credentials;
- implementing fiscalization;
- implementing tax calculation;
- implementing Payment Engine code;
- implementing Ledger domain code;
- implementing Wallet domain code;
- implementing Bonus or Discount domain code;
- implementing Order domain code;
- implementing CRM screens;
- implementing reporting dashboards;
- changing product, price, discount, bonus, wallet or payment business decisions.

This pass is complete when the documentation is updated and final report confirms:

- changed files;
- accounting adapter architecture summary;
- Ledger integration;
- export and import model;
- synchronization, retry and reconciliation boundaries;
- future roadmap;
- no application code was modified.
