# Architecture Audit

Status: Completed
Version: 1.0
Audit Type: Documentation-only architecture and repository audit
Date: 2026-07-03
Project: Soft ICE Platform / Utimoshi
Related baseline: `docs/architecture/ARCHITECTURE_BASELINE_1_0.md`
Related release policy: `docs/releases/RELEASE_POLICY.md`
Related versioning policy: `docs/releases/VERSIONING.md`

## Purpose

This document records the first architecture audit after Architecture Baseline 1.0 and release governance documentation were introduced.

The audit checks whether repository structure, documentation, runtime folders, architecture layers, domain boundaries, ADR, task records, release records, naming and cross references are consistent enough to guide the next implementation increment.

This is a documentation-only audit. It does not ship a runtime artifact.

## Scope

Included:

- repository structure;
- `docs/` structure;
- Mini App runtime structure;
- backend and Telegram bot runtime presence;
- Architecture Baseline 1.0 alignment;
- release and versioning governance;
- task and ADR traceability;
- naming and semantic ID consistency;
- current readiness for Product Engine Core and future MVP runtime releases.

Excluded:

- source-code changes;
- runtime refactoring;
- production deployment;
- build execution;
- business decision changes.

## Repository Structure Audit

Current top-level repository structure is broad enough for the platform vision:

- `frontend/miniapp/` contains the current React + Vite Mini App runtime.
- `backend/` contains an Express + Prisma backend foundation.
- `telegram-bot/` contains a separate Telegram bot package.
- `infrastructure/` stores Nginx configuration.
- `docs/` contains architecture, business, data, design, domain, governance, integration, privacy, release, sprint, task, template and testing documentation.
- `DOCs_Pravo/` stores legal and consent-related legacy documentation.
- `AGENTS.md`, `PROJECT_MEMORY.md`, `CHANGELOG.md` and `ENGINEERING_JOURNAL.md` exist at repository root as project-level records.

Positive findings:

- The repository supports the intended multi-channel platform direction.
- Architecture, domain, release and task documentation are present in the repository rather than external-only notes.
- Runtime code and documentation are separated clearly.

Risks and gaps:

- `docs/releases/` is present but currently untracked in the working tree.
- `roylty_v0_1.zip` is present at repository root and should be reviewed before any release to avoid committing obsolete generated or archive artifacts.
- `DOCs_Pravo/` uses mixed casing and a nonstandard docs location compared with `docs/privacy/` and `docs/business/`.
- Root `CHANGELOG.md` is the active changelog, while `docs/CHANGELOG.md` is stale.
- `docs/PROJECT_DECISIONS.md` and `docs/CHANGELOG_ARCHITECTURE.md` are empty duplicates or placeholders.

Audit result: structure is viable, but cleanup is needed before a formal runtime release.

## Folder Audit

Documentation folders:

- `docs/architecture/` contains the main architecture baseline, product, finance, order, event, payment, wallet, bonus, discount, accounting and supporting documents.
- `docs/domain/` contains catalog, media, recipe, consent and analytics domain models.
- `docs/design/` contains the design system, tokens, component library, responsive standard and photo standard.
- `docs/tasks/` contains Product, Finance, Event and Order task records.
- `docs/releases/` contains release policy, versioning, release template and Architecture Release 1.0.
- `docs/governance/` exists but all checked files are empty placeholders.
- `docs/architecture/ADR/` exists but all checked ADR files are empty placeholders.

Runtime folders:

- `frontend/miniapp/src/app`, `pages`, `screens`, `components`, `domain`, `shared`, `analytics`, `consent` and `styles` are present.
- `frontend/miniapp/src/domain` contains DDD Lite domain folders for catalog, configuration, customer, flavor, loyalty, machine, media, order, payment, pricing, product, recipe, syrup and topping.
- `backend/src` and `backend/prisma` exist.
- `telegram-bot/src` exists.

Positive findings:

- Folder structure supports gradual extraction of business logic from UI.
- The domain folder now reflects ADR-007 more closely than the older `src/data` and `src/services` expectation.
- Release documentation is centralized under `docs/releases/`.

Risks and gaps:

