# Architecture Consistency Audit

Document code: ARCH-001
Epic: EPIC-355
Status: Completed
Date: 2026-07-07
Scope: Documentation only
Project: Soft ICE Platform / Utimoshi

## Purpose

This audit reviews the documentation repository before continued platform development.

The audit scanned every existing Markdown document under `docs/`, plus active root governance files:

- `AGENTS.md`
- `CHANGELOG.md`
- `ENGINEERING_JOURNAL.md`
- `PROJECT_MEMORY.md`

No application source code, runtime configuration, API behavior, database migration or generated build output was changed.

## Executive Summary

The documentation base is directionally strong: recent platform, API, domain, data, order, payment, kernel and finance documents consistently reinforce the main architecture principles: Runtime owns business logic, UI does not own business data, Ledger is financial truth, events are immutable facts and provider-specific details stay behind adapters.

The main inconsistency is governance debt, not product-architecture absence. The repository contains many empty placeholder documents with authoritative names, stale duplicate governance files, duplicate decision surfaces and older root-level documents that predate the platform runtime model.

Documentation quality score: 68 / 100.

Architecture maturity assessment: Medium-high conceptual maturity, medium documentation-governance maturity. The platform has a clear architecture direction, but the docs repository needs cleanup before it can be treated as a stable operating manual.

## Repository Structure

Current documentation folders are organized around these areas:

| Area | Document count before this report | Assessment |
|---|---:|---|
| `docs/api` | 9 | Strong active API overview/auth/REST/Event docs, but several empty contract placeholders |
| `docs/architecture` | 25 | Main architecture area, but also contains empty duplicates and stale placeholders |
| `docs/architecture/ADR` | 9 | Exists, but all ADR files are empty |
| `docs/business` | 7 | Mostly empty except platform principles |
| `docs/data` | 6 | Platform data model is strong; other data docs are empty |
| `docs/design` | 5 | Coherent and usable baseline |
| `docs/domain` | 18 | Strong recent Customer/Club/Bonus/Payment docs; several empty domain placeholders |
| `docs/engineering` | 1 | Stale duplicate journal |
| `docs/finance` | 6 | All current files are empty placeholders |
| `docs/governance` | 9 | All current files are empty placeholders |
| `docs/integrations` | 1 | YooKassa verification document exists |
| `docs/kernel` | 6 | Coherent active Platform Kernel contract set |
| `docs/privacy` | 1 | Cookie/tracking policy architecture exists |
| `docs/releases` | 8 | Useful release and readiness audits, with some stale findings |
| `docs/sprints` | 1 | v0.2.0 draft exists |
| `docs/standards` | 1 | ADR template placeholder is empty |
| `docs/tasks` | 24 | Useful task records; index needed alignment |
| `docs/tasks/PRODUCT` | 2 | Older Product task records exist in nested folder |
| `docs/templates` | 1 | Document header standard exists |
| `docs/testing` | 1 | Test scenarios exist |
| `docs` root | 20 | Too many legacy/stale/placeholder docs remain at root |

The new audit report adds one document, so the post-audit docs total increases by one.

## Documentation Statistics

Existing documents scanned before creating this report:

- Markdown files under `docs/`: 161
- Root governance files reviewed: 4
- Total bytes under `docs/`: 1,350,735
- Empty Markdown files under `docs/`: 68
- Top-level files directly under `docs/`: 20
- Duplicate basenames detected: 3
- Broken Markdown path references detected before fixes: 2
- Broken Markdown path references fixed in this audit: 2

High-volume content areas:

- Order Platform documentation is the largest architecture surface.
- Payment, Data Model, Club Account and Bonus documents are deep and well-developed.
- Kernel and API docs are coherent enough to guide future implementation.

High-risk sparse areas:

- Glossary
- Finance registries
- Governance process docs
- ADR standalone files
- Notification, Machine, Product, Promotion and Order domain placeholders
- API versioning, webhooks, idempotency and error codes

## Duplicate Concepts

