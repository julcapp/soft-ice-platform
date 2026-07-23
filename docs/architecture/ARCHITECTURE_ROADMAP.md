# Architecture Roadmap

Status: Approved
Version: 2.1
Checkpoint date: 2026-07-23
Project: Soft ICE Platform / «У Тимоши»

## Purpose

This roadmap records the accepted sequence after Soft ICE Platform Master Architecture Map v1. It is a planning document, not evidence that a capability is implemented.

## Current checkpoint

Master Architecture Map v1 defines eight platform areas: Customer, CRM/Admin Console, Machine, Machine Operations, Payment, Advertising, Identity/Security and Infrastructure. The accepted boundary and governance documents now gate every future module and implementation slice.

Machine Operations remains a bounded context separate from CRM. CRM/Admin Console remains the central management surface but accesses Machine Operations, Payment, Pricing, Loyalty, Advertising and other domains only through their contracts.

Advertising remains a future bounded context with authenticated-customer, verified-phone and active-consent gates. Delivery, ranking, targeting and optimization algorithms remain deferred.

Admin Console Foundation v1 and Executive Console are now accepted architecture. Admin Console is a permission-scoped orchestration and projection surface; Executive Console is a separate, primarily read-only reporting surface. Neither owns domain facts. Their APIs, dashboard families, operator and inventory workflows, advertising integration, audit envelope and future advisory AI boundary are defined in ADR-014 and ADR-015. This is documentation, not implementation.

## Delivery sequence

| Phase | Architecture outcome | Status |
|---|---|---|
| 1. Master architecture baseline | Approve platform map, boundaries, roles/access, data flows and governance rules. | Accepted documentation |
| 2. Production payment slice | Implement one provider-backed checkout/payment session, authenticated idempotent webhook, accepted ledger fact and reconciliation path without vendor leakage. | Next / implementation required |
| 3. End-to-end paid dispense | Connect Mini App checkout to accepted payment, Order and `MachineGateway`; validate recovery against simulator and physical-machine boundary. | Future |
| 4. Admin Console Foundation v1 | Implement the separate Admin BFF, backend-enforced permission/scope checks, owning-domain command/query contracts, reporting projections and audit pipeline defined by ADR-014. | Architecture accepted / implementation future |
| 5. Machine Operations hardening | Add evidence policy, batch/expiry tracking, inventory reconciliation, scheduling/routes/GPS and offline behavior in separate approved slices. | Future |
| 6. Customer growth modules | Deliver dedicated Customer Profile, Loyalty, Referral, Segmentation and analytics increments without moving policy into Customer UI. | Future |
| 7. Advertising foundation implementation | Implement advertiser/campaign/creative/placement/referral/click/conversion contracts with authentication, verified-phone and consent gates. | Future |
| 8. Advertising execution | Design delivery, ranking, targeting, frequency and optimization only after separate Product Owner and privacy approval. | Deferred |
| 9. Executive Console | Implement a separate read-mostly executive surface over governed, versioned and freshness-labelled reporting projections. | Architecture accepted / implementation future |
| 10. AI Supervisor | Evaluate an evidence-linked advisory supervisor only after reporting governance, privacy, model-risk, evaluation and human-approval policies receive separate approval. | Deferred |

## Guardrails

- Operator App cannot change prices, commercial machine settings, loyalty rules, advertising or customers.
- Administrator actions are permission-controlled and audited; administrator access does not bypass domain rules.
- Test consumption is not sales consumption, but both contribute to total stock reconciliation.
- CRM/Admin Console orchestrates management views through domain contracts; it does not absorb Machine Operations or Advertising ownership.
- Executive Console has no implicit administrative mutation authority; cross-surface role possession requires explicit authorization.
- Reports and dashboards are versioned projections with visible freshness and cannot be edited as source facts.
- AI Supervisor is advisory by default, cannot become an autonomous command path and is never required for platform correctness.
- Advertising requires an authenticated customer identity with at least a verified phone number and applicable consent at every controlled use.
- Customer, Operator and Administrator interfaces remain separate.
- Vendor-specific machine details remain behind `MachineGateway` adapters; payment-provider details remain behind Payment adapters.
- Every new module requires a domain document and every major architectural choice requires an ADR.
- Each slice updates applicable tests, API/event contracts, changelog and Architecture Status.
- Status claims distinguish Implemented, Foundation, Documented and Future.
- Application code, Prisma schema and business logic are outside this documentation checkpoint.

## Related documents

- `docs/domain/MACHINE_OPERATIONS_PLATFORM.md`
- `docs/domain/ADVERTISING_PLATFORM.md`
- `docs/architecture/SOFT_ICE_PLATFORM_MAP.md`
- `docs/architecture/PLATFORM_BOUNDARIES.md`
- `docs/architecture/PLATFORM_ROLES_AND_ACCESS.md`
- `docs/architecture/PLATFORM_DATA_FLOWS.md`
- `docs/architecture/ARCHITECTURE_GOVERNANCE.md`
- `docs/architecture/ADR/ADR-006-machine-operations-separation.md`
- `docs/architecture/ADR/ADR-007-advertising-platform.md`
- `docs/architecture/ADR/ADR-014-admin-console-foundation-v1.md`
- `docs/architecture/ADR/ADR-015-executive-console-and-ai-supervisor.md`
- `docs/architecture/ROADMAP_NEXT_PHASE.md`
- `docs/architecture/ARCHITECTURE_STATUS.md`
