# Architecture Roadmap

Status: Approved
Version: 1.0
Checkpoint date: 2026-07-23
Project: Soft ICE Platform / «У Тимоши»

## Purpose

This roadmap records the accepted architecture sequence after the Machine Operations checkpoint. It is a planning document, not evidence that a capability is implemented.

## Current checkpoint

Machine Operations is a bounded context separate from CRM. It owns audited human service work around vending machines: assignments, maintenance tasks, versioned checklists, refill records, test runs, photo evidence, faults and service reports.

CRM/Admin Console remains the central management system. It presents customer, loyalty, payment, reporting, analytics and commercial-management capabilities and provides administrative views into Machine Operations. Interface centralization does not transfer domain ownership to CRM.

Advertising is established as a future bounded context. Its foundation separates advertiser, campaign, creative, placement, referral link and click tracking. Delivery, ranking and targeting algorithms are deferred.

## Delivery sequence

| Phase | Architecture outcome | Status |
|---|---|---|
| 1. Machine Operations checkpoint | Confirm bounded context, operator/admin permissions, test-consumption accounting and audit ownership. | Accepted |
| 2. Operational hardening | Add before/after evidence, batch and expiry capture, GPS confirmation, scheduling, routes, offline synchronization, digital acceptance and senior-operator policy through separately approved increments. | Future |
| 3. CRM/Admin integration | Provide central monitoring, task review, service-report approval and commercial administration through explicit Machine Operations contracts. | Future |
| 4. Advertising foundation | Define authenticated advertiser access, verified-phone eligibility, mandatory consent enforcement and entity lifecycles. | Accepted architecture; implementation future |
| 5. Advertising execution | Design delivery, ranking, targeting, frequency, attribution and optimization only after separate Product Owner approval. | Deferred |

## Guardrails

- Operator App cannot change prices, commercial machine settings, loyalty rules, advertising or customers.
- Administrator actions are permission-controlled and audited; administrator access does not bypass domain rules.
- Test consumption is not sales consumption, but both contribute to total stock reconciliation.
- CRM/Admin Console orchestrates management views through domain contracts; it does not absorb Machine Operations or Advertising ownership.
- Advertising requires an authenticated customer identity with at least a verified phone number and applicable consent at every controlled use.
- Application code, Prisma schema and business logic are outside this documentation checkpoint.

## Related documents

- `docs/domain/MACHINE_OPERATIONS_PLATFORM.md`
- `docs/domain/ADVERTISING_PLATFORM.md`
- `docs/architecture/ADR/ADR-006-machine-operations-separation.md`
- `docs/architecture/ADR/ADR-007-advertising-platform.md`
- `docs/architecture/ROADMAP_NEXT_PHASE.md`
- `docs/architecture/ARCHITECTURE_STATUS.md`