| Concept | Duplicate locations | Finding |
|---|---|---|
| Project decisions / ADR | `docs/architecture/PROJECT_DECISIONS.md`, empty `docs/PROJECT_DECISIONS.md`, empty `docs/architecture/ADR/*` | Active decision history is centralized in architecture decisions; duplicate ADR surfaces create false completeness |
| Changelog | `CHANGELOG.md`, `docs/CHANGELOG.md`, empty `docs/CHANGELOG_ARCHITECTURE.md` | Root changelog is active; docs-level changelog is stale |
| Engineering journal | `ENGINEERING_JOURNAL.md`, `docs/engineering/ENGINEERING_JOURNAL.md` | Root journal is active and current; docs journal is stale |
| Platform Kernel | `docs/kernel/PLATFORM_KERNEL.md`, empty `docs/architecture/PLATFORM_KERNEL.md` | Kernel folder owns the real content; architecture duplicate should become redirect, summary or be removed |
| Platform capabilities | empty `docs/architecture/PLATFORM_CAPABILITIES.md`, empty `docs/releases/PLATFORM_CAPABILITIES.md` | Duplicate empty placeholders |
| Payment registry | `docs/domain/PAYMENT_DOMAIN.md`, `docs/data/PLATFORM_DATA_MODEL.md`, empty domain/finance registry docs | Real model exists inside Payment Domain and Data Model; registry ownership docs are empty |
| Product/media model | Product catalog docs contain media paths while media docs own media structure | Older catalog examples mix product data and media path concerns |
| Roadmap/work-in-progress | `docs/ROADMAP.md`, `docs/TODO_NEXT.md`, `docs/WORKING_DECISIONS_CURRENT.md`, empty `docs/MASTER_ROADMAP.md` | Multiple planning surfaces with unclear canonical order |

## Conflicting Terminology

| Area | Conflict | Impact |
|---|---|---|
| Product identifiers | Older docs use `soft_ice_cup_vanilla`, `strawberry`, `oreo`; current standard uses `product_soft_ice_vanilla_cup`, `syrup_strawberry`, `topping_oreo` | Catalog/API/data implementations may drift if examples are copied |
| Price engine naming | Repo instructions mention `PriceEngine.js`; current architecture and code history use `PricingEngine` / Pricing Engine | New work may create duplicate service names |
| Configuration naming | Task index previously said Product Configurator, while completed task and runtime are Configuration Engine | Task traceability drift |
| Mini App folders | Repo instructions still expect `frontend/miniapp/src/data` and `src/services`; DDD Lite work uses `frontend/miniapp/src/domain/*` | Implementation tasks may target the wrong layer |
| Payment registry terms | Payment Operations Registry, Payment Registry, Financial Registry, Refund Registry and Reconciliation Registry are used, but dedicated docs are empty | Ownership and storage boundaries are not yet operationally clear |
| Channel names | Mini App, Telegram Mini App, Web App, terminal, vending terminal, vending machine UI and CRM are used across generations of docs | Low-to-medium risk; glossary can normalize |
| CRM role | Older docs treat CRM as a central system; current platform docs treat CRM as projection/runtime consumer | Can mislead support/admin implementation |
| Money representation | Older product docs show simple RUB integers; Platform Data Model says future API/storage money representation must be standardized | Must be resolved before payment production work |

## Duplicate Ownership

### Domain / Data / Finance / API

The ownership model is mostly coherent in newer documents:

- Domain documents define business language and boundaries.
- Data Model defines logical entities, relationships, owners and immutability.
- Finance architecture owns Ledger, Wallet, Payment, Accounting and financial facts.
- API docs describe transport and contract boundaries, not business rules.

Remaining ownership risks:

- Payment registry definitions are embedded in Payment Domain and Platform Data Model while dedicated domain/finance registry files are empty.
- Finance registry files look authoritative by name but contain no ownership rules.
- API resource lists expose Payments, Wallet, Bonus, Orders and Products but depend on Runtime ownership that is documented elsewhere.
- Product catalog docs still include direct media paths and prices in examples, while newer architecture separates catalog, media and pricing.
- CRM older docs imply direct ownership of phone, bonus and club checks; current Customer/Bonus/Club Account docs assign those to domains and runtimes.

## Cross-Reference Integrity

Automated scan checked Markdown links and path-like references to existing Markdown files.

Before this audit:

- `docs/releases/RUNTIME_COMPLETENESS_AUDIT.md` referenced a missing Notification Engine architecture file.
- `docs/releases/ARCHITECTURE_AUDIT.md` used bare task-index references that did not resolve to the active task index path.

Fixed in this audit:

- Reworded the Notification Engine recommendation so it no longer creates a broken document path.
- Replaced stale bare task-index references with `docs/tasks/TASK_INDEX.md`.

Residual concern:

