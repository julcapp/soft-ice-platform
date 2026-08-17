# ADR-040 — Сквозная продажа координируется отдельным application service

Дата: 2026-08-17
Статус: Accepted

## Решение

`SaleFlowService` является application orchestration-слоем. Он использует существующие Order, Payment, Machine Runtime, Inventory Runtime, Customer 360, CRM, Loyalty и Platform Event Bus через контракты и не создаёт параллельные домены. Платёжный и аппаратный симуляторы реализуют заменяемые adapter ports. Физическое завершение продажи и начисление лояльности допустимы только после подтверждённого `DISPENSED`.

V1 хранит только orchestration/recovery state, correlation/causation, domain entity references и idempotency guards в памяти и маркируется `FOUNDATION_ONLY`. Статусы заказа, платёжный ledger, остатки/резервы, профиль клиента, состояние аппарата, организация и баланс лояльности в repository Sale Flow отсутствуют. Production требует durable repository и transactional outbox; внешние интеграции маркируются `BLOCKED_EXTERNAL`.
# Дополнение по итогам ревизии 2026-08-17

Подтверждено решение оставить `sale_flow` orchestration-слоем. Организационный контекст определяется через authoritative machine/location relation, а не из клиентского payload. После оплаченной неуспешной выдачи Sale Flow передаёт Order/Payment contract требование возврата и сохраняет только recovery state `REFUND_REQUIRED`; платёжный факт остаётся у Payment.

Дублировавшая ответственность устранена: прежняя модель Sale Flow самостоятельно изменяла order/payment/inventory/loyalty statuses. Канонический жизненный цикл заказа передан `orderDomain`, платёжный факт — Payment adapter, резерв/списание — Inventory Runtime, начисление и 50-я покупка — Loyalty/Club Account. Regression suite проверяет отсутствие финальных эффектов на `PAID`, единственность complete/consume/loyalty/event и единственность refund request.

Принят минимальный idempotency contract для создания заказа, payment callback/provider transaction, fulfillment token, machine callback и финальных эффектов. Он реализован in-memory и потому остаётся `FOUNDATION_ONLY`. Production-вариант требует durable repository и уникальных ограничений на idempotency/provider transaction keys.

Транзакции Payment, Order, Inventory, Customer 360, CRM, Loyalty и Event Center не являются одной ACID-транзакцией. Риск partial commit принят только для foundation-инкремента. Следующий обязательный архитектурный шаг — transactional outbox и возобновляемый durable workflow без подключения сложного broker в рамках этой ревизии.
