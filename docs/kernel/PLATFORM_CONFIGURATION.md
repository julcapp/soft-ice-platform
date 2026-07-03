# Platform Configuration

Status: Draft
Version: 0.1
Date: 2026-07-03
Project: Soft ICE Platform / Utimoshi
Scope: Documentation only

## Purpose

This document defines configuration loading, validation, scoping and runtime access rules for Soft ICE Platform.

Configuration controls platform behavior through explicit, validated data. Configuration must not be hidden inside UI components or Kernel business branches.

Core rule:

```text
Kernel loads and validates configuration shape.
Runtime owns domain configuration meaning.
Engine receives scoped configuration from Runtime.
UI does not own business configuration.
```

## 1. Configuration Categories

Soft ICE Platform uses these configuration categories:

| Category | Owner | Examples |
|---|---|---|
| Platform configuration | Platform Kernel | Environment name, registry mode, logging, telemetry, health, lifecycle timeouts. |
| Runtime configuration | Runtime | Runtime enablement, criticality, event subscriptions, runtime-specific settings. |
| Engine configuration | Owning Runtime and Engine | Pricing rule source, recipe source, adapter timeout, projection settings. |
| Feature flags | Platform Kernel with runtime-owned meaning | Safe rollout flags, kill switches, beta features, adapter enablement. |
| Integration configuration | Owning Runtime and Adapter | Payment provider IDs, machine adapter endpoints, notification channel references. |
| Business data | Owning Runtime | Product catalog, pricing rules, media metadata, promotion rules, bonus rules. |
| Secret references | Platform or Runtime | References to external secret store keys or injected environment secrets. |

Configuration can control behavior only when the model already supports that behavior. New business concepts still require domain model and contract design.

## 2. Configuration Source Order

Configuration loading must follow deterministic source order.

Recommended order:

1. Platform defaults that are safe for local development.
2. Environment identity and deployment mode.
3. Environment-specific platform configuration.
4. Runtime manifests.
5. Runtime configuration files or service-provided configuration.
6. Engine configuration files or service-provided configuration.
7. Feature flag configuration.
8. Integration configuration references.
9. Secret references resolved from approved external sources.
10. Runtime-owned business data.

Later sources may override earlier sources only when the key is declared overrideable by schema.

## 3. Loading Sequence

Configuration Service loads configuration during Platform Bootstrap.

Sequence:

1. Discover configuration sources.
2. Read raw configuration.
3. Parse configuration format.
4. Merge configuration layers.
5. Validate platform schema.
6. Validate runtime configuration schemas.
7. Validate engine configuration schemas.
8. Validate feature flag schema.
9. Validate integration references.
10. Validate required secret references without logging secret values.
11. Create immutable configuration snapshot.
12. Assign configuration snapshot version.
13. Expose scoped configuration to Platform Services and runtimes.

Configuration is not considered available until the snapshot is valid.

## 4. Configuration Snapshot

A configuration snapshot is the immutable set of validated configuration used by a running platform instance.

Snapshot metadata:

| Field | Meaning |
|---|---|
| `snapshot_id` | Stable ID for the loaded configuration snapshot. |
| `created_at` | Timestamp from Clock Service. |
| `environment` | Deployment environment. |
| `platform_version` | Platform version or release reference. |
| `schema_versions` | Platform, runtime and engine schema versions. |
| `source_refs` | Safe references to configuration sources. |
| `validation_status` | `valid`, `invalid`, or `degraded_allowed`. |
| `feature_flag_version` | Feature flag revision included in the snapshot. |

Snapshot rules:

- snapshots must be read-only after startup;
- snapshots must not contain raw secrets in logs or diagnostics;
- runtime receives only its scoped configuration;
- snapshot version must be included in startup logs and telemetry;
- configuration changes after startup require explicit reload policy.

## 5. Schema Rules

Every configuration category must have an explicit schema before implementation.

Schema rules:

- required keys are declared;
- optional keys declare defaults or fallback behavior;
- environment-specific keys are identified;
- secret references are marked;
- reloadability is declared per key;
- validation errors are human-readable;
- unsafe defaults are forbidden for payment, ledger, machine and security settings;
- deprecated keys remain rejected or mapped through an explicit migration rule.

Schema validation checks shape and constraints. Runtime validation checks domain meaning.

Example:

```text
Configuration Service can validate that bonus_limit_percent is a number.
Bonus Runtime or Pricing Runtime owns whether the number is allowed by business policy.
```

## 6. Runtime Configuration

Runtime configuration controls runtime enablement, dependencies, event behavior and runtime-owned policies.

Runtime configuration should include:

- `runtime_id`;
- enabled or disabled state;
- criticality for current deployment;
- required services;
- optional services and fallback behavior;
- event producers and consumers;
- runtime health check settings;
- runtime startup and shutdown timeouts;
- runtime-owned business rule source references;
- runtime-specific adapter references.

Rules:

- disabled critical runtimes must block readiness for deployments that require them;
- optional runtimes must declare what functionality is unavailable when disabled;
- runtime configuration must not be read directly by UI components;
- runtime configuration must not expose another Runtime's private settings;
- Runtime owns validation of domain-specific policy meaning.