- Many references point to existing but empty documents. These are technically valid paths but weak architectural references.

## Folder Organization

What works:

- Dedicated folders exist for API, architecture, data, design, domain, finance, governance, kernel, releases, tasks and testing.
- Recent architecture content is mostly in sensible folders.
- Kernel documentation is well grouped under `docs/kernel`.

What does not work:

- `docs` root contains too many mixed-scope files.
- `docs/finance` is entirely placeholder content even though finance concepts are mature elsewhere.
- `docs/governance` is entirely placeholder content despite governance being active in root and release docs.
- `docs/architecture/ADR` implies standalone ADR coverage but is empty.
- `docs/engineering/ENGINEERING_JOURNAL.md` duplicates and lags the root journal.
- `docs/architecture/PLATFORM_KERNEL.md` duplicates real kernel documentation with an empty file.

## Document Naming Consistency

The dominant style is uppercase snake case for canonical docs, for example `PROJECT_DECISIONS.md` and `PLATFORM_DATA_MODEL.md`.

Accepted exceptions:

- Task records include task IDs with hyphens, such as `ORDER-008_MACHINE_DISPATCH.md`.
- Release/sprint files include version identifiers, such as `v0.2.0_FIRST_PURCHASE_FLOW.md`.
- ADR placeholders use ADR number prefixes with hyphens.

Naming drift:

- Lowercase legacy root docs: `brandbook_v1.md`, `business-processes.md`, `crm_architecture.md`, `database-structure.md`, `server_infrastructure.md`, `telegram_bot.md`, `vending_machine_ui.md`.
- Mixed English/Russian status labels are acceptable for current bilingual context but should be normalized in headers.
- Some active documents use "Status: Draft", others use Russian labels, and several have no status header.

## Glossary Consistency

`docs/architecture/GLOSSARY.md` exists but is empty.

Result:

- Glossary consistency cannot be verified from a central source.
- Local ubiquitous-language tables exist in strong domain docs, especially Payment, Bonus, Club Account and Customer.
- Terms that need central glossary definitions include Runtime, Engine, Platform Kernel, Domain, API, Event, Ledger, Wallet, Club Account, Bonus, Discount, Payment Operation, Payment Registry, Financial Registry, Sales Channel, Machine, CRM Projection and Consent.

## Project Decisions Coverage

Current active file:

- `docs/architecture/PROJECT_DECISIONS.md`

Current observed coverage:

- Numbered decisions `DECISION-033` through `DECISION-038`.
- Additional accepted decisions for Bonus, Club Account, Customer, Event API, REST API, Authorization, Authentication, API Contract, Platform Kernel Registry/Lifecycle, Platform Kernel Boundary and Promotion Platform Vision.

Consistency issue:

- `docs/releases/RELEASE_1_0.md` and the older release audit state that ADR-001 through ADR-025 are recorded in `docs/architecture/PROJECT_DECISIONS.md`.
- Standalone ADR files for ADR-001 through ADR-008 and ADR-013 exist but are empty.
- Current `PROJECT_DECISIONS.md` does not expose ADR-001 through ADR-025 as separately numbered entries.
- Decision numbering is inconsistent: newer records use `DECISION-033` style, while several accepted decisions are unnumbered.

Audit conclusion:

- `PROJECT_DECISIONS.md` is active but not verifiably complete.
- This audit did not invent missing ADR content.
- Recommended action: recover or reconstruct ADR-001 through ADR-032 from prior source material, or explicitly declare the current decision log as the canonical reset with Product Owner approval.

## Task Index Coverage

Updated in this audit:

- Added `EPIC-355` and `ARCH-001`.
- Added explicit `EPIC-210` row.
- Updated PRODUCT-004, PRODUCT-005 and PRODUCT-006 to match completed task records.
- Moved Media Engine Foundation to PRODUCT-007 planned.

Completed epics now represented in the active index:

- `EPIC-050` Platform Kernel
- `EPIC-210` Event Platform
- `EPIC-230` Order Platform
- `EPIC-300` Customer Platform
- `EPIC-350` Platform Data Model
- `EPIC-355` Architecture Consistency Audit

Remaining task-index risk:

- `EPIC-220` exists as an empty task file and is not represented as completed.
- PRODUCT-002 and PRODUCT-003 still show review/commit-pending status in the index while other evidence suggests downstream work proceeded.

## Changelog Chronology

