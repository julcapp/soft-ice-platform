# Platform Lifecycle

Status: Draft
Version: 0.1
Date: 2026-07-03
Project: Soft ICE Platform / Utimoshi
Scope: Documentation only

## Purpose

This document defines lifecycle states, transitions, health monitoring and graceful shutdown rules for Platform Kernel, runtimes, engines, services and integrations.

Lifecycle coordination belongs to the Platform Kernel. Business state transitions belong to runtimes.

Core rule:

```text
Platform Lifecycle controls operational state.
Runtime lifecycle controls runtime availability.
Engine lifecycle controls implementation readiness.
Business lifecycle stays inside domain runtimes.
```

## 1. Lifecycle Scope

Lifecycle applies to:

- Platform Kernel;
- Platform Services;
- Runtime Registry;
- Service Registry;
- Runtimes;
- Engines;
- repositories;
- adapters;
- event consumers;
- scheduled jobs;
- health checks.

Lifecycle does not replace domain lifecycles such as Order state, Payment state, Refund state, Bonus state, Product status or Machine operation state.

## 2. Platform Lifecycle States

Platform states:

| State | Meaning | Accepts new work |
|---|---|---|
| `created` | Process started but bootstrap context is not ready. | No |
| `bootstrapping` | Platform Bootstrap is loading configuration and registries. | No |
| `starting` | Required Platform Services and runtimes are starting. | No |
| `ready` | Required platform, services, runtimes and engines are ready. | Yes |
| `degraded` | Platform is partially available with declared non-critical capability loss. | Limited |
| `unavailable` | Required capability is not available. | No for affected flows |
| `stopping` | Graceful shutdown has started. | No new work |
| `stopped` | Platform stopped cleanly. | No |
| `failed` | Platform failed startup, operation or shutdown safety policy. | No |

Allowed high-level transitions:

```text
created -> bootstrapping -> starting -> ready
created -> bootstrapping -> failed
starting -> degraded
starting -> failed
ready -> degraded
ready -> unavailable
ready -> stopping -> stopped
degraded -> ready
degraded -> stopping -> stopped
unavailable -> stopping -> stopped
stopping -> stopped
stopping -> failed
```

## 3. Runtime Lifecycle States

Runtime states:

| State | Meaning |
|---|---|
| `discovered` | Runtime manifest was found but not validated. |
| `registered` | Runtime manifest was accepted by Runtime Registry. |
| `configured` | Runtime configuration schema and required settings passed validation. |
| `initialized` | Runtime constructed internal services and prepared engines. |
| `starting` | Runtime startup hook is executing. |
| `ready` | Runtime can perform its declared work. |
| `degraded` | Runtime can perform reduced work with declared fallback. |
| `unavailable` | Runtime cannot perform required work. |
| `draining` | Runtime has stopped accepting new work and is draining accepted work. |
| `stopping` | Runtime shutdown hook is executing. |
| `stopped` | Runtime stopped cleanly. |
| `failed` | Runtime failed startup, operation or shutdown policy. |

Runtime state is operational. It must not be confused with business state.

Example:

```text
Order Runtime can be ready while a specific Order is PaymentPending.
Payment Runtime can be degraded while a provider adapter is unavailable.
```

## 4. Engine Lifecycle States

Engine states:

| State | Meaning |
|---|---|
| `registered` | Engine metadata was registered by owning Runtime. |
| `configured` | Engine configuration passed schema validation. |
| `initialized` | Engine dependencies were injected by owning Runtime. |
| `ready` | Engine facade can serve approved calls. |
| `degraded` | Engine can serve reduced behavior declared by Runtime. |
| `unavailable` | Engine cannot serve required behavior. |
| `stopping` | Engine is releasing resources or draining work. |
| `stopped` | Engine stopped cleanly. |
| `failed` | Engine failed initialization, health or shutdown policy. |

Engine lifecycle is controlled by the owning Runtime. Platform Kernel observes Engine health through registration and health hooks.

## 5. Service And Adapter Lifecycle

Platform and runtime services follow the same operational shape:

```text
registered -> configured -> initialized -> ready -> stopping -> stopped
```

Adapter lifecycle must include integration health:

| Adapter state | Meaning |
|---|---|
| `configured` | Adapter configuration and secret references are valid. |
| `connected` | Adapter can reach provider, device or channel when required. |
| `ready` | Adapter can accept work. |
| `degraded` | Adapter can serve limited behavior or fallback. |
| `unavailable` | Adapter cannot serve required behavior. |
| `draining` | Adapter is finishing accepted calls and refusing new calls. |
| `stopped` | Adapter released connections. |

