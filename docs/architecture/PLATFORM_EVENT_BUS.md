# Platform Event Bus

Status: Foundation v1 (synchronous, in-memory, non-durable)  
Version: 1.0

The Event Bus transports immutable facts after authoritative domain changes. It never replaces Orders, Payments, Runtime, Inventory, Operations, Gateway, or Digital Twin state.

The envelope requires `eventId`, `eventType`, positive `eventVersion`, `occurredAt`, `recordedAt`, `aggregateType`, `aggregateId`, `actorType`, `actorId`, `sourceChannel`, `correlationId`, `causationId`, `payload`, and `metadata`. Publication deep-freezes events.

V1 delivery is synchronous and in process. Handlers have stable subscriber IDs, deterministic numeric ordering, idempotency key `<subscriberId>:<eventId>`, isolated retries, delivery records, and dead-letter capture. Non-critical failure cannot undo an already committed origin transaction. Critical subscribers are opt-in and must be rare, explicit synchronous policies.

`EventStore`, `Outbox`, and `DeadLetterStore` are replaceable interfaces. Their v1 implementations lose data on restart and are not production durability. PostgreSQL transactional outbox, durable event store, and broker adapters are future work.

Runtime contracts keep the requested compatibility names (`DISPENSE_AUTHORIZED`, `PAYMENT_CONFIRMED_FOR_MACHINE`) while canonical architecture favors completed/past-tense facts. Mapping is explicit in `MachineRuntimeEventMapper`; new contracts should use past-tense facts.