Root `CHANGELOG.md` chronology is acceptable:

- `v0.3.0-alpha.1` is in progress.
- `v0.2.0` follows.
- `v0.1.0-infrastructure-ready` follows.
- Documentation baseline is older and grouped at the bottom.

Updated in this audit:

- Added EPIC-355 / ARCH-001 entry under `v0.3.0-alpha.1`.

Changelog risk:

- `docs/CHANGELOG.md` is stale.
- `docs/CHANGELOG_ARCHITECTURE.md` is empty.

## Engineering Journal Chronology

Root `ENGINEERING_JOURNAL.md` chronology is acceptable and newest-first.

Updated in this audit:

- Added 2026-07-07 architecture consistency audit entry.

Journal risk:

- `docs/engineering/ENGINEERING_JOURNAL.md` is stale and should not be treated as active.

## Obsolete Documents

Likely obsolete or legacy documents:

- `docs/DECISIONS.md`
- `docs/PAYMENT_ARCHITECTURE.md`
- `docs/business-processes.md`
- `docs/crm_architecture.md`
- `docs/database-structure.md`
- `docs/telegram_bot.md`
- `docs/vending_machine_ui.md`
- `docs/ROADMAP.md`
- `docs/TODO_NEXT.md`

These should not be deleted automatically. Some contain useful historical decisions and operational context. They should be reviewed, then either merged into canonical docs or moved under an archive/history area.

Obsolete placeholder surfaces:

- Empty docs-level project decisions file.
- Empty docs-level architecture changelog.
- Empty governance folder files.
- Empty ADR folder files.
- Empty finance registry files.
- Empty architecture duplicates for platform/kernel/capabilities/contracts.

## Obsolete References

Fixed:

- Bare task-index references in the old release audit.
- Missing Notification Engine Markdown path in runtime completeness audit.

Still obsolete by concept:

- Older docs describe CRM as central architecture rather than a runtime/projection.
- Older product docs include direct image paths and prices as catalog examples.
- Older folder expectations in repo instructions mention `src/data` and `src/services`, while active implementation history uses DDD Lite `src/domain`.

## Missing Documents

Missing or empty-but-required content:

- Architecture glossary content.
- Notification Engine architecture.
- Notification Domain.
- Machine Domain.
- Product Domain.
- Order Domain.
- Promotion Domain.
- API Versioning.
- Error Codes.
- Idempotency.
- Webhooks.
- Finance registries: payment, refund, settlement, reconciliation, accounting export and financial audit.
- Governance docs: decision process, review board, coding standards, document policy, engineering process, maturity model, quality gates, release process and versioning policy.
- Data supporting docs: database guidelines, entity relationship, event catalog and message contracts.
- ADR template and standalone ADR records.

## Recommended Moves

Do not move automatically unless Product Owner approves the cleanup plan.

Recommended relocations:

- Move or merge legacy CRM docs into a future Customer/CRM runtime documentation area.
- Move `docs/telegram_bot.md` under integrations or channel documentation.
- Move `docs/vending_machine_ui.md` under machine/channel documentation after extracting current hardware-facing rules.
- Move `docs/brandbook_v1.md` under a brand or design area.
- Move `docs/business-processes.md` into business process documentation or archive it after extracting current process rules.
- Move stale planning docs into a roadmap/history folder or merge them into a single active roadmap.
- Replace empty `docs/architecture/PLATFORM_KERNEL.md` with a short pointer to `docs/kernel/PLATFORM_KERNEL.md`, or remove it after references are checked.

## Recommended Merges

Highest-value merges:

1. Decision log cleanup: reconcile `PROJECT_DECISIONS.md`, empty ADR files and release ADR claims.
2. Registry cleanup: split registry ownership into canonical Finance/Data docs and keep Payment Domain as business lifecycle owner.
3. Changelog cleanup: root changelog as active, docs changelog as archived or removed.
4. Journal cleanup: root journal as active, docs journal archived or merged.
5. Product docs cleanup: align catalog examples with semantic IDs and remove media/pricing ownership leakage.
6. Roadmap cleanup: merge ROADMAP, TODO_NEXT, MASTER_ROADMAP and WORKING_DECISIONS_CURRENT into active roadmap plus decision history.
7. Platform Kernel cleanup: keep `docs/kernel` canonical.

## Architecture Risks

