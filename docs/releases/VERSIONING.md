# Versioning

Status: Active
Version: 1.0
Project: Soft ICE Platform / Utimoshi

## Purpose

This document defines versioning rules for Soft ICE Platform architecture, runtime artifacts, ADR and release documentation.

Versioning is mandatory because GitHub is the single source of truth and every completed release must be traceable.

## Architecture Versioning

Architecture versions describe the official architecture baseline of the platform.

Architecture version format:

```text
MAJOR.MINOR
```

Examples:

```text
1.0
1.1
2.0
```

Patch-level architecture numbers may be used only for non-breaking documentation corrections when the Product Owner and engineering reviewer agree that no architectural meaning changed.

Architecture versions are separate from runtime versions.

An architecture release may include no runtime artifact.

## Semantic Versioning Policy

Runtime versions follow Semantic Versioning:

```text
MAJOR.MINOR.PATCH
```

Prerelease versions may use:

```text
MAJOR.MINOR.PATCH-alpha.N
MAJOR.MINOR.PATCH-beta.N
MAJOR.MINOR.PATCH-rc.N
```

Examples:

```text
0.3.0-alpha.1
1.0.0
1.1.0
1.1.1
```

Documentation-only changes do not automatically change runtime version.

Every release document must state whether architecture version, runtime version or documentation version changed.

## Major

A major version changes when compatibility is intentionally broken.

Major architecture changes include:

- Replacing the active architecture baseline.
- Changing domain ownership rules.
- Changing the Product Flow order in a way that affects released contracts.
- Removing or replacing official engine boundaries.
- Introducing incompatible domain contracts or event contracts.

Major runtime changes include:

- Breaking public application behavior.
- Breaking persisted data compatibility.
- Breaking API or integration contracts.
- Requiring a migration that old runtime versions cannot use safely.

Major changes require explicit approval and a release document that explains migration and compatibility impact.

## Minor

A minor version changes when backward-compatible capability is added.

Minor architecture changes include:

- Adding a new engine, domain or platform layer without breaking existing contracts.
- Adding new ADR that extend the baseline.
- Adding new business rules that preserve existing released flows.
- Adding new integration boundaries that do not replace existing ones.

Minor runtime changes include:

- Adding a new feature.
- Adding an optional API field.
- Adding a new UI flow without breaking existing flows.
- Adding support for a new payment, order, machine, CRM or analytics capability in a compatible way.

Minor changes require release documentation and quality gates appropriate to the release type.

## Patch

A patch version changes when behavior is corrected without adding new product capability or breaking compatibility.

Patch architecture changes include:

- Typo corrections.
- Link corrections.
- Clarifications that do not change architecture meaning.
- Non-breaking terminology cleanup.

Patch runtime changes include:

- Bug fixes.
- Security fixes that preserve contracts.
- Compatibility fixes.
- Build or configuration fixes that do not change product scope.

Patch changes must still be recorded when they are meaningful for release history.

## Architecture Release Rules

Architecture releases must:

- Use an architecture version.
- Have a release document in `docs/releases/`.
- Reference the active architecture baseline.
- List included ADR.
- List included business rules.
- List included tasks or epics when applicable.
- State whether any runtime artifact is included.
- Document known limitations and future work.
- Record approval and sign-off.

Architecture releases are official only after approval.

Architecture releases must not imply runtime delivery unless a runtime version is explicitly included.

## Runtime Version Rules

Runtime releases must:

- Use Semantic Versioning.
- Identify the runtime artifact and deployment target.
- Pass the required build command.
- Pass or update relevant test scenarios.
- Record known issues.
- Update `CHANGELOG.md`.
- Avoid committing generated build output.
- Avoid committing credentials or local environment files.

Runtime versions are advanced only when runtime behavior, runtime configuration or deployable artifacts change.

Documentation-only changes do not advance runtime version unless they are part of a formal runtime release note correction.

## ADR Version Rules

ADR IDs are stable and must not be reused.

ADR rules:

- ADR are numbered sequentially.
- Accepted ADR remain in the decision log.
- Superseded ADR are not deleted; a newer ADR explains the replacement.
- Release documents list included ADR by ID.
- Significant architecture or governance decisions require an ADR or project decision log entry.
- ADR changes do not automatically change runtime version.

ADR history is part of the release audit trail.
