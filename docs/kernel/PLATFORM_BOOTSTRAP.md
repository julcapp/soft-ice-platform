# Platform Bootstrap

Status: Draft
Version: 0.1
Date: 2026-07-03
Project: Soft ICE Platform / Utimoshi
Scope: Documentation only

## Purpose

This document defines the Platform Bootstrap sequence for Soft ICE Platform.

Platform Bootstrap is the startup process that loads configuration, initializes Platform Services, registers runtimes and engines, validates dependencies, starts runtimes, runs health checks and marks platform readiness.

Platform Bootstrap coordinates startup. It does not contain product, pricing, payment, order, machine, loyalty, promotion or customer business logic.

## 1. Bootstrap Principles

Bootstrap must be:

- deterministic;
- observable;
- fail-safe;
- idempotent where practical;
- explicit about dependencies;
- strict about required configuration;
- strict about required runtime dependencies;
- safe to stop before readiness;
- compatible with future replacement of local JSON data by API and PostgreSQL.

Bootstrap must not:

- calculate prices;
- create orders;
- collect payments;
- send machine commands;
- publish customer notifications as a side effect of startup;
- mutate business state unless a Runtime explicitly owns a startup migration or repair task approved by its contract.

## 2. Startup Inputs

Bootstrap receives:

| Input | Description |
|---|---|
| Process environment | Deployment environment, runtime mode, paths, port bindings and secret references. |
| Platform configuration | Kernel and platform service configuration. |
| Runtime manifests | Runtime registration metadata. |
| Service manifests | Platform service and runtime service metadata. |
| Engine manifests | Engine registration metadata from runtimes. |
| Feature flag configuration | Deployment flags and kill switches. |
| Integration references | Provider, channel and machine adapter configuration references. |

Secrets must be referenced through external secret storage or environment-specific secure injection. Secrets must not be committed to the repository.

## 3. Bootstrap Context

Bootstrap creates a startup context containing:

- platform version;
- deployment environment;
- startup correlation ID;
- startup timestamp from Clock Service;
- configuration snapshot version;
- logger instance;
- telemetry instance;
- security context root;
- runtime registry reference;
- service registry reference;
- startup deadline;
- shutdown signal handlers.

The startup context is passed to Platform Services and Runtime startup hooks. It must not expose unrelated Runtime configuration to other runtimes.

## 4. Startup Sequence

The expected startup sequence is:

| Step | Phase | Action | Failure policy |
|---:|---|---|---|
| 1 | Environment | Load platform environment and deployment identity. | Fail startup if required environment identity is missing. |
| 2 | Configuration | Load platform configuration sources. | Fail startup if required configuration source is unavailable. |
| 3 | Configuration | Parse and merge configuration layers. | Fail startup on invalid syntax or merge conflict for required keys. |
| 4 | Configuration | Validate platform configuration schema. | Fail startup on invalid required configuration. |
| 5 | Observability | Initialize Logger. | Fail startup if no safe logging path exists. |
| 6 | Observability | Initialize Telemetry. | Continue only if telemetry degradation policy permits; otherwise fail startup. |
| 7 | Security | Initialize Security Context Service and Identity Context Service. | Fail startup if required security policy cannot be loaded. |
| 8 | Core services | Initialize Configuration Service with immutable startup snapshot. | Fail startup on invalid snapshot. |
| 9 | Registries | Initialize Runtime Registry and Service Registry. | Fail startup if registries cannot enforce uniqueness and dependency validation. |
| 10 | Events | Initialize Event Bus infrastructure. | Fail startup if Event Runtime is required for the deployment and cannot initialize. |
| 11 | Platform services | Register Platform Services. | Fail startup if required Platform Service registration fails. |
| 12 | Discovery | Discover runtime manifests. | Fail startup if a required Runtime manifest is missing. |
| 13 | Runtime registration | Register runtimes in Runtime Registry. | Fail startup on duplicate runtime IDs or invalid manifests. |
| 14 | Engine registration | Register runtime-owned engines in Service Registry. | Fail startup when a required Engine contract is missing or duplicate. |
| 15 | Config scoping | Load and validate runtime and engine configuration schemas. | Fail startup for invalid required runtime or engine configuration. |
| 16 | Dependency graph | Build runtime, service and engine dependency graph. | Fail startup on circular required dependencies. |
| 17 | Event contracts | Register event producers and consumers. | Fail startup when required event contracts are invalid. |
| 18 | Health setup | Register health checks for platform, services, runtimes, engines and integrations. | Fail startup if required health check registration fails. |
| 19 | Runtime startup | Start runtimes in dependency order. | Fail startup when a critical Runtime cannot start. |
| 20 | Readiness checks | Run readiness health checks. | Mark degraded or fail according to criticality policy. |
| 21 | Readiness | Mark platform readiness. | Readiness is not exposed until required runtimes and services are ready. |
| 22 | Operation | Start accepting platform work. | Runtime-specific work begins only after that Runtime is ready. |

## 5. Runtime Registration During Bootstrap

Runtime registration occurs before runtime startup.

Bootstrap must:

1. read each runtime manifest;
2. validate required manifest fields;
3. register `runtime_id` in Runtime Registry;
4. attach runtime configuration schema reference;
5. attach declared services and engines;
6. attach event producers and consumers;
7. attach health checks;
8. attach lifecycle hooks;
9. record dependency requirements;
10. keep runtime in `registered` state until configuration validation succeeds.