| Risk | Severity | Notes |
|---|---|---|
| Empty authoritative files | High | 68 empty docs create false confidence |
| Decision-log inconsistency | High | Release docs claim ADR coverage not visible in current decision log |
| Registry ownership ambiguity | High | Payment/finance/data registry terms overlap without dedicated docs |
| Glossary missing | Medium-high | Conflicting terminology is likely to grow |
| Task index drift | Medium | Partially fixed in this audit |
| Legacy docs at root | Medium | Old CRM/payment/product assumptions can be copied into new work |
| Product ID drift | Medium | Legacy IDs conflict with semantic ID standard |
| API placeholder gaps | Medium | API work has strong overview docs but missing version/error/idempotency/webhook details |
| Governance folder empty | Medium | Process appears more complete than it is |

## Technical Documentation Debt

Primary debt:

- Empty placeholder files should be filled, redirected, archived or removed.
- Canonical sources need explicit ownership labels.
- Decision log needs numbering normalization.
- Glossary needs real content.
- Old docs need status banners: active, superseded, draft, archive or historical.
- Domain/Data/Finance/API ownership matrix should become a maintained document.
- Cross-reference validation should become a release checklist.
- Task index should be checked whenever changelog/journal entries are added.

## Recommendations

1. Treat this report as a cleanup backlog, not as approval to move files automatically.
2. Create a documentation ownership map with canonical owner per folder and concept.
3. Resolve decision-log integrity before the next architecture release.
4. Fill or archive empty docs that have canonical names.
5. Make `docs/architecture/GLOSSARY.md` a required source for terminology.
6. Reconcile Product Engine naming and semantic IDs across catalog, data model and task docs.
7. Make Finance Registry docs real before payment production implementation.
8. Make API Versioning, Idempotency, Error Codes and Webhooks real before public API implementation.
9. Keep `docs/kernel` as canonical Platform Kernel documentation.
10. Add a recurring docs audit check to release governance once governance docs are filled.

## Files Updated

- `docs/architecture/ARCHITECTURE_AUDIT.md`
- `CHANGELOG.md`
- `ENGINEERING_JOURNAL.md`
- `docs/tasks/TASK_INDEX.md`
- `docs/releases/ARCHITECTURE_AUDIT.md`
- `docs/releases/RUNTIME_COMPLETENESS_AUDIT.md`

`docs/architecture/PROJECT_DECISIONS.md` was reviewed but not changed. No new accepted architecture decision was made by this audit, and missing historical ADR content should not be fabricated.

## Files Reviewed

Root governance files:

```text
AGENTS.md
CHANGELOG.md
ENGINEERING_JOURNAL.md
PROJECT_MEMORY.md
```

Documents under `docs/` reviewed by scan:

