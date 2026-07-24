# Machine Digital Twin Core v1

Status: Implemented foundation  
Version: 1.0  
Date: 2026-07-23

## Purpose

Machine Digital Twin is a separate read-oriented bounded context at
`backend/src/modules/machine_digital_twin`. It composes trusted facts into an
explainable machine projection for administration and diagnostics.

It is not a command system and owns no payment, inventory, identity, telemetry,
operator-action, order, catalog, price, or advertising fact.

## Domain model

`MachineTwin` contains machine identity, operational/connectivity state,
freshness, menu/price/advertising projections, operator and service summaries,
faults, sales, inventory, maintenance, tests, prediction boundary, components,
and per-source availability.

Supporting immutable value types are `MachineTwinState`,
`MachineTwinComponent`, `MachineTwinSnapshot`, `MachineTwinEvent`,
`ComponentHealth`, `ComponentLifecycle`, and `TwinDataFreshness`.

Supported machine statuses are `ONLINE`, `OFFLINE`, `DEGRADED`, `MAINTENANCE`,
`TEST_MODE`, `ERROR`, and `UNKNOWN`. Component statuses are `HEALTHY`,
`WARNING`, `CRITICAL`, `OFFLINE`, `MAINTENANCE`, and `UNKNOWN`. Freshness is
`LIVE`, `FRESH`, `STALE`, `EXPIRED`, `UNAVAILABLE`, or `DEMO`.

## Source boundaries

- Machine Domain owns machine identity.
- Machine Gateway or normalized telemetry storage owns telemetry.
- Machine Operations owns operator actions and maintenance/test facts.
- Inventory and Machine Operations own inventory.
- Orders owns order lifecycle; Payment Platform owns payment facts and prices
  used for settlement.
- Product Catalog owns menus.
- Advertising owns placement facts.
- Digital Twin stores projections, snapshots, and normalized projection events
  only and never writes to the sources above.

An absent adapter is represented as `FOUNDATION_ONLY`; blocked integration is
`BLOCKED_EXTERNAL`. Live data is never fabricated.

## Health

`ComponentHealthService` uses only explicit signals. Critical faults subtract
60, warning faults 20, stale telemetry 15, offline state 40, overdue
maintenance 15, and a recent failed test 25. Scores are clamped to 0–100 and
return every contributing factor.

## Prediction

The v1 prediction contract contains status, refill/service dates, failure risk,
confidence, explanation, and model version. A refill time may be exposed only
when supplied by explicit inventory/consumption facts. Failure prediction stays
`FOUNDATION_ONLY`; recommendations are advisory.

## Demo mode

The Machine Simulator adapter returns `dataMode: DEMO`, `generatedAt`, and the
source label `Machine Simulator`. The Admin Console displays a visible marker.
Development admin headers are rejected by the existing authenticator in
production.
# Runtime event projection addendum

Digital Twin subscribes idempotently to normalized Runtime events and may update only `operationalStatus`, `currentRuntimeState`, `currentSession`, `recentEvents`, `lastUpdatedAt`, `freshness`, and `activeFaults`. It cannot initiate Runtime transitions.
# Проекция мобильной связи, 2026-07-24

Цифровой двойник отображает read-only проекцию «Связь и SIM-карта» из Machine Domain; он не изменяет операторские или ручные данные.
# Интеграция видеонаблюдения

Цифровой двойник показывает read-only проекцию камеры и ведёт на вкладку «Камера и видеонаблюдение». Владельцем камер, записей, health snapshots, retention и инцидентов остаётся домен Video Surveillance.