Adapters include payment providers, vending machine devices, notification channels, accounting systems and analytics destinations.

## 6. Runtime Lifecycle Hooks

Runtime hooks:

| Hook | Purpose |
|---|---|
| `register` | Provide manifest, services, engines, events, configuration schema and health checks. |
| `configure` | Validate and accept scoped runtime configuration. |
| `initialize` | Create Runtime-owned services, repositories, adapters and engines. |
| `start` | Begin runtime operation after dependencies are ready. |
| `readiness_check` | Confirm runtime can accept intended work. |
| `health_check` | Report runtime, engine, service and adapter health repeatedly. |
| `drain` | Stop accepting new work and finish accepted work. |
| `stop` | Release resources and stop event consumers, jobs and adapters. |
| `dispose` | Final cleanup after stop. |

Hooks must be idempotent where practical. Repeated health checks must be safe.

## 7. Startup Lifecycle

Startup is coordinated by Platform Bootstrap.

Startup lifecycle:

1. Platform enters `bootstrapping`.
2. Configuration snapshot is loaded and validated.
3. Platform Services enter `registered`, `configured`, `initialized` and `ready`.
4. Runtimes enter `discovered`.
5. Runtime Registry accepts runtimes as `registered`.
6. Runtime configuration moves runtimes to `configured`.
7. Service Registry accepts runtime services and engines.
8. Runtime dependencies are resolved.
9. Runtimes enter `initialized`.
10. Runtimes enter `starting` in dependency order.
11. Engines enter `ready` through owning runtimes.
12. Runtime readiness checks move runtimes to `ready` or `degraded`.
13. Platform health aggregation moves platform to `ready` or `degraded`.

Startup failure at any critical step must keep platform readiness false.

## 8. Runtime Dependency Lifecycle

Dependency lifecycle rules:

- required dependencies must be `ready` before dependent Runtime is marked `ready`;
- optional dependencies may be `degraded` or `unavailable` only with declared fallback behavior;
- dependency loss after readiness must update dependent Runtime health;
- circular required dependencies are invalid;
- dependency state changes must be observable;
- Kernel coordinates dependency state but does not decide domain compensation.

Example:

```text
Machine Runtime depends on Order and Recipe facts for dispatch.
Machine Runtime must not start physical preparation if Payment and Order contracts do not confirm eligibility.
The business eligibility decision is owned by Order and Payment runtimes, not Kernel.
```

## 9. Health Monitoring

Health Monitor aggregates:

- platform health;
- platform service health;
- runtime health;
- engine health;
- repository health;
- adapter health;
- event delivery health;
- configuration health;
- scheduled job health.

Health states:

| State | Meaning |
|---|---|
| `starting` | Component is starting or waiting for dependencies. |
| `ready` | Component is healthy and can serve intended work. |
| `degraded` | Component can serve reduced work or fallback. |
| `unavailable` | Component cannot serve required work. |
| `stopping` | Component is shutting down. |
| `stopped` | Component stopped. |
| `failed` | Component failed policy. |

Health check types:

| Type | Purpose |
|---|---|
| Liveness | Confirms process or component is not deadlocked. |
| Readiness | Confirms component can accept intended work. |
| Dependency | Confirms required dependencies are available. |
| Integration | Confirms provider, channel or device adapter health. |
| Data consistency | Confirms repository or projection state is usable. |
| Event delivery | Confirms event handlers, retries and dead-letter state. |

Health checks must not create orders, collect payments, mutate wallet, send machine commands or send customer notifications.

## 10. Health Escalation

Health escalation policy:

| Condition | Runtime state | Platform state |
|---|---|---|
| Optional adapter unavailable with fallback | `degraded` | `ready` or `degraded` depending on flow. |
| Required runtime dependency unavailable | `unavailable` | `degraded` or `unavailable`. |
| Critical runtime unavailable in MVP flow | `unavailable` | `unavailable`. |
| Event delivery dead-letter exceeds threshold | `degraded` or `unavailable` | `degraded` or `unavailable` based on event criticality. |
| Payment provider ambiguous during active settlement | `degraded` or `unavailable` | `degraded` for payment flow; manual review required by Payment Runtime. |
| Machine adapter unavailable | `unavailable` | `unavailable` for fulfillment flow. |
| Analytics unavailable | `degraded` | Platform may remain `ready` for purchase flow. |
| AI unavailable | `degraded` | Platform may remain `ready` for MVP purchase flow. |

Health escalation must be visible through logs, telemetry and operational dashboards when implemented.

## 11. Graceful Shutdown Goals

Graceful shutdown must:

- stop accepting new work;
- preserve accepted business events;
- drain in-flight event handlers and jobs within timeout;
- stop runtimes in reverse dependency order;
- stop event consumers safely;
- avoid duplicate side effects;
- flush audit logs, telemetry and logs;
- release external connections;
- mark final platform state.

Graceful shutdown must not:

- silently drop accepted payment, order, ledger or machine facts;
- create compensating business decisions inside Kernel;
- hide forced stop or timeout failures;
- execute new customer-facing business actions after `stopping` begins unless a Runtime declares a safe drain step.

## 12. Graceful Shutdown Sequence

The expected shutdown sequence is:

| Step | Action |
|---:|---|
| 1 | Receive shutdown trigger. |
| 2 | Mark Platform state `stopping`. |
| 3 | Publish operational shutdown notice to Runtime Registry and Service Registry. |
| 4 | Stop accepting new external work. |
| 5 | Ask runtimes to enter `draining` where supported. |
| 6 | Stop scheduled jobs from starting new work. |
| 7 | Pause or drain event consumers within configured timeout. |
| 8 | Let critical accepted work reach safe checkpoint according to Runtime policy. |
| 9 | Stop runtimes in reverse dependency order. |
| 10 | Stop runtime-owned engines, repositories and adapters. |
| 11 | Flush event outbox, audit logs, telemetry and logs where possible. |
| 12 | Release external connections and device/provider sessions. |
| 13 | Mark runtimes `stopped` or `failed`. |
| 14 | Mark Platform `stopped` or `failed`. |

Shutdown timeout policy must be explicit per Runtime.

## 13. Runtime Drain Rules

Drain behavior is runtime-specific.

Examples:

| Runtime | Drain rule |
|---|---|
| Event Runtime | Stop taking new events if configured, finish or checkpoint accepted deliveries, preserve retry state. |
| Order Runtime | Stop accepting new checkout commands, preserve accepted Order transitions and audit facts. |
| Payment Runtime | Do not start new provider settlements; reconcile accepted provider calls according to Payment policy. |
| Ledger Runtime | Finish accepted append operations or mark recovery requirement. |
| Machine Runtime | Do not accept new dispatch; reconcile in-flight machine operation with device state. |
| Notification Runtime | Stop new notification jobs; finish or checkpoint accepted delivery attempts. |
| Analytics Runtime | Flush buffered telemetry when possible; analytics loss must not corrupt domain truth. |

Kernel coordinates drain timing. Runtime owns business-safe checkpoint rules.

## 14. Forced Stop Policy

Forced stop may occur when:

- shutdown timeout expires;
- process manager terminates the process;
- critical safety condition requires immediate stop;
- startup failed after partial initialization and a Runtime cannot stop cleanly.

Forced stop rules:

- final state must be `failed` when cleanup is incomplete;
- logs and telemetry should record timeout and affected runtimes;
- restart recovery must inspect runtime-owned durable state;
- forced stop must not mark accepted business work as completed;
- support or manual review may be required for payment, ledger, order or machine ambiguity.

## 15. Recovery After Failure

Recovery is Runtime-owned and Kernel-coordinated.

Recovery sources:

- configuration snapshot version;
- Runtime Registry state;
- Service Registry state;
- durable runtime storage;
- event outbox or event store;
- ledger entries;
- payment provider reconciliation;
- machine telemetry;
- audit log.

Rules:

- Kernel may restart runtimes in dependency order;
- Runtime must validate durable state before resuming work;
- duplicate side effects must be prevented through idempotency;
- ambiguous payment, order and machine states require explicit reconciliation;
- recovery actions must be auditable.

## 16. Lifecycle Dependency Rules

Lifecycle dependency rules:

- Platform Services start before runtimes;
- Runtime Registry and Service Registry start before runtime registration;
- Configuration Service starts before runtime configuration validation;
- Event Runtime starts before event-dependent runtimes are marked ready;
- runtimes stop in reverse dependency order;
- engines stop through owning runtimes;
- adapters stop before their owning runtime is disposed;
- UI and channels must respect Runtime readiness before invoking work;
- Kernel must not infer business readiness from process liveness alone.

## 17. Acceptance Criteria

Platform Lifecycle documentation is acceptable when:

- Platform lifecycle states are defined;
- Runtime lifecycle states are defined;
- Engine lifecycle states are defined;
- service and adapter lifecycle is defined;
- lifecycle hooks are documented;
- startup lifecycle is documented;
- dependency lifecycle rules are documented;
- health monitoring and escalation are documented;
- graceful shutdown sequence is documented;
- forced stop and recovery rules are documented;
- no application code is modified by this documentation increment.