```text
docs/api/API_OVERVIEW.md
docs/api/API_VERSIONING.md
docs/api/AUTHENTICATION.md
docs/api/AUTHORIZATION.md
docs/api/ERROR_CODES.md
docs/api/EVENT_API.md
docs/api/IDEMPOTENCY.md
docs/api/REST_API.md
docs/api/WEBHOOKS.md
docs/architecture/ACCOUNTING_ADAPTER.md
docs/architecture/ADR/ADR-001_PLATFORM_VISION.md
docs/architecture/ADR/ADR-002_DDD_LITE.md
docs/architecture/ADR/ADR-003_DOMAIN_STRUCTURE.md
docs/architecture/ADR/ADR-004_ENGINE_NAMING.md
docs/architecture/ADR/ADR-005_DOMAIN_CONTRACTS.md
docs/architecture/ADR/ADR-006_FINANCIAL_CORE.md
docs/architecture/ADR/ADR-007_TRANSACTION_LEDGER.md
docs/architecture/ADR/ADR-008_PLATFORM_CORE.md
docs/architecture/ADR/ADR-013_STANDARD_OPERATING_PROCEDURES.md
docs/architecture/ARCHITECTURE_BASELINE_1_0.md
docs/architecture/ARCHITECTURE_FREEZE_v1_0.md
docs/architecture/ARCHITECTURE_PRINCIPLES.md
docs/architecture/BONUS_ENGINE.md
docs/architecture/CHECKOUT.md
docs/architecture/CONFIGURATION_ENGINE.md
docs/architecture/DDD_LITE_ARCHITECTURE.md
docs/architecture/DISCOUNT_ENGINE.md
docs/architecture/EVENT_PLATFORM.md
docs/architecture/FINANCE_PLATFORM.md
docs/architecture/GLOSSARY.md
docs/architecture/LEDGER.md
docs/architecture/LOYALTY_PLATFORM.md
docs/architecture/ORDER_PLATFORM.md
docs/architecture/PAYMENT_ENGINE.md
docs/architecture/PLATFORM_BLUEPRINT.md
docs/architecture/PLATFORM_CAPABILITIES.md
docs/architecture/PLATFORM_CONTRACTS.md
docs/architecture/PLATFORM_KERNEL.md
docs/architecture/PRICING_ENGINE.md
docs/architecture/PROJECT_DECISIONS.md
docs/architecture/PROMOTION_PLATFORM_VISION.md
docs/architecture/RECIPE_ENGINE.md
docs/architecture/WALLET.md
docs/brandbook_v1.md
docs/business-processes.md
docs/business/BUSINESS_RULES.md
docs/business/FINANCE_RULES.md
docs/business/LOYALTY_RULES.md
docs/business/MACHINE_RULES.md
docs/business/ORDER_RULES.md
docs/business/PLATFORM_PRINCIPLES.md
docs/business/REFERRAL_RULES.md
docs/BUSINESS_CAPABILITY_MAP.md
docs/CHANGELOG.md
docs/CHANGELOG_ARCHITECTURE.md
docs/crm_architecture.md
docs/data/DATABASE_GUIDELINES.md
docs/data/DATA_MODEL.md
docs/data/ENTITY_RELATIONSHIP.md
docs/data/EVENT_CATALOG.md
docs/data/MESSAGE_CONTRACTS.md
docs/data/PLATFORM_DATA_MODEL.md
docs/database-structure.md
docs/DECISIONS.md
docs/design/COMPONENT_LIBRARY.md
docs/design/DESIGN_SYSTEM.md
docs/design/DESIGN_TOKENS.md
docs/design/PHOTO_STANDARD.md
docs/design/RESPONSIVE_UI_STANDARD.md
docs/domain/ANALYTICS_EVENTS.md
docs/domain/BONUS_DOMAIN.md
docs/domain/CLUB_ACCOUNT.md
docs/domain/CONSENT_MODEL.md
docs/domain/CUSTOMER_DOMAIN.md
docs/domain/MACHINE_DOMAIN.md
docs/domain/MEDIA_LIBRARY_STRUCTURE.md
docs/domain/NOTIFICATION_DOMAIN.md
docs/domain/ORDER_DOMAIN.md
docs/domain/PAYMENT_DOMAIN.md
docs/domain/PAYMENT_OPERATIONS_REGISTRY.md
docs/domain/PRODUCT_CATALOG.md
docs/domain/PRODUCT_DOMAIN.md
docs/domain/PRODUCT_IMAGE_MODEL.md
docs/domain/PROMOTION_DOMAIN.md
docs/domain/RECIPE_MODEL.md
docs/domain/SYRUP_CATALOG.md
docs/domain/TOPPING_CATALOG.md
docs/engineering/ENGINEERING_JOURNAL.md
docs/finance/ACCOUNTING_EXPORT.md
docs/finance/FINANCIAL_AUDIT.md
docs/finance/PAYMENT_REGISTRY.md
docs/finance/RECONCILIATION.md
docs/finance/REFUND_REGISTRY.md
docs/finance/SETTLEMENT_REGISTRY.md
docs/governance/ARCHITECTURE_DECISION_PROCESS.md
docs/governance/ARCHITECTURE_REVIEW_BOARD.md
docs/governance/CODING_STANDARDS.md
docs/governance/DOCUMENT_POLICY.md
docs/governance/ENGINEERING_PROCESS.md
docs/governance/PLATFORM_MATURITY_MODEL.md
docs/governance/QUALITY_GATES.md
docs/governance/RELEASE_PROCESS.md
docs/governance/VERSIONING_POLICY.md
docs/IDEAS_BACKLOG.md
docs/integrations/YOOKASSA.md
docs/kernel/PLATFORM_BOOTSTRAP.md
docs/kernel/PLATFORM_CONFIGURATION.md
docs/kernel/PLATFORM_KERNEL.md
docs/kernel/PLATFORM_LIFECYCLE.md
docs/kernel/RUNTIME_REGISTRY.md
docs/kernel/SERVICE_REGISTRY.md
docs/MASTER_ROADMAP.md
docs/OPERATIONS_MANUAL.md
docs/PAYMENT_ARCHITECTURE.md
docs/privacy/COOKIE_AND_TRACKING_POLICY.md
docs/PROJECT_DECISIONS.md
docs/releases/ARCHITECTURE_AUDIT.md
docs/releases/PLATFORM_CAPABILITIES.md
docs/releases/PLATFORM_MATURITY.md
docs/releases/RELEASE_1_0.md
docs/releases/RELEASE_POLICY.md
docs/releases/RELEASE_TEMPLATE.md
docs/releases/RUNTIME_COMPLETENESS_AUDIT.md
docs/releases/VERSIONING.md
docs/ROADMAP.md
docs/server_infrastructure.md
docs/sprints/v0.2.0_FIRST_PURCHASE_FLOW.md
docs/standards/ADR_TEMPLATE.md
docs/tasks/EPIC-050_PLATFORM_KERNEL.md
docs/tasks/EPIC-210_EVENT_PLATFORM.md
docs/tasks/EPIC-220_PLATFORM_CONTRACTS.md
docs/tasks/EPIC-230_ORDER_PLATFORM.md
docs/tasks/FINANCE-001_FINANCE_CORE.md
docs/tasks/FINANCE-002_TRANSACTION_DOMAIN.md
docs/tasks/FINANCE-003_LEDGER_DOMAIN.md
docs/tasks/FINANCE-004_WALLET_DOMAIN.md
docs/tasks/FINANCE-005_BONUS_ENGINE.md
docs/tasks/FINANCE-006_DISCOUNT_ENGINE.md
docs/tasks/FINANCE-007_PAYMENT_ENGINE.md
docs/tasks/FINANCE-008_ACCOUNTING_ADAPTER.md
docs/tasks/ORDER-001_ORDER_DOMAIN.md
docs/tasks/ORDER-002_CHECKOUT_PIPELINE.md
docs/tasks/ORDER-003_ORDER_STATE_MACHINE.md
docs/tasks/ORDER-004_ORDER_EVENTS.md
docs/tasks/ORDER-005_FULFILLMENT.md
docs/tasks/ORDER-006_CANCELLATION.md
docs/tasks/ORDER-007_REFUND.md
docs/tasks/ORDER-008_MACHINE_DISPATCH.md
docs/tasks/PRODUCT-004_CONFIGURATION_ENGINE.md
docs/tasks/PRODUCT-005_RECIPE_ENGINE.md
docs/tasks/PRODUCT-006_PRICING_ENGINE.md
docs/tasks/PRODUCT/PRODUCT-002.md
docs/tasks/PRODUCT/PRODUCT-003.md
docs/tasks/TASK_INDEX.md
docs/telegram_bot.md
docs/templates/DOCUMENT_HEADER_STANDARD.md
docs/testing/TEST_SCENARIOS.md
docs/TODO_NEXT.md
docs/TRAINING_AND_CERTIFICATION.md
docs/vending_machine_ui.md
docs/WORKING_DECISIONS_CURRENT.md
```

