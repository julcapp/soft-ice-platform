# ADR-022: Platform Event Bus Foundation

Status: Accepted  
Date: 2026-07-23

Adopt immutable versioned envelopes and synchronous in-process v1 delivery through replaceable EventStore, Outbox, and DeadLetterStore interfaces. Deterministic subscriber ordering, per-subscriber idempotency, retry, isolation, and dead-letter records are mandatory. In-memory adapters do not claim production durability.
