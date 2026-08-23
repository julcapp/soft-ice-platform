# ADR-044 — Payment Lifecycle & Reconciliation v1

Статус: Accepted
Дата: 2026-08-23

## Решение

Payment является самостоятельным authoritative bounded context денежного состояния. `Order` хранит коммерческий заказ, `Sale Flow` — оркестрацию, Inventory — физический резерв/остаток, а Transactional Outbox — доставку интеграционных фактов. Положительный provider-факт меняет `Payment + Order + Sale Flow + Outbox` одной PostgreSQL-транзакцией; резерв при этом не consume: `PAID != DISPENSED`.

Деньги хранятся как `Decimal(18,2)`. Создание Payment читает сумму только из server-side Order. Канонический server-side fingerprint включает Order, Sale Flow, authoritative amount/currency, provider, description и очищенные metadata; повтор того же ключа с иным fingerprint закрывается конфликтом, включая race и restart. Provider amount/currency сверяются перед подтверждением; расхождение закрывает переход.

PostgreSQL связывает Payment с составным ключом `SaleFlow(organizationId, orderId, flowId)`, поэтому Payment не может ссылаться на Order и Sale Flow другого tenant. Отдельный FK к Order сохраняет доменную ссылочную целостность; Organization для legacy Order v1 определяется через owning Sale Flow, поскольку сам Order пока не содержит tenant-колонку. Refund, Inbox, Reconciliation и Audit используют составные tenant-scoped FK к Payment. CHECK constraints запрещают несовместимые Payment/Refund status и temporal fields.

State machine: `CREATED -> PENDING -> AUTHORIZED/SUCCEEDED`, failure/cancel только из допустимых non-terminal состояний, `SUCCEEDED -> REFUND_PENDING -> REFUNDED`. Terminal replay запрещён, одинаковая операция возвращает persistent duplicate result.

Provider callbacks принимаются отдельным `POST /api/v1/webhooks/payments/:provider`, проходят signature verification и provider mapping до persistence. Tenant не берётся из body/header: он выводится из глобально уникальной пары `provider + providerPaymentId`. Durable Inbox дедуплицирует `provider + providerEventId`, очищает payload от sensitive fields и обрабатывается lease/retry worker с восстановлением после restart. Реальная ЮKassa/СБП и signature verification имеют статус `BLOCKED_EXTERNAL`; production adapter fail-closed, test adapter существует только в tests.

`RefundRequested` фиксирует только запрос. Денежный статус становится `REFUNDED` исключительно при обработке связанного durable provider event; внутренняя команда без Inbox evidence отклоняется. Возврат не модифицирует уже выданный физический Inventory.

Reconciliation классифицирует `LOCAL_PENDING_PROVIDER_SUCCEEDED`, `LOCAL_SUCCEEDED_PROVIDER_FAILED`, `AMOUNT_MISMATCH`, `UNKNOWN_PROVIDER_PAYMENT`, `DUPLICATE_PROVIDER_EVENT`, `REFUND_STATE_MISMATCH`. Расхождения не исправляются молча: создаются manual-review record, audit и `PaymentReconciliationRequired` через существующий Transactional Outbox. Persistent fingerprint делает повтор одного snapshot безопасным после restart.

Legacy Payment мигрируется только при явном `metadata.paymentLifecycleMigration.organizationId/orderId`. Mapping проверяется по существующим Order/Sale Flow до первого DDL; несопоставимая строка останавливает migration без изменения таблицы.

Admin Console предоставляет только русскоязычное read-oriented представление и фильтры. Финансовых command-кнопок нет.

## Границы готовности

- Payment Domain, Inbox, Refund, Reconciliation contract: `IMPLEMENTED`.
- Real provider integration, production payment/refund operations, webhook signature verification: `BLOCKED_EXTERNAL`.
- Delivery semantics Transactional Outbox: `AT_LEAST_ONCE`; consumers дедуплицируют `eventId`/`idempotencyKey`.
