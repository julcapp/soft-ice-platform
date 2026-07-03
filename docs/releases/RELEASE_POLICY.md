# Release Policy

Status: Active
Version: 1.0
Project: Soft ICE Platform / Utimoshi

## Purpose

This document defines how Soft ICE Platform releases are prepared, frozen, approved, tagged and documented.

GitHub is the single source of truth for releases. A release is official only when its release document, related documentation updates, quality gates and approval status are recorded in the repository.

## Release Process

Every release follows a controlled process:

1. Define the release scope.
2. Identify whether the release is architecture, runtime, documentation or mixed.
3. Create or update the release document in `docs/releases/`.
4. Link included runtime versions, ADR, business rules and task records.
5. Update `CHANGELOG.md` for meaningful changes.
6. Update `ENGINEERING_JOURNAL.md` when the release changes architecture, process, runtime behavior or delivery state.
7. Update `docs/architecture/PROJECT_DECISIONS.md` when a significant architectural or governance decision is made.
8. Run required quality gates for the release type.
9. Freeze the release scope.
10. Obtain approval.
11. Create the Git tag and GitHub Release when applicable.

Release documents must use `docs/releases/RELEASE_TEMPLATE.md`.

## Freeze Process

A release freeze means the scope is closed and only release-blocking corrections are allowed.

During freeze:

- No new feature scope is added.
- No unrelated refactoring is added.
- No product decision is changed without Product Owner approval.
- Documentation corrections are allowed only when they clarify the frozen scope.
- Runtime fixes are allowed only when they address release-blocking defects.

The freeze date must be recorded in the release document.

If the frozen scope changes materially, the release returns to `Draft` status and must pass approval again.

## Approval Process

Approval confirms that the release is ready to become an official project reference.

Required approvals:

- Product Owner approval for product scope, business rules and customer-facing behavior.
- Engineering approval for architecture, implementation scope and technical quality.
- Documentation approval for release notes, ADR references, task links and known limitations.
- QA or verification approval for applicable quality gates.

Architecture releases require explicit confirmation that they do not contradict the active Architecture Baseline.

Runtime releases require a passing build and verification against the relevant test scenarios.

Documentation-only releases must explicitly confirm that no application code, frontend code or runtime artifact was modified.

## GitHub Release Policy

GitHub is the official publication channel for completed releases.

Rules:

- Runtime release tags use `vMAJOR.MINOR.PATCH`.
- Runtime prerelease tags may use suffixes such as `-alpha.1`, `-beta.1` or `-rc.1`.
- Architecture release tags use `architecture-vMAJOR.MINOR`.
- Documentation-only governance releases may be included in the next runtime or architecture release unless the Product Owner requests a separate GitHub Release.
- Published tags must not be rewritten. Corrections require a new patch, minor or superseding release.
- GitHub Release notes must link the release document in `docs/releases/`.
- Release notes must summarize scope, included runtime, included ADR, known issues and future work.

GitHub Releases are not a replacement for repository documentation. The repository release document remains the canonical release record.

## Documentation Requirements

Each release must keep documentation synchronized with the released scope.

Required documentation checks:

- Release document exists in `docs/releases/`.
- `CHANGELOG.md` is updated for meaningful changes.
- `ENGINEERING_JOURNAL.md` is updated for engineering increments and release governance changes.
- `docs/architecture/PROJECT_DECISIONS.md` is updated for significant architecture or governance decisions.
- Task documents are updated when task scope is included.
- Test scenarios are updated when runtime behavior changes.
- Known limitations are documented.
- Future work is documented without implying it is released.

Documentation-only changes must state that no runtime behavior changed.

## Quality Gates

Quality gates depend on release type.

Architecture release gates:

- Architecture baseline or architecture document is present.
- Included ADR are listed.
- Business rules and domain boundaries are explicit.
- Backward compatibility impact is documented.
- Known limitations are documented.
- Product Owner approval is recorded for major product decisions.

Runtime release gates:

- Application build passes.
- Relevant test scenarios pass or limitations are recorded.
- No generated build output is committed.
- No credentials or local environment files are committed.
- No known JavaScript console errors are introduced.
- Runtime version and Git tag are defined.

Documentation-only release gates:

- Only documentation files are modified.
- No application code, frontend code or UI files are modified.
- The release document states that no runtime artifact is shipped.
- Documentation links and references are internally consistent.

## Release Numbering

Release numbering is defined in `docs/releases/VERSIONING.md`.

Summary:

- Runtime versions follow Semantic Versioning: `MAJOR.MINOR.PATCH`.
- Runtime prereleases use SemVer prerelease suffixes.
- Architecture releases use architecture version numbers such as `1.0`, `1.1` and `2.0`.
- Documentation-only governance changes do not automatically change runtime version.
- A release document must state every version affected by the release.

## Backward Compatibility

Backward compatibility means existing documented contracts, semantic IDs, data models and runtime flows continue to work unless a breaking change is explicitly approved.

Backward-compatible changes may include:

- New optional fields.
- New engines or services that do not break existing contracts.
- New documentation that clarifies existing rules.
- New business rules that do not invalidate existing released flows.

Backward compatibility must be evaluated for:

- Product catalog IDs.
- Domain contracts.
- Event names and payloads.
- Pricing and discount rules.
- Payment and order lifecycle states.
- Machine command boundaries.
- Public runtime behavior.

## Breaking Changes Policy

Breaking changes are allowed only when they are intentional, documented and approved.

A breaking change requires:

- Clear reason.
- Compatibility impact.
- Migration path.
- Release note.
- ADR or decision log entry.
- Product Owner approval when product behavior changes.
- Major runtime or architecture version bump when released.

Breaking changes must not be hidden inside patch releases, undocumented refactors or UI-only changes.
