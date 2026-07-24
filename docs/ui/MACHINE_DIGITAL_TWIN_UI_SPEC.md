# Machine Digital Twin Admin Console UI Specification

Status: Implemented v1

Navigation is `Machines → Fleet` and `Machines → Digital Twins`.

The Digital Twins list uses `MachineTwinCard`, `TwinStatusBadge`, and
`FreshnessIndicator`. Detail provides Overview, Components, Events, Snapshots,
and Health sections using `ComponentHealthCard`, `TwinSummaryPanel`,
`FaultTimeline`, `ComponentList`, `SnapshotHistory`, `SourceStatusPanel`, and
`PredictionSummaryCard`.

`MachineTwinDiagram` is a data-driven vendor-neutral schematic. It does not
claim to represent Huaxin hardware geometry. A verified vendor/XML layout can
replace its map without changing the page contract.

The detail shows identity, location, heartbeat, operational/freshness state,
inventory, sales, operator, service tasks, faults, tests, menu, price,
advertising, sources, component health, events, and prediction. There are no
mutation controls.

Loading, empty, stale, unavailable, denied, and demo states are explicit.
Demo data always has a visible Machine Simulator marker.
