# ADR-042 — Transactional Outbox v1

**Date:** 2026-08-20
**Status:** Accepted

## Decision

Durable Sale Flow фиксирует переход orchestration state и совместимый domain-event envelope в `TransactionalOutboxEvent` внутри одной Prisma/PostgreSQL транзакции. Успешный commit означает, что событие durable и остаётся в PostgreSQL до `PUBLISHED`; ошибка вставки события откатывает переход состояния.

События имеют уникальные `eventId` и логический `idempotencyKey`. Tenant-owned запись всегда содержит `organizationId`. Platform worker выбирает доступные `PENDING`/`RETRY` записи через `FOR UPDATE SKIP LOCKED`, устанавливает lease (`PROCESSING`, `lockedAt`, `lockedBy`) и не выбирает `PUBLISHED` повторно.

Retry использует exponential backoff: 1 s base, максимум 5 min, 5 попыток по умолчанию. Исчерпание попыток переводит событие в сохраняемый `DEAD_LETTER`. Lease длится 60 s по умолчанию; просроченный `PROCESSING` возвращается в `RETRY`. Явный административный retry разрешён `ADMIN`/`PLATFORM_OWNER` в допустимом tenant scope и создаёт `AuditEvent`; payload из UI не редактируется.

## Delivery semantics and consumer contract

`DELIVERY SEMANTICS = AT_LEAST_ONCE`. После успешного вызова publisher процесс может завершиться до `markPublished()`. Тогда событие остаётся `PROCESSING`, после истечения lease снова становится доступным и может быть опубликовано повторно с тем же `eventId`.

Каждый consumer обязан дедуплицировать обработку минимум по `eventId`, а для бизнес-операций, где применимо, также по `idempotencyKey`. Transactional Outbox обеспечивает atomic state + event persistence и at-least-once event delivery. Exactly-once business effect обеспечивается idempotent consumer, а не Outbox publisher. Exactly-once delivery не заявляется.

## Consequences

Sale Flow больше не выполняет опасную последовательность `DB COMMIT -> publish`. Publisher является adapter port; deterministic in-memory adapter используется тестами. Реальный transport, broker и внешние Telegram/MAX/VK, Payment и Machine adapters остаются `FOUNDATION_ONLY` / `BLOCKED_EXTERNAL`. Повторная доставка после crash window является ожидаемым поведением at-least-once.
