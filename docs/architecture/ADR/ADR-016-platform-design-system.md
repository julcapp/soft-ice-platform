# ADR-016: Platform Design System v1

Status: Accepted  
Date: 2026-07-23  
Scope: Documentation and governance only

## Context

Admin, Executive, Operator, Customer Mini App, Customer Portal and support interfaces need one visual and interaction foundation without merging role-specific applications or moving domain logic into UI components.

## Decision

The documents under `docs/ui/` define the shared Platform Design System v1. All future screens use semantic tokens and documented components. Application aliases may adjust density and brand tone but must preserve meaning, accessibility and behavioral contracts.

Role applications remain separate. Permission checks are enforced by backends; UI visibility is explanatory only. Destructive and commercial actions require confirmation and authoritative authorization. Optional modules collapse cleanly. Accessibility targets WCAG 2.2 AA.

## Consequences

Design-system adoption is a gate for future UI increments, not evidence of implementation. Brand changes require Product Owner approval. Components cannot own pricing, media selection, payments, loyalty, machine behavior or permission policy.

## Status classification

Design System specifications are `DOCUMENTED_ONLY`; component implementations and application adoption are `FUTURE`.

