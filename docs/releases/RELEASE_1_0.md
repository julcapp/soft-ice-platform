# Architecture Release 1.0

Status: Approved Baseline
Version: 1.0
Release Type: Architecture
Date: 2026-07-03
Project: Soft ICE Platform / Utimoshi

## Release Header

- Release name: Architecture Release 1.0
- Release type: Architecture
- Release owner: Engineering
- Product owner: Alexander Ilyin
- Repository: `julcapp/soft-ice-platform`
- Source branch: current working branch
- Git tag: `architecture-v1.0` when published
- GitHub release URL: To be added after publication
- Related baseline: `docs/architecture/ARCHITECTURE_BASELINE_1_0.md`

## Architecture Release 1.0

Architecture Release 1.0 establishes the official baseline for Soft ICE Platform.

The release defines the platform as a product-centered system, not a vending-machine-only interface. The primary architecture object is the product configuration and the engines that process it through catalog, configuration, recipe, pricing, wallet, payment, machine and notification stages.

The release confirms DDD Lite, domain ownership, engine boundaries, official contracts, Product Engine first development and incremental delivery as the approved foundation for future runtime implementation.

## Included Runtime

No runtime artifact is shipped by this architecture release.

Runtime status:

- Mini App runtime remains unchanged by this release.
- Frontend code is not modified by this release.
- UI code is not modified by this release.
- Application behavior is not changed by this release.

Current runtime context:

- `v0.3.0-alpha.1` is the active in-progress runtime line in `CHANGELOG.md`.
- Sprint 1.1 remains focused on Product Engine Core.
- Future runtime releases must reference this architecture baseline or a later approved architecture release.

## Included EPIC

This architecture release includes the following architecture scope:

- Product Platform baseline.
- Product Engine Core direction for Catalog, Configuration, Recipe and Pricing.
- Finance Platform direction for Wallet, Bonus, Discount, Payment, Ledger and Accounting Adapter.
- Event Platform architecture direction.
- Order Platform architecture direction.
- Machine Platform dispatch boundary.
- Notification boundary as the customer communication layer.

Included documented epic references:

- EPIC-210 Event Platform.
- EPIC-230 Order Platform.
- Sprint 1.1 Product Engine Core as the current implementation focus.

## Included ADR

Included ADR range:

- ADR-001 through ADR-024 in `docs/architecture/PROJECT_DECISIONS.md`.

Included decision groups:

- Repository and GitHub source of truth.
- Design System and responsive UI rules.
- Media library and image model.
- Product catalog as shared source of data.
- DDD Lite domain foundation.
- Catalog, Configuration, Recipe and Pricing Engine foundations.
- Event Platform.
- Bonus, Discount, Payment and Accounting Adapter boundaries.
- Order Platform, Checkout Pipeline and Order State Machine.
- Fulfillment, Cancellation, Refund and Machine Dispatch architecture.

Release governance created with this release is recorded separately as ADR-025.

## Included Business Rules

Business rules included in Architecture Release 1.0:

- GitHub is the single source of truth.
- Documentation evolves together with code.
- Business data is separated from UI.
- Product catalog is shared across all platforms.
- Business logic belongs in services and engines, not screens.
- Product configuration is central to the platform.
- The product flow is Catalog, Configuration, Recipe, Pricing, Wallet, Payment, Machine and Notification.
- Prices, product names, syrup lists, topping lists, media paths, discount rules and loyalty rules must not be hardcoded in React components.
- Stable semantic IDs are required for products, flavors, syrups, toppings and media.
- JSON is temporary storage and must be replaceable by REST API and PostgreSQL.
- Media selection logic belongs outside screens.
- Recipe mapping is required before full vending machine integration.
- One bonus is a right to a 1 RUB nominal discount and is not money.
- Wallet stores internal balances.
- Pricing calculates the financial model.
- Payment performs settlement.
- Machine controls physical equipment.

## Current Status

Architecture Baseline 1.0 is approved as the official foundation of the project.

Release documentation now defines how this architecture baseline is recorded, versioned, approved and connected to future runtime releases.

The platform remains before full commercial MVP completion. The MVP target remains:

```text
A customer can select a dessert, pay for it and receive it from a vending machine.
```

## Architecture Readiness

Architecture Release 1.0 is ready to guide incremental implementation.

Ready areas:

- Product-first platform direction.
- DDD Lite domain structure.
- Engine responsibility boundaries.
- Product flow order.
- Product Engine Core direction.
- Finance, Order, Event and Machine architecture direction.
- Documentation and release governance.

Areas requiring runtime implementation:

- Full Product Engine integration into Mini App screens.
- Payment provider integration.
- Order persistence.
- Machine communication.
- Notification delivery.
- CRM and analytics workflows.

## Known Limitations

Known limitations at release time:

- This is an architecture release, not a runtime deployment.
- No new frontend, UI or application code is included.
- Not all architecture modules are implemented in runtime code.
- Backend API and PostgreSQL replacement are future work.
- Payment, Wallet, Ledger, Order, Machine and Notification runtime integrations are not complete.
- Some governance placeholder files outside `docs/releases/` are still empty.
- Product Owner approval is still required for major product decisions after this release.

## Next Planned Runtime

The next planned runtime direction is Sprint 1.1 Product Engine Core.

Expected runtime focus:

- Data layer for Mini App.
- CatalogService.
- MediaService.
- PriceEngine.
- ProductConfigurator.
- Mini App usage of services instead of hardcoded business data.

The next runtime release must confirm build status and relevant test scenarios.

## Future Release

Likely future releases:

- Runtime `v0.3.0-alpha.1` completion for Product Engine Core.
- Architecture Release 1.1 for governance cleanup and additional implementation-aligned decisions.
- Runtime release for checkout, order creation and payment initialization.
- Runtime release for machine dispatch and fulfillment.
- Architecture Release 2.0 only if a breaking architecture baseline change is approved.

## Approval

- Approval status: Architecture baseline approved.
- Product owner: Alexander Ilyin.
- Engineering status: Ready for incremental implementation.
- Documentation status: Release documentation created.

## Sign-off

- Product sign-off: Required for future product-scope changes.
- Engineering sign-off: Architecture Release 1.0 recorded.
- QA sign-off: Not applicable to runtime because no runtime artifact is shipped.
- Documentation sign-off: Release documents created.
- Release manager sign-off: Pending GitHub tag/publication when requested.
