# Roadmap: Next Phase

Status: Proposed sequencing under Master Architecture Map v1
Version: 2.0
Date: 2026-07-23

## Objective

Convert the Master Architecture Map v1 into separately approved, production-oriented increments while retaining domain ownership, backend-enforced permissions, vendor isolation and honest capability status.

## Recommended increments

### 1. Payment Platform production slice

- select one approved production payment channel and record provider decisions in an ADR;
- implement provider-neutral checkout, payment intent/session and accepted payment fact;
- implement authenticated, replay-safe and idempotent provider confirmation;
- post immutable ledger/operation facts and define reconciliation evidence;
- keep YooKassa, Sber and SBP provider types inside adapter boundaries.

### 2. Paid purchase-to-dispense completion

- wire Mini App checkout to backend Product, Pricing, Order and Payment contracts;
- allow Order to accept only Payment Core confirmation;
- dispatch only paid orders through `MachineGateway`;
- validate success, timeout, duplicate webhook, duplicate command, dispense failure and recovery paths;
- keep final price and media selection out of UI components.

### 3. CRM/Admin Console security and management foundation

- establish a separate Administrator interface and session boundary;
- enforce granular backend permissions for prices, product commercial settings, loyalty and advertising;
- expose payment reconciliation, operator oversight and audit through owning-domain queries;
- version and audit configuration changes;
- prohibit direct database editing from management workflows.

### 4. Machine Operations and inventory hardening

- reconcile current implementation with the master access matrix;
- guarantee every test dispense produces linked non-sale inventory consumption;
- define immutable checklist attachment and service-report approval transitions;
- add before/after evidence, batch/expiry and reconciliation policy;
- separately design scheduling, routes, GPS and offline synchronization.

### 5. Customer Platform completion

- complete Customer Profile, Club Account and production purchase history;
- define dedicated Loyalty, Referral and Segmentation module slices;
- preserve canonical `customer_id`, verified-provider boundaries and consent history;
- keep customer, operator and administrator interfaces separate;
- reserve the future advertising carousel behind explicit eligibility gates.

### 6. Advertising foundation implementation proposal

- define entity states and authorization contracts for Advertiser, Campaign, Creative, Placement, Referral Link, Click Event and Conversion Event;
- bind advertiser eligibility to authenticated customer identity and verified phone;
- enforce authoritative consent checks and withdrawal behavior;
- submit moderation, retention, attribution and anti-fraud decisions for Product Owner approval.

Delivery algorithms remain outside this phase.

## Entry gates

- Product Owner approval for major product or commercial decisions;
- explicit domain ownership and permission matrix;
- an approved domain document for every new module;
- an ADR for every major architectural choice;
- privacy/security review for identity, consent, photos, GPS and click data;
- inventory reconciliation acceptance criteria;
- adapter contracts for every external machine, payment or identity provider;
- migration, API and behavior changes scoped in a later engineering increment.

## Completion evidence for later implementation

Each implementation increment must include code, migrations where approved, automated tests, updated API/event contracts, updated test scenarios, changelog and Architecture Status, successful required builds and no generated build output committed.

Documentation for each slice must identify what is Implemented, Foundation, Documented and Future. This Master Architecture Map v1 checkpoint itself remains documentation-only.