- `AGENTS.md` still names `frontend/miniapp/src/data/` and `frontend/miniapp/src/services/` as expected folders, while ADR-007 and DDD Lite documentation moved implementation toward `frontend/miniapp/src/domain/*`.
- Empty governance and ADR folders create a false sense of completeness.
- Several architecture placeholder files are empty, including `PLATFORM_KERNEL.md`, `PLATFORM_CONTRACTS.md`, `PLATFORM_CAPABILITIES.md`, `FINANCE_PLATFORM.md`, `LOYALTY_PLATFORM.md` and `ARCHITECTURE_FREEZE_v1_0.md`.

Audit result: folder direction is sound, but canonical folders and placeholder policy need cleanup.

## Runtime Audit

Mini App:

- Package: `frontend/miniapp/package.json`.
- Runtime: React 19, Vite 6, TypeScript package present.
- Node requirement: `>=20`.
- Build command: `npm run build`.
- Current package version: `0.1.0`.

Backend:

- Package: `backend/package.json`.
- Runtime: Express + Prisma.
- Current package name: `roylty-backend`.
- Current package version: `0.1.0`.

Telegram bot:

- Package and source files are present under `telegram-bot/`.

Positive findings:

- Runtime packages are separated by platform.
- Mini App has a clear build script.
- Backend has Prisma migration history.

Risks and gaps:

- Runtime package versions remain `0.1.0`, while root `CHANGELOG.md` tracks `v0.3.0-alpha.1` as in progress. This is acceptable during development but must be reconciled before release tagging.
- The Mini App UI still imports legacy `frontend/miniapp/src/domain/catalog.js`.
- `MiniAppHomePage.jsx` still contains product-facing hardcoded values such as `soft_ice_cup`, visible product offer text and price badges.
- `ProductScreen.jsx` reads product, syrup and topping data from the legacy catalog file rather than the newer DDD Lite catalog, configuration, media and pricing services.
- Payment, order, machine and notification runtime integrations are not complete.

Build status:

- Build was not run during this audit because the task is documentation-only and no application code was modified.

Audit result: runtime foundations exist, but the runtime is not yet release-ready for the commercial MVP.

## Architecture Layer Audit

Architecture Baseline 1.0 defines a product-centered platform with this flow:

```text
Catalog -> Configuration -> Recipe -> Pricing -> Wallet -> Payment -> Machine -> Notification
```

Layer alignment:

- UI layer exists in Mini App pages, screens and components.
- Domain layer exists under `frontend/miniapp/src/domain`.
- Product Engine domains have partial runtime implementation.
- Finance, Order, Event and Machine layers are mostly architecture-first at this point.
- Platform Core is defined in the baseline but not implemented as a runtime platform layer yet.
- Domain contracts are defined as an architecture requirement but not yet represented by a complete runtime `domain/contracts/` layer.

Positive findings:

- The baseline is coherent and product-centered.
- DDD Lite is reflected in current Mini App folder structure.
- Domain code does not import React.
- Pricing and Recipe have explicit Engine facades.

Risks and gaps:

- Platform Core documents are mostly placeholders.
- Official runtime contracts are not yet complete.
- Order, Finance, Machine and Notification layers are primarily documented but not wired into runtime.
- The active UI still bypasses the newer Product Engine services in places.

Audit result: architecture direction is strong; runtime layer completion is still early.

## Business Layer Audit

Documented business model:

- MVP goal is clear: a customer can select a dessert, pay for it and receive it from a vending machine.
- Product concept is soft ice cream in a cup.
- Base MVP assumptions are recorded in `PROJECT_MEMORY.md`.
- Bonus, discount, wallet, payment, order, refund, cancellation, fulfillment and machine dispatch rules are documented.
- Legal and consent materials exist.

Positive findings:

- Business rules are separated from pure UI intent in project documentation.
- Financial boundaries are well documented: bonus is not money, discount is not wallet balance, payment executes settlement and Ledger remains financial truth.
- Order is documented as an immutable snapshot owner.

Risks and gaps:

- Product offer and price are still visible in UI code instead of being fully sourced through Product Engine services.
- Finance and loyalty architecture is ahead of runtime implementation.
- Business process documentation and task status are not fully synchronized.

Audit result: business architecture is clear; runtime enforcement is incomplete.

## Domain Layer Audit

Current domain folders:

- `catalog`
- `configuration`
- `customer`
- `flavor`
- `loyalty`
- `machine`
- `media`
- `order`
- `payment`
- `pricing`
- `product`
- `recipe`
- `syrup`
- `topping`

Implemented or partially implemented Product Engine domains:

