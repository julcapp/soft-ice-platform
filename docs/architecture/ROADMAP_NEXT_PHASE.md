# Roadmap: Next Phase

Status: Proposed sequencing under accepted architecture
Version: 1.0
Date: 2026-07-23

## Objective

Convert the Machine Operations checkpoint into separately approved, testable increments while retaining CRM/Admin Console as the central management surface and keeping Advertising execution deferred.

## Recommended increments

### 1. Machine Operations contract hardening

- reconcile current Machine Operations implementation and documentation with the accepted permission matrix;
- define immutable checklist-version attachment and service-report approval transitions;
- define inventory-ledger integration for all accepted test-consumption reasons;
- verify administrator actions are separately attributed and audited.

### 2. Operator evidence and inventory traceability

- add before/after evidence policy;
- define ingredient batch and expiry capture;
- define media retention, privacy and access rules;
- define stock reconciliation reports separating sales, tests, cleaning, calibration and waste.

### 3. Field operations planning

- define maintenance schedules, operator routes and GPS confirmation policy;
- define senior operator permissions without weakening administrator separation;
- define digital service acceptance and dispute history.

### 4. Offline Operator App architecture

- define local encrypted storage, assignment scope and data minimization;
- define idempotency, synchronization, conflict resolution and evidence upload recovery;
- define revoked-access and stale-checklist behavior while offline.

### 5. CRM/Admin Console integration

- expose central views for customers, loyalty, payments, reports, analytics and commercial settings;
- add operator monitoring and Machine Operations oversight through owned APIs/contracts;
- add service-report approval and audit views;
- reserve future Advertising management navigation without implementing delivery.

### 6. Advertising foundation implementation proposal

- define entity states and authorization contracts for advertiser, campaign, creative, placement, referral link and click;
- bind advertiser eligibility to authenticated customer identity and verified phone;
- enforce authoritative consent checks and withdrawal behavior;
- submit moderation, retention, attribution and anti-fraud decisions for Product Owner approval.

Delivery algorithms remain outside this phase.

## Entry gates

- Product Owner approval for major product or commercial decisions;
- explicit domain ownership and permission matrix;
- privacy/security review for identity, consent, photos, GPS and click data;
- inventory reconciliation acceptance criteria;
- migration, API and behavior changes scoped in a later engineering increment.

## Completion evidence for later implementation

Each implementation increment must include code, migrations where approved, automated tests, updated test scenarios and changelog, successful builds and no generated build output committed. This checkpoint itself remains documentation-only.
