# PRODUCT-004 — Configuration Engine Foundation

**Task ID:** PRODUCT-004

**Sprint:** Product Platform Sprint 1

**Status:** Planned

**Priority:** High

---

# 1. Goal

Build the first implementation of Configuration Engine.

Configuration Engine must become the single source of truth responsible for building valid product configurations.

No UI logic.

No pricing.

No recipe execution.

No machine control.

Only configuration building.

---

# 2. Architecture References

Before implementation read:

- AGENTS.md
- PROJECT_MEMORY.md
- docs/architecture/CONFIGURATION_ENGINE.md
- docs/architecture/ARCHITECTURE_PRINCIPLES.md
- docs/architecture/PROJECT_DECISIONS.md

---

# 3. Scope

Implement:

Configuration Engine

including

- ConfigurationEntity
- ConfigurationRepository
- ConfigurationService
- index.js

---

# 4. Suggested Structure

frontend/

miniapp/

src/

domain/

configuration/

ConfigurationEntity.js

ConfigurationRepository.js

ConfigurationService.js

index.js

---

# 5. Responsibilities

ConfigurationEntity

Stores complete product configuration.

ConfigurationRepository

Loads configuration rules.

ConfigurationService

Builds valid configuration.

Performs validation.

Returns ConfigurationEntity.

---

# 6. Build Rules

Configuration Engine MUST NOT

- know React

- know App.jsx

- know pages

- know UI

- know Telegram

- know Browser APIs

---

# 7. Allowed Changes

May modify

frontend/miniapp/src/domain/configuration/*

CHANGELOG.md

ENGINEERING_JOURNAL.md

PROJECT_DECISIONS.md

---

# 8. Forbidden Changes

Do NOT modify

App.jsx

pages/

components/

routes/

styles/

assets/

analytics/

Telegram integration

CRM

Machine code

---

# 9. Verification

Required

npm run build

Build must pass.

---

# 10. Documentation

Update

CHANGELOG.md

ENGINEERING_JOURNAL.md

PROJECT_DECISIONS.md

---

# 11. Deliverables

ConfigurationEntity

ConfigurationRepository

ConfigurationService

Module exports

Architecture notes

Successful build

---

# 12. Acceptance Criteria

Repository builds.

No UI changes.

Configuration Engine isolated.

No browser globals.

No React dependency.

No runtime errors.

---

# 13. Commit Message

feat: add configuration engine foundation

---

# 14. Report

Final report must include

Architecture Summary

Files changed

Build result

Verification result

Documentation updated

Future recommendations

---

# 15. Rollback

Removing folder

domain/configuration

must completely remove this feature without affecting any other domain.