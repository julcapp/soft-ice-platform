# ADR-041 — Durable PostgreSQL persistence для Sale Flow v1

Дата: 2026-08-20

Статус: Accepted

## Решение

Sale Flow остаётся orchestration layer и сохраняет в PostgreSQL только возобновляемое состояние и ссылки на owning domains. `PrismaSaleFlowRepository` является production adapter; `InMemorySaleFlowRepository` — test-only. Конкурентные переходы защищены optimistic `version`, callback-дедупликация — локальными durable markers. Recovery после старта только классифицирует процессы и не повторяет выдачу.

## Последствия

Перезапуск backend больше не уничтожает Sale Flow и markers. Локальная транзакция не распространяется на Inventory, CRM, Loyalty, Payment, Order или Machine Runtime. До отдельного Transactional Outbox этапа атомарная междоменная доставка остаётся `FOUNDATION_ONLY`; реальные adapters и reconciliation не входят в решение.
