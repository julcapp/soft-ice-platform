# Durable Sale Flow Runtime v1

Статус: реализован этап Durable Persistence; production readiness ограничена.

## Архитектурная граница

`SaleFlow` хранит только возобновляемое orchestration-состояние: идентификаторы процесса и корреляции, ссылки на Order/Payment/Fulfillment/Inventory/Loyalty/Refund, состояние, optimistic `version`, recovery/error/completion timestamps и безопасные metadata. Профиль клиента, баланс, платёжный ledger, складские остатки, состояние аппарата, CRM и loyalty balance остаются в owning domains и не копируются.

## Гарантии этапа

- production repository — `PrismaSaleFlowRepository`, PostgreSQL; in-memory adapter разрешён только тестам;
- переход выполняется как compare-and-set по `flowId + version`; проигравший callback получает `SALE_FLOW_VERSION_CONFLICT` и перечитывает актуальное состояние;
- `SaleFlowIdempotencyKey` различает `STARTED`, `COMPLETED`, `FAILED`; завершённый callback после restart не исполняется повторно;
- `completedAt` и уникальный `completionOperationId` являются durable completion marker; `COMPLETED` терминален;
- startup recovery классифицирует ожидание оплаты, `PAID` и разрешённую выдачу как `SAFE_TO_RESUME`; `DISPENSING`, ошибку выдачи и требование возврата — как `NEEDS_RECONCILIATION`;
- recovery никогда не запускает физическую выдачу автоматически;
- terminal retention задаётся policy contract; `REFUND_REQUIRED` и `MANUAL_REVIEW_REQUIRED` автоматически не удаляются. Scheduler отсутствует.

## Транзакционная граница

Локальные изменения Sale Flow и idempotency markers могут объединяться транзакцией PostgreSQL. Изменения Order, Payment, Inventory, CRM, Customer 360, Loyalty и Machine Runtime не включаются в эту транзакцию. Поэтому атомарная междоменная доставка и повтор внешнего эффекта после аварии пока не гарантированы.

## Безопасность и наблюдаемость

Runtime не сохраняет credentials, card data, bot/machine/RTSP secrets. Metadata и event payload проходят allow-by-absence sanitization для секретоподобных полей. Health возвращает `HEALTHY`, `DEGRADED` или `UNAVAILABLE` и проверяет чтение и transaction capability. Определены метрики `sale_flow_active`, `sale_flow_recoverable`, `sale_flow_reconciliation_required`, `sale_flow_state_transition_total`, `sale_flow_transition_conflict_total`, `sale_flow_duplicate_request_total`, `sale_flow_repository_error_total`.

## Ограничения

`FOUNDATION_ONLY`: recovery workflow, retention executor, reconciliation engine и междоменная exactly-once доставка. `PLANNED`: Transactional Outbox и Inventory locking. `BLOCKED_EXTERNAL`: реальные Payment/Machine adapters и production callbacks.
