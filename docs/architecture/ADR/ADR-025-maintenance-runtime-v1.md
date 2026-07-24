# ADR-025: Maintenance Runtime Owns Service Lifecycle

Date: 2026-07-24  
Status: Accepted

Maintenance Runtime is the authoritative bounded context for preventive/corrective plans, service-session lifecycle, evidence requirements, approval decisions, immutable maintenance history and maintenance KPIs. Machine Operations continues to own operator identity and generic human-operation permissions. Machine Runtime owns exclusive machine execution state; Inventory Runtime owns stock; Digital Twin and Admin Console are read-only projections.

Maintenance commands are actor-scoped and idempotent. Cross-boundary effects use stable contracts and Platform Event Bus facts. The v1 repository is in-memory while Prisma defines the durable target; this is visible as foundation data and is not a production-persistence claim.