- Catalog has `catalogData.js`, `CatalogRepository.js`, `CatalogService.js` and exports.
- Configuration has entity, repository, service and exports.
- Recipe has entity, reference, repository, service, engine and exports.
- Pricing has entity, repository, service, engine and exports.
- Media has reference, repository, service and exports.
- Product, Flavor, Syrup and Topping have entity files and exports.

Placeholder or early runtime domains:

- Customer, Loyalty, Machine, Order and Payment currently have repository/service shells but do not yet meet the full baseline shape of Entity, Repository, Service and Engine.

Positive findings:

- Business logic is moving out of screens.
- Stable semantic IDs exist in newer catalog, configuration, recipe and pricing modules.
- Repository boundaries exist so JSON or JS data can later be replaced by API/PostgreSQL.

Risks and gaps:

- Legacy IDs remain in `frontend/miniapp/src/domain/catalog.js`, such as `soft_ice_cup`, `vanilla`, `strawberry`, `sprinkles` and `choco_crunch`.
- The baseline Domain Standard says each domain has Entity, Repository, Service and Engine, but current domains are uneven.
- Media lacks an Engine facade if the project treats media selection as an engine-level responsibility.
- No complete domain contracts layer exists yet.

Audit result: Product Engine runtime is partially mature; broader domain layer is early.

## ADR Audit

Current ADR sources:

- Canonical decision history is currently in `docs/architecture/PROJECT_DECISIONS.md`.
- ADR-001 through ADR-025 are recorded there.
- `docs/architecture/ADR/` exists but contains empty placeholder files only.

Positive findings:

- Decision coverage is broad and recent.
- ADR-025 records release and versioning governance.
- Finance, Order, Payment, Machine Dispatch and Product Engine decisions are traceable in the decision log.

Risks and gaps:

- Standalone ADR files do not contain the decisions they imply.
- Standalone ADR files exist only for ADR-001 through ADR-008 and ADR-013; ADR-009 through ADR-012 and ADR-014 through ADR-025 do not have matching files.
- Release document `RELEASE_1_0.md` includes ADR-001 through ADR-024 and separately notes ADR-025 governance; this is acceptable but should be made explicit in future release checklists.

Audit result: ADR content exists, but ADR storage format needs normalization.

## Task Audit

Positive findings:

- `docs/tasks/TASK_INDEX.md` exists and groups Product Engine, Finance Platform, Order Platform and future epics.
- Order tasks ORDER-001 through ORDER-008 are documented.
- Finance tasks FINANCE-004 through FINANCE-008 have substantial architecture records.
- Product Engine task documents for Configuration, Recipe and Pricing exist.

Risks and gaps:

- Product task status is inconsistent with implementation and engineering journal entries.
- `TASK_INDEX.md` still lists PRODUCT-004 as Product Configurator planned, while `PRODUCT-004_CONFIGURATION_ENGINE.md` and runtime configuration code exist.
- `TASK_INDEX.md` lists PRODUCT-005 as Recipe Engine planned, while recipe runtime code and `PRODUCT-005_RECIPE_ENGINE.md` exist.
- `TASK_INDEX.md` lists PRODUCT-006 as Media Engine planned, while `PRODUCT-006_PRICING_ENGINE.md` exists and pricing runtime code exists.
- There is no visible PRODUCT-007 task file for the Pricing Engine name used in the task index.
- EPIC-230 has an internal planned task table that no longer fully matches ORDER-001 through ORDER-008 task files.

Audit result: task coverage is good, but task index reconciliation is required before release freeze.

## Release Audit

Release governance files present:

- `docs/releases/RELEASE_TEMPLATE.md`
- `docs/releases/RELEASE_POLICY.md`
- `docs/releases/VERSIONING.md`
- `docs/releases/RELEASE_1_0.md`
- `docs/releases/ARCHITECTURE_AUDIT.md`

Positive findings:

- Release policy defines architecture, runtime and documentation-only gates.
- Versioning policy separates architecture versions from runtime SemVer.
- Architecture Release 1.0 clearly states that no runtime artifact is shipped.
- Documentation-only releases require explicit confirmation that no application code, frontend code or runtime artifact was modified.

Risks and gaps:

- `docs/releases/PLATFORM_MATURITY.md` and `docs/releases/PLATFORM_CAPABILITIES.md` are empty placeholders.
- Release publication details such as Git tag and GitHub release URL remain pending in `RELEASE_1_0.md`.
- The current working tree shows release documentation as untracked, so it must be added intentionally before release publication.