Runtimes must not start themselves outside Platform Bootstrap.

## 6. Engine Registration During Bootstrap

Engine registration occurs after Runtime registration and before Runtime startup.

Bootstrap must:

1. receive Engine metadata from the owning Runtime manifest;
2. validate unique `engine_id`;
3. validate owning `runtime_id`;
4. register Engine facade or contract in Service Registry;
5. validate Engine dependencies;
6. validate Engine configuration schema if present;
7. attach Engine health checks;
8. record Engine readiness as part of owning Runtime readiness.

The Kernel records Engine registration. The Runtime owns Engine initialization and business behavior.

## 7. Dependency Resolution

Bootstrap resolves dependencies in this order:

1. Platform Services.
2. Platform Runtime.
3. Event Runtime when required by other runtimes.
4. Product capability runtimes required by checkout.
5. Finance capability runtimes required by payment.
6. Order Runtime.
7. Machine Runtime.
8. Notification Runtime.
9. Customer/CRM, Analytics, Promotion and AI runtimes as configured.

The actual startup graph must be derived from manifests, not hardcoded from this list.

Rules:

- required dependency failure blocks readiness;
- optional dependency failure must enter declared degraded mode;
- circular required dependencies fail startup;
- events may reduce direct startup coupling only when both producer and consumer have idempotent handling;
- Kernel must not decide business fallback behavior.

## 8. Configuration Loading During Bootstrap

Bootstrap uses Configuration Service to load:

- platform configuration;
- runtime configuration;
- engine configuration;
- feature flags;
- integration references;
- business data references owned by runtimes.

Configuration rules are defined in `docs/kernel/PLATFORM_CONFIGURATION.md`.

Bootstrap must fail safely when required configuration is invalid. It must not silently use production defaults for required payment, machine, security or finance settings.

## 9. Health Monitoring During Bootstrap

Health Monitor starts before runtimes start.

Bootstrap health checks include:

| Health area | Example check |
|---|---|
| Configuration | Required platform and runtime configuration is valid. |
| Registry | Runtime and service registrations are unique and complete. |
| Event infrastructure | Event Bus can initialize and validate envelopes. |
| Runtime dependencies | Required runtimes and services are ready. |
| Engine readiness | Required engines initialized through owning Runtime. |
| Adapter readiness | Required provider, channel or device adapters are reachable or safely disabled. |

Startup health states:

```text
starting -> ready
starting -> degraded
starting -> failed
```

Only `ready` or explicitly allowed `degraded` deployments may accept work.

## 10. Startup Failure Policy

Startup must fail safely when:

- required platform configuration is invalid;
- required runtime configuration is invalid;
- required secret reference is missing;
- duplicate runtime, service or engine IDs are detected;
- required dependency graph has a cycle;
- critical Runtime startup fails;
- critical Engine initialization fails;
- Event Runtime is required and cannot start;
- security context cannot initialize;
- payment, ledger, order or machine safety configuration is incomplete for commercial deployment.

When startup fails:

- platform readiness must remain false;
- failure reason must be logged;
- telemetry must record failure when available;
- partial runtime startup must be stopped through graceful shutdown where possible;
- no new business work may be accepted.

## 11. Degraded Startup Policy

Degraded startup is allowed only when:

- affected dependency is optional;
- runtime manifest declares degraded behavior;
- current deployment does not require the affected capability for its customer flow;
- Health Monitor exposes degraded state;
- logs and telemetry record the degraded reason.

Examples:

| Degraded area | Possible policy |
|---|---|
| Analytics unavailable | Customer purchase flow may continue if domain events remain durable. |
| Notification channel unavailable | Purchase flow may continue only if required legal or payment notifications are not affected. |
| Promotion Runtime unavailable | Core purchase flow may continue without campaigns. |
| AI Runtime unavailable | MVP purchase flow continues without AI features. |

Payment, Ledger, Order, Machine and required Event capabilities should not degrade silently in a commercial purchase deployment.

## 12. Bootstrap Completion

Bootstrap is complete when:

- required Platform Services are registered and ready;
- required runtimes are registered, configured and ready;
- required engines are registered through owning runtimes;
- required event producers and consumers are registered;
- startup health checks pass;
- platform readiness state is published;
- startup telemetry is emitted.

Bootstrap completion does not mean every roadmap Runtime is implemented. It means the configured deployment has met its declared readiness contract.

## 13. Graceful Shutdown Entry

Bootstrap installs shutdown signal handling before readiness.

Shutdown may be triggered by:

- process signal;
- deployment orchestrator stop request;
- administrative stop;
- unrecoverable critical health failure;
- configuration rollback request;
- startup failure after partial initialization.

The shutdown sequence is defined in `docs/kernel/PLATFORM_LIFECYCLE.md`.

## 14. Acceptance Criteria

Platform Bootstrap documentation is acceptable when:

- startup inputs are defined;
- bootstrap context is defined;
- bootstrap sequence is documented;
- runtime registration sequence is documented;
- engine registration sequence is documented;
- configuration loading is referenced and constrained;
- dependency resolution is defined;
- health monitoring during startup is defined;
- startup failure and degraded policies are defined;
- graceful shutdown entry is defined;
- no application code is modified by this documentation increment.