## Inconsistencies Found

1. 68 empty placeholder docs under `docs/`.
2. Empty central glossary.
3. Empty standalone ADR files.
4. Active decision log does not visibly match release claims about ADR-001 through ADR-025.
5. Duplicate project decision files.
6. Duplicate changelog files.
7. Duplicate engineering journal files.
8. Duplicate Platform Kernel file names across architecture and kernel folders.
9. Duplicate platform capabilities placeholders.
10. Payment registry ownership split across Payment Domain, Data Model and empty Finance files.
11. Product ID examples drift from semantic ID standard.
12. Product catalog examples still contain media paths and prices.
13. API overview is strong but API versioning, idempotency, errors and webhooks are empty.
14. Governance folder exists but has no content.
15. Legacy root docs mix CRM-centered and platform-runtime language.
16. Task index had stale Product Engine statuses before this audit.
17. Two broken Markdown path references existed before this audit.

## Overall Maturity Assessment

Soft ICE Platform has a strong documentation-first architecture culture and a clear bounded-context direction. The domain, data, API, kernel, order, payment and loyalty-related documents are mature enough to guide implementation increments.

The repository is not yet documentation-governance mature. Too many authoritative filenames are empty, the decision-log story is inconsistent, and older root docs can still confuse ownership. The next architecture increment should be a governance cleanup increment, not another broad concept expansion.