Audit result: release process is well defined; release file tracking and placeholders need cleanup.

## Naming Audit

Positive findings:

- New Product Engine semantic IDs follow the required style, for example `product_soft_ice_vanilla_cup`, `flavor_vanilla`, `syrup_strawberry`, `topping_oreo` and `media_soft_ice_vanilla_cup`.
- Engine class names use explicit names such as `PricingEngine` and `RecipeEngine`.
- Architecture documents generally use full platform/domain names.

Risks and gaps:

- Legacy IDs remain in the Mini App legacy catalog, for example `soft_ice_cup`, `vanilla`, `strawberry`, `sprinkles` and `choco_crunch`.
- Backend package name `roylty-backend` appears to be a historical typo or legacy name.
- Root archive `roylty_v0_1.zip` uses the same legacy spelling.
- `DOCs_Pravo/` does not match the casing style used by other docs directories.

Audit result: new naming is strong; legacy naming must be retired or documented.

## Cross Reference Audit

Positive findings:

- `AGENTS.md`, `PROJECT_MEMORY.md`, Architecture Baseline 1.0, release policy and versioning policy reinforce the same product-first direction.
- `CHANGELOG.md`, `ENGINEERING_JOURNAL.md` and `PROJECT_DECISIONS.md` are being used for meaningful project history.
- Release policy points to release template and versioning policy.

Risks and gaps:

- `AGENTS.md` expected folders conflict with ADR-007 DDD Lite domain structure.
- Root `CHANGELOG.md` is active, while `docs/CHANGELOG.md` is stale.
- `docs/PROJECT_DECISIONS.md` is empty while `docs/architecture/PROJECT_DECISIONS.md` is active.
- Empty governance and architecture placeholder files may be mistaken for approved policy.
- Task index, task documents and engineering journal do not fully agree on Product Engine task status and numbering.

Audit result: cross references are workable, but canonical-source cleanup is needed.

## Consistency Audit

Consistent areas:

- Product-first architecture.
- GitHub as source of truth.
- Documentation-first architecture governance.
- Separation of UI, domain, repositories and services.
- Release type separation.
- Finance and Order architecture boundaries.

Inconsistent areas:

- Expected Mini App folders in `AGENTS.md` versus actual ADR-007 domain structure.
- Product task numbering and current implementation status.
- ADR location: decision log versus empty standalone ADR files.
- Active changelog location: root changelog versus stale docs changelog.
- Runtime version declarations versus package versions.
- Legacy UI catalog versus newer Product Engine domains.

Audit result: consistency is good at the strategic level and weaker at the operational traceability level.

## Architecture Score

Architecture score: 82 / 100

Rationale:

- Strong baseline and release governance: +25
- Clear product-centered DDD Lite direction: +20
- Broad domain and business documentation: +15
- Product Engine runtime foundations: +10
- Release and versioning clarity: +8
- Gaps from placeholders, cross-reference drift and uneven runtime domain completion: -18

Interpretation:

- The architecture is strong enough to guide implementation.
- The architecture should not be treated as fully operationalized until contracts, task records and placeholder docs are normalized.

## Readiness Score

Repository readiness score: 64 / 100

Rationale:

- Repository has a viable platform structure and active documentation.
- Mini App runtime exists and has Product Engine foundations.
- Runtime is not ready for the first commercial MVP because payment, order persistence, machine dispatch and notification delivery are not implemented.
- UI still contains legacy business data paths.
- Release docs are present but need tracking, placeholder cleanup and publication metadata.

Interpretation:

- Repository is architecture-ready.
- Repository is not runtime-release-ready for MVP.
- Repository is ready for the next controlled Product Engine Core implementation increment.

## Recommendations

1. Reconcile `AGENTS.md` with ADR-007 by deciding whether `src/domain/*` is the canonical Mini App business layer or whether `src/data` and `src/services` remain required.
2. Retire or migrate `frontend/miniapp/src/domain/catalog.js` and wire screens to Catalog, Configuration, Media and Pricing services.
3. Normalize Product Engine task numbering and statuses in `docs/tasks/TASK_INDEX.md`.
4. Decide whether ADR live only in `docs/architecture/PROJECT_DECISIONS.md` or are expanded into individual files under `docs/architecture/ADR/`.
5. Remove, fill or label empty placeholder documents before formal release freeze.
6. Reconcile runtime package versions with release records before the next runtime tag.
7. Move or document legacy legal and archive assets so release candidates do not include unclear artifacts.
8. Add a release-readiness checklist that validates no UI hardcoded business data remains for the purchase flow.

