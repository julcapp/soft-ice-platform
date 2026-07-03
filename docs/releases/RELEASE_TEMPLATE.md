# Release Template

Status: Template
Version: 1.0
Project: Soft ICE Platform / Utimoshi

## Purpose

This template defines the required structure for every Soft ICE Platform release document.

Use it for architecture releases, runtime releases, documentation releases and mixed releases.

Every release document must make the release scope, included runtime, included architecture decisions, business rules, known issues and approval status explicit.

## Release Header

The release header identifies the release record and its ownership.

Required fields:

- Release name:
- Release type: Architecture / Runtime / Documentation / Mixed
- Release owner:
- Product owner:
- Repository:
- Source branch:
- Git tag:
- GitHub release URL:
- Related release document:

## Version

The version section defines the version being released and the versioning policy used.

Required fields:

- Release version:
- Architecture version:
- Runtime version:
- Documentation version:
- Previous version:
- Versioning rule:

Rules:

- Runtime versions must follow Semantic Versioning.
- Architecture versions must follow the architecture versioning rules in `docs/releases/VERSIONING.md`.
- Documentation-only releases must state whether runtime and architecture versions are unchanged.

## Date

The date section records the release timeline.

Required fields use `YYYY-MM-DD` format:

- Release date:
- Freeze date:
- Approval date:
- Publication date:

## Status

The status section defines the current release state.

Allowed statuses:

- Draft
- Frozen
- Approved
- Released
- Superseded
- Cancelled

Only `Approved` or `Released` release documents can be used as official release references.

## Scope

The scope section defines what is included and excluded.

Required fields:

- In scope:
- Out of scope:
- Affected domains:
- Affected applications:
- Affected documentation:

The scope must explicitly state if application code, frontend code, backend code, infrastructure or only documentation is included.

## Included Runtime

The included runtime section defines the runtime artifacts shipped by the release.

Required fields:

- Runtime name:
- Runtime version:
- Runtime components:
- Build command:
- Build result:
- Deployment target:

For architecture-only or documentation-only releases, write `None` and confirm that no runtime artifact is shipped.

## Included ADR

The included ADR section lists accepted architecture decision records included in the release.

Required fields:

- ADR ID:
- ADR title:
- ADR status:
- ADR document path:

Every significant architectural decision included in a release must be traceable through an ADR or the project decision log.

## Included Business Rules

The included business rules section lists the business rules established or changed by the release.

Required fields:

- Rule ID or name:
- Rule description:
- Owning domain:
- Affected flows:
- Backward compatibility impact:

Business rules must not be hidden only in UI code, screen text or implementation details.

## Included Tasks

The included tasks section lists completed work items included in the release.

Required fields:

- Task ID:
- Task title:
- Task status:
- Task document path:
- Verification result:

## Known Issues

The known issues section records accepted limitations at release time.

Required fields:

- Issue:
- Impact:
- Workaround:
- Owner:
- Target follow-up:

Known issues must be clear enough for future development, support and release planning.

## Future Work

The future work section records follow-up work intentionally left outside the release.

Required fields:

- Future item:
- Reason for deferral:
- Target release or sprint:
- Dependencies:

Future work must not be treated as released functionality.

## Approval

The approval section records release acceptance.

Required fields:

- Approval status:
- Product owner:
- Engineering reviewer:
- Approval date:
- Approval notes:

Major product decisions require explicit Product Owner approval.

## Sign-off

The sign-off section records final release readiness.

Required fields:

- Product sign-off:
- Engineering sign-off:
- QA sign-off:
- Documentation sign-off:
- Release manager sign-off:

Sign-off confirms that the release scope, documentation, quality gates, known issues and future work are understood and accepted.
