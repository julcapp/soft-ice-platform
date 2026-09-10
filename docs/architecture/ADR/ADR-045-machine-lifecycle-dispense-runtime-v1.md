# ADR-045 — Machine Lifecycle / Dispense Runtime v1

Дата: 2026-08-23
Статус: Accepted

## Решение

Machine/Dispense Runtime является единственным владельцем lifecycle команды физической выдачи, acknowledgement, callback, результата и reconciliation. Payment доказывает только денежный факт, Inventory владеет резервом и остатком, Sale Flow оркестрирует ссылки/состояние, Order владеет заказом. `ACCEPTED != DISPENSED`.

Создание `MachineDispenseAttempt`, перевод Sale Flow и постановка команды в существующий Transactional Outbox выполняются атомарно. Доставка — `AT_LEAST_ONCE`; устойчивый `commandId` является idempotency key поставщика. Подтверждённый `DISPENSED` одной PostgreSQL-транзакцией фиксирует attempt, consume Inventory, Order/Sale Flow completion и Outbox. Timeout не считается failure и запрещает автоматическую повторную выдачу. Поздний достоверный callback проходит через reconciliation того же attempt.

Durable callback Inbox дедуплицирует `provider + providerEventId`; payload рекурсивно очищается от credentials. Tenant выводится из сопоставленной команды, а не из callback body. Существующий Transactional Outbox обслуживает machine intent отдельным фильтрованным worker; второй durable recovery worker имеет собственный lease и не отправляет physical command. `DISPATCHING` после crash всегда означает reconciliation, а не resend. Admin Console предоставляет русскоязычное чтение, audit trail и только безопасную команду классификации; команды «повторить выдачу» нет.

## Границы

- Huaxin production API/protocol, реальный hardware adapter, callback signature/shared-secret/certificate/mTLS verification и аппаратные подтверждения: `BLOCKED_EXTERNAL`.
- Component-level physical evidence, hardware certification и edge-agent/NVR integration: `BLOCKED_EXTERNAL` до реального оборудования/протокола; внутренний lifecycle, command delivery и recovery реализованы.