## Action Plan

### Phase 1: Governance Cleanup

- Make `docs/architecture/PROJECT_DECISIONS.md` the explicit canonical ADR source or populate standalone ADR files.
- Update or remove empty placeholders in `docs/governance/`, `docs/architecture/ADR/`, `docs/releases/`, and selected architecture files.
- Align `AGENTS.md`, DDD Lite documentation and task index around the accepted Mini App folder standard.
- Confirm which changelog is canonical and archive the stale duplicate.

### Phase 2: Product Engine Runtime Alignment

- Replace legacy catalog screen usage with `CatalogService`.
- Route configuration through `ConfigurationService`.
- Route final pricing through `PricingEngine`.
- Route product visual selection through `MediaService`.
- Keep product IDs, flavor IDs, syrup IDs and topping IDs semantic and stable.

### Phase 3: Release Readiness

- Update test scenarios for the Product Engine service-backed purchase path.
- Run `cd frontend/miniapp && npm run build`.
- Confirm no generated `dist/` output is committed.
- Record release scope, known limitations and quality gates in `docs/releases/`.
- Tag only after documentation, build and approval are complete.

### Phase 4: MVP Runtime Completion

- Implement Order persistence and immutable snapshots.
- Implement Payment provider integration.
- Implement Machine Dispatch runtime boundary.
- Implement Notification delivery.
- Add recovery and reconciliation paths for payment and machine failures.

## Quality Gates

Documentation-only gate for this audit:

- `ARCHITECTURE_AUDIT.md` exists under `docs/releases/`.
- Audit contains repository, folder, runtime, architecture, business, domain, ADR, task, release, naming, cross-reference and consistency sections.
- Audit includes architecture score and readiness score.
- Audit includes recommendations, action plan, quality gates, exit criteria and future audit policy.
- Only documentation files are modified.
- No application code, frontend code, backend code, Telegram bot code, infrastructure runtime config or generated build output is modified.

Future runtime gate:

- Mini App build passes.
- Relevant test scenarios pass or known limitations are recorded.
- UI does not hardcode product price, product IDs, syrup lists, topping lists or media selection.
- Domain services are used by runtime screens for product selection and pricing.
- Release document states runtime version, architecture version, ADR scope and known limitations.

## Exit Criteria

This audit is complete when:

- `docs/releases/ARCHITECTURE_AUDIT.md` is filled with this report.
- `CHANGELOG.md` records the audit as a meaningful documentation addition.
- `ENGINEERING_JOURNAL.md` records the audit increment.
- No application code is modified.
- The final response confirms changed files, architecture score, repository readiness and recommendations.

The repository is ready for the next implementation increment when:

- task index drift is resolved;
- placeholder governance files are either completed or marked as intentionally empty;
- legacy Mini App catalog usage is replaced by Product Engine services;
- the Mini App build passes after runtime changes;
- release scope is documented before tagging.

## Future Audits

Run architecture audits:

- before publishing Architecture Release 1.1;
- before the next runtime release tag;
- after Product Engine is fully wired into Mini App screens;
- before payment and machine integrations are shipped;
- after any major architecture decision that changes domain boundaries, product flow or release policy.

Future audit dimensions:

- service wiring audit;
- hardcoded business data audit;
- test scenario coverage audit;
- release traceability audit;
- security and privacy audit;
- vending machine integration audit.

## Final Report

### Changed files

- `docs/releases/ARCHITECTURE_AUDIT.md`
- `CHANGELOG.md`
- `ENGINEERING_JOURNAL.md`

### Architecture score

82 / 100

### Repository readiness

64 / 100

Repository status: architecture-ready, not yet runtime-release-ready for the commercial MVP.

### Recommendations

Highest-priority recommendations:

1. Align `AGENTS.md`, DDD Lite architecture and task index around the accepted `frontend/miniapp/src/domain/*` structure.
2. Replace legacy Mini App catalog usage and hardcoded offer data with Product Engine services.
3. Normalize Product Engine task IDs and statuses.
4. Resolve empty ADR, governance and release placeholder files.
5. Reconcile package versions and release records before the next runtime tag.

### Confirm no application code modified

Confirmed for this documentation-only task: no application code, frontend code, backend code, Telegram bot code, infrastructure runtime config or generated build output is intentionally modified by this audit.
