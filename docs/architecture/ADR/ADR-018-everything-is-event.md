# ADR-018: Everything Is Event Foundation

Status: Accepted  
Date: 2026-07-23  
Scope: Documentation and architecture only

## Context

Cross-domain reporting, audit, machine integration, Digital Twin and future recommendations require stable facts and correlation. Uncontrolled messages would create incompatible schemas, duplicate side effects and privacy risk.

## Decision

Material domain outcomes use immutable, past-tense, versioned events with the envelope and governance in `EVERYTHING_IS_EVENT.md`. Authoritative domain state remains the source of truth. Consumers are idempotent; sensitive data is minimized; vendor events are normalized; failed consumers do not block origin transactions unless an approved invariant requires it.

Audit and integration events remain related but distinct. Cross-domain work prefers governed events or explicit service contracts. Each new event requires documented ownership, schema, purpose, classification, retention and version.

## Consequences

Future producers need an atomic publication boundary and replay/recovery policy. Consumer lag and failure are observable. This ADR does not introduce a broker, schema registry, outbox table, runtime publisher or consumer.

## Status classification

Event governance and envelope are `FOUNDATION_ONLY`; the listed catalog is documented; platform-wide runtime adoption is `FUTURE`.