## 7. Engine Configuration

Engine configuration is scoped under the owning Runtime.

Engine configuration may include:

- data source reference;
- rule source reference;
- adapter timeout;
- retry policy;
- idempotency policy;
- calculation mode;
- repository mode;
- feature flag bindings;
- health check settings.

Rules:

- Engine configuration is passed through the owning Runtime;
- Engine must not read process environment directly unless it is an approved adapter boundary;
- Engine configuration cannot change another Engine's behavior directly;
- Engine-specific behavior must remain behind Engine contracts;
- dangerous runtime changes require explicit validation and audit.

## 8. Feature Flags

Feature flags are controlled configuration values used for safe rollout and emergency stop.

Feature flag types:

| Type | Purpose |
|---|---|
| Release flag | Enables a feature for a controlled deployment. |
| Kill switch | Disables unsafe behavior quickly. |
| Runtime flag | Enables or disables a Runtime or adapter. |
| Experiment flag | Enables limited UX or analytics experiments. |
| Policy flag | Selects an approved runtime policy variant. |

Rules:

- feature flags must have owners;
- feature flags must have removal criteria;
- feature flags must be observable in telemetry;
- kill switches must be tested before production use;
- flags must not hide unmodeled business behavior;
- flags must not bypass payment, ledger, order or machine safety rules.

## 9. Integration Configuration

Integration configuration belongs to the Runtime that owns the adapter.

Examples:

| Integration | Owning Runtime |
|---|---|
| Payment provider | Payment Runtime |
| Accounting export | Accounting Adapter Runtime |
| Vending machine adapter | Machine Runtime |
| Telegram notification channel | Notification Runtime |
| CRM operator identity provider | Customer and CRM Runtime |
| Analytics destination | Analytics Runtime |

Rules:

- provider credentials are secrets and must not be stored in repository files;
- adapter endpoints must be environment-specific;
- retries, timeouts and circuit breaker settings must be explicit;
- provider status mappings belong to the owning Runtime, not Kernel;
- integration health must be visible through Health Monitor.

## 10. Business Data Configuration

Business data is configuration-like data owned by runtimes.

Examples:

- product catalog;
- syrup and topping catalogs;
- media metadata;
- recipe definitions;
- pricing rules;
- discount rules;
- bonus policies;
- promotion campaign rules;
- notification templates.

Rules:

- business data must not be hardcoded in React components;
- business data must not be owned by Platform Kernel;
- data may start as JSON for MVP;
- repository and service boundaries must allow replacement by REST API and PostgreSQL later;
- business data changes should be auditable when they affect customer, payment, order, machine or promotion behavior.

## 11. Secrets

Secrets include:

- payment provider credentials;
- machine adapter credentials;
- database credentials;
- message channel tokens;
- signing keys;
- API keys;
- private certificates.

Rules:

- secrets must not be committed to GitHub;
- secrets must not appear in logs, telemetry, events, screenshots or documentation examples;
- configuration files may reference secret names, not values;
- missing required secret references fail startup;
- secret rotation must be supported by adapter design when production integration is introduced.

## 12. Configuration Reload

Configuration reload is not automatic unless a key is declared reloadable.

Reloadable configuration may include:

- non-critical feature flags;
- logging verbosity;
- selected runtime thresholds;
- analytics sampling rates;
- notification channel fallback ordering.

Non-reloadable configuration should include:

- payment provider identity;
- ledger storage mode;
- order state machine rules;
- machine safety configuration;
- security policy;
- required runtime dependencies;
- schema version changes.

Reload sequence:

1. Load candidate configuration.
2. Validate schema.
3. Validate reloadability.
4. Ask affected runtimes to validate domain meaning.
5. Create new snapshot version.
6. Apply reload through runtime hooks.
7. Emit audit and telemetry.
8. Roll back if validation or runtime apply fails.

## 13. Configuration Health

Configuration Service contributes to Health Monitor.

Health states:

| State | Meaning |
|---|---|
| `valid` | Current snapshot is valid and in use. |
| `degraded` | Optional configuration is invalid or optional provider config is unavailable with fallback. |
| `invalid` | Required configuration is invalid. |
| `reload_pending` | Candidate snapshot is being validated. |
| `rollback_required` | Reload failed and previous valid snapshot must be retained. |

Invalid required configuration must block readiness.

## 14. Dependency Rules

Configuration dependency rules:

- Kernel may load and validate configuration shape;
- Runtime owns domain meaning of runtime configuration;
- Engine receives configuration only from owning Runtime;
- UI must not read business configuration directly;
- another Runtime's private configuration must not be accessed directly;
- configuration must not be used to bypass domain contracts;
- every behavior-changing configuration must be traceable to owner and snapshot version.

## 15. Acceptance Criteria

Platform Configuration documentation is acceptable when:

- configuration categories are defined;
- source order and loading sequence are documented;
- configuration snapshot rules are defined;
- platform, runtime and engine configuration rules are defined;
- feature flag rules are defined;
- integration and secrets rules are defined;
- business data ownership is documented;
- reload and health behavior are defined;
- dependency rules protect Kernel, Runtime, Engine and UI boundaries;
- no application code is modified by this documentation increment.
