# AGENTS.md

Status: Approved
Version: 1.0
Project: Soft ICE Platform / «У Тимоши»

## Purpose

Primary instruction document for AI coding agents working in this repository, including Codex Desktop and compatible development agents.

AI agents must read and follow this file before making changes.

## Project mission

Soft ICE Platform is a digital platform for a soft ice cream vending business. The platform includes Mini App, web app, Telegram bot, CRM, vending machine integration, product catalog, media library, payment flow, loyalty program, analytics and future AI modules.

MVP goal:

```text
A customer can select a dessert, pay for it and receive it from a vending machine.
```

## Repository

```text
julcapp/soft-ice-platform
```

GitHub is the single source of truth.

## Required reading before coding

```text
docs/architecture/ARCHITECTURE_PRINCIPLES.md
docs/architecture/PROJECT_DECISIONS.md
docs/design/DESIGN_SYSTEM.md
docs/design/DESIGN_TOKENS.md
docs/design/COMPONENT_LIBRARY.md
docs/design/RESPONSIVE_UI_STANDARD.md
docs/design/PHOTO_STANDARD.md
docs/domain/PRODUCT_CATALOG.md
docs/domain/SYRUP_CATALOG.md
docs/domain/TOPPING_CATALOG.md
docs/domain/PRODUCT_IMAGE_MODEL.md
docs/domain/MEDIA_LIBRARY_STRUCTURE.md
docs/testing/TEST_SCENARIOS.md
CHANGELOG.md
PROJECT_MEMORY.md
PROJECT_STATE.md
DEVELOPMENT_WORKFLOW.md
docs/DEPLOYMENT_ENDPOINTS.md
```

## Core architecture rules

1. GitHub is the single source of truth.
2. Documentation evolves together with code.
3. Business data must be separated from UI.
4. Product catalog is shared across all platforms.
5. All UI must be responsive by default.
6. Components should be reusable.
7. Media library is a separate subsystem.
8. Business logic belongs in services, not screens.
9. New features should be introduced safely and incrementally.
10. Versioning is mandatory.
11. Model first, interface second.
12. Work is delivered as complete engineering increments.

## Current engineering focus

```text
Integration hardening and acceptance for v0.36.0
```

Current priorities:

- preserve one source of truth in PostgreSQL-backed runtime boundaries;
- complete Telegram/MAX bot delivery behind disabled-by-default flags;
- keep production unchanged until explicit release approval;
- remove duplicate interfaces and converge role-specific workspaces on shared code.

## Coding rules

Do not hardcode business data in React components:

- prices;
- product names;
- syrup lists;
- topping lists;
- media paths;
- discount rules;
- loyalty rules.

Use data files and services.

React components must not calculate final prices or choose product images directly.

Use stable semantic IDs:

```text
product_soft_ice_vanilla_cup
flavor_vanilla
syrup_strawberry
topping_oreo
media_soft_ice_vanilla_strawberry_oreo
```

JSON files are temporary data storage. Services must be written so JSON can later be replaced with REST API and PostgreSQL without rewriting UI components.

## UI rules

Follow:

```text
docs/design/DESIGN_SYSTEM.md
docs/design/DESIGN_TOKENS.md
docs/design/RESPONSIVE_UI_STANDARD.md
```

All screens must support mobile, tablet, desktop, vending terminal and large touch screen layouts.

## Media rules

Follow:

```text
docs/design/PHOTO_STANDARD.md
docs/domain/MEDIA_LIBRARY_STRUCTURE.md
docs/domain/PRODUCT_IMAGE_MODEL.md
```

Do not place media selection logic inside screens.

## Testing rules

Before completing a coding task, run:

```bash
cd frontend/miniapp
npm run build
```

If behavior changes, update:

```text
docs/testing/TEST_SCENARIOS.md
```

## Documentation rules

Update documentation when changing architecture, domain model, folder structure, product flow, pricing logic, media logic, payment logic or loyalty logic.

Update `CHANGELOG.md` for meaningful changes.

Update `docs/architecture/PROJECT_DECISIONS.md` when making a significant architectural decision.

## Git rules

Canonical branch names:

```text
feature/<task>
fix/<task>
docs/<task>
hotfix/<task>
```

The branch identifies the task, not the device. Continue the same branch when moving
between phone and PC. Legacy `work/phone/*` and `work/pc/*` branches may be
completed, but new work must use the canonical names above.

Direct pushes to `main` and `integration/*` are prohibited. Target
`integration/unified-v0.36.0` from a task branch unless the Product Owner
explicitly approves another base.

Commit examples:

```text
feat: add product catalog data layer
feat: add price engine
fix: resolve product screen pricing
chore: update test scenarios
docs: update architecture decisions
```

## Definition of Done

A task is complete only when:

- code is implemented;
- build passes;
- no known JavaScript console errors are introduced;
- documentation is updated if needed;
- test scenarios are updated if behavior changed;
- CHANGELOG is updated for meaningful changes;
- architecture decisions are updated if needed;
- no generated build output is committed.

## Do not do

Do not:

- commit local environment files;
- commit credentials;
- commit generated `dist/` build output;
- hardcode prices in UI components;
- hardcode product media paths in UI components;
- bypass CatalogService, MediaService or PriceEngine when implementing product logic;
- overwrite unrelated files;
- make broad rewrites without clear reason;
- change brand/product decisions without explicit approval.

## Product Owner

Product Owner: Alexander Ilyin.

Major product decisions require explicit approval from the Product Owner.
