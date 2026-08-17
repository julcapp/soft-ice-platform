# Сквозной сценарий продажи Soft ICE v1

Статус: `FOUNDATION_ONLY`
Дата: 2026-08-17

## Назначение и архитектурная карта

`SaleFlowService` координирует существующие домены, но не забирает их данные и правила:

1. Customer Identity предоставляет канонический `customerId`.
2. Organization 360 предоставляет организацию и торговую точку.
3. Machine Runtime и адаптер автомата отвечают за доступность и физическое выполнение.
4. Inventory Runtime проверяет остатки, резервирует, списывает или освобождает компоненты.
5. Product/Recipe/Pricing предоставляют состав и цену; orchestration не хранит ассортимент.
6. Order остаётся владельцем заказа; Sale Flow хранит только ссылку `orderId` и состояние выполнения процесса.
7. Payment Adapter изолирует платёжного провайдера. В v1 активен только детерминированный симулятор.
8. Platform Event Bus публикует факты, Event Center строит их проекцию.
9. Customer 360 и CRM получают завершённую продажу после `DISPENSED`.
10. Существующая программа лояльности начисляет бонусы только после успешной выдачи.

Gift Transfer использует своё существующее право получения и не заменяется новым redemption-доменом. Operator Workspace и Digital Twin остаются наблюдателями/операционными фасадами.

## Последовательность

Клиент → проверка аппарата и состава → резерв Inventory → расчёт цены → заказ → симулятор оплаты → одноразовое разрешение → Machine Runtime/симулятор → подтверждение `DISPENSED` → списание Inventory → событие продажи → Customer 360/CRM → лояльность → завершение.

## Source of Truth

| Данные/операция | Source of Truth | Роль Sale Flow |
|---|---|---|
| Заказ | Order | Создаёт и переводит заказ через domain contract; хранит только `orderId` |
| Клиент | Customer Identity / Customer 360 | Получает `customerId`, после завершения передаёт ссылку на заказ |
| Платёж | Payment | Запрашивает операцию и хранит только `paymentId` для correlation/recovery |
| Аппарат | Machine Runtime / Machine Gateway | Отправляет команду и обрабатывает подтверждённый результат |
| Остатки | Inventory Runtime | Запрашивает доступность; не хранит баланс |
| Резерв | Inventory Runtime | Создаёт/release через контракт; хранит только `reservationId` |
| Списание | Inventory Runtime | Идемпотентно вызывает consume после `DISPENSED` |
| Бонусы | Club Account / Loyalty | Передаёт завершённую покупку; баланс и правила не вычисляет |
| 50-я покупка | Club Account / Loyalty | Не считает покупки; результат определяет владелец программы |
| Организация | Organization 360 | Получает authoritative `organizationId` по аппарату |
| Точка установки | Organization 360 | Получает authoritative `locationId` по аппарату |
| Подарок | Gift Transfer | Использует принадлежащие домену права/статусы, не копирует их |
| Реферал | Gift Transfer / Referral | Не вычисляет и не хранит реферальные правила или награды |
| События | Platform Event Bus / Event Center | Публикует факты с correlation/causation, не ведёт Event Store |
| Возврат | Payment / Order | Передаёт идемпотентное требование возврата и хранит recovery state `REFUND_REQUIRED` |

Внутри Sale Flow допустимы только `flowState`, `correlationId`, `causationId`/`lastEventId`, idempotency markers, ссылки на domain entities и execution/recovery metadata. `InMemorySaleFlowRepository` и симуляторы явно являются `FOUNDATION_ONLY`/test adapters и не считаются production source of truth.

## State machine

Основной orchestration-путь: `STARTED → WAITING_FOR_PAYMENT → PAYMENT_CONFIRMED → FULFILLMENT_AUTHORIZED → DISPENSING → COMPLETED`.

Терминальные отрицательные состояния: `PAYMENT_FAILED`, `CANCELLED`, `FULFILLMENT_FAILED`, `EXPIRED`. Прямые переходы, например `CREATED → COMPLETED`, запрещены. `PAID` не означает `DISPENSED`.

При `PAID + FULFILLMENT_FAILED` выставляется `refundStatus=REQUIRED` и публикуется `REFUND_REQUIRED`. Это требование возврата, а не утверждение о реальном возврате денег.

## События

Публикуются `ORDER_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_FAILED`, `FULFILLMENT_AUTHORIZED`, `DISPENSE_STARTED`, `DISPENSE_SUCCEEDED`, `DISPENSE_FAILED`, `INVENTORY_CONSUMED`, `SALE_COMPLETED`, `LOYALTY_UPDATED`, `REFUND_REQUIRED`. Envelope содержит `eventId` (назначает шина), `eventType`, время, `correlationId`, `orderId`, источник и ссылки на клиента, аппарат и организацию.

## Идемпотентность и границы транзакций

- callback оплаты дедуплицируется по обязательному idempotency key;
- разрешение связано с одним заказом и аппаратом, имеет TTL и используется один раз;
- событие результата аппарата дедуплицируется по idempotency key/event ID;
- списание, Customer 360, CRM и лояльность выполняются по ключу заказа ровно один раз;
- резерв создаётся до оплаты, потребляется только после `DISPENSED`, при неуспехе освобождается.

В `in-memory` реализации операции не образуют распределённую ACID-транзакцию. Производственная версия требует устойчивых idempotency-записей, транзакционной записи состояния с outbox и повторяемых подписчиков.

## Failure/recovery

`DECLINED`, `TIMEOUT`, `CANCELLED` не дают разрешение на выдачу. Offline/недоступный аппарат и недостаточные остатки останавливают сценарий до оплаты. `FAILED`/`TIMEOUT` автомата не списывают остатки, не завершают продажу и не начисляют бонусы. `ACCEPTED`/`DISPENSING` являются промежуточными состояниями. Повторные callback, machine event и token use безопасно отклоняются или дедуплицируются.

## Ограничения

### FOUNDATION_ONLY

Репозиторий сценария, ключи идемпотентности и адаптеры симуляторов находятся в памяти процесса. После рестарта восстановление незавершённой операции не гарантировано. Admin Console может строить представление orchestration state из `listFlows()` и событий, но production API и постоянная проекция ещё не подключены.

### BLOCKED_EXTERNAL

Реальные ЮKassa/СБП, физический аппарат, Telegram/MAX/VK, промышленный broker и автоматический возврат не подключены. Для production readiness нужны Prisma-модели и миграция сквозного состояния, транзакционный outbox, блокировки резерва, аутентифицированные callbacks и сертифицированные production adapters.
# Результаты технической ревизии 2026-08-17

`sale_flow` является только orchestration-слоем. Он не хранит собственные остатки, баланс клиента, CRM-профиль, платёжный ledger, состояние аппарата или правила лояльности.

## Источники истины и взаимодействия

| Данные/операция | Source of truth | Действие sale_flow |
|---|---|---|
| Заказ и его state machine | Order domain | Координирует переходы через контракт заказа; не хранит order status |
| Подтверждение оплаты и provider transaction | Payment foundation | Отправляет команду оплаты, читает подтверждённый факт |
| Состояние и физическая выдача | Machine Runtime / Machine Gateway / Simulator | Отправляет команду выдачи, потребляет статусы |
| Остатки, резерв, consume/release | Inventory Runtime | Проверяет доступность, резервирует, списывает или освобождает |
| Баланс и правила бонусов | Loyalty / Club Account | После `SALE_COMPLETED` отправляет идемпотентную команду покупки |
| История клиента | Customer 360 | После завершения отправляет факт покупки |
| CRM-факт продажи | CRM Soft ICE | После завершения отправляет факт продажи |
| Организация, точка и связь аппарата | Organization 360 | Читает authoritative relation по `machineId`; не доверяет клиентским значениям |
| События | Platform Event Bus / Event Center | Публикует единый envelope с `eventId`, `correlationId`, `causationId` |

Потребляемые факты: результат оплаты, доступность/статусы аппарата, доступность и результат складских операций, authoritative organizational context. Публикуемые факты: `ORDER_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_FAILED`, `FULFILLMENT_AUTHORIZED`, `DISPENSE_STARTED`, `DISPENSE_SUCCEEDED`, `DISPENSE_FAILED`, `INVENTORY_CONSUMED`, `SALE_COMPLETED`, `LOYALTY_UPDATED`, `REFUND_REQUIRED`.

## State machine и инварианты

Happy path: `CREATED → AWAITING_PAYMENT → PAID → FULFILLMENT_AUTHORIZED → DISPENSING → COMPLETED`. Терминальные/отрицательные состояния: `PAYMENT_FAILED`, `CANCELLED`, `EXPIRED`, `FULFILLMENT_FAILED`, `REFUND_REQUIRED`. После подтверждённой оплаты не выполняются финальное складское списание, лояльность, Customer 360, CRM и `SALE_COMPLETED`: эти эффекты разрешены только после `DISPENSE_SUCCEEDED`.

Создание, payment callback, provider transaction, fulfillment token, machine callback, inventory consume/release, Customer 360, CRM и Loyalty имеют отдельные idempotency markers. Текущий repository остаётся in-memory, поэтому защита подтверждена тестами только в пределах процесса.

## Транзакционные границы и восстановление

Каждый внешний домен имеет собственную транзакционную границу. Между `DISPENSE_SUCCEEDED`, Inventory consume, `COMPLETED`, Customer 360, CRM, `SALE_COMPLETED` и Loyalty возможен partial commit. Повторная обработка безопасна в пределах процесса, но durable workflow и атомарная публикация отсутствуют. Для production обязательны persistent state/idempotency records и transactional outbox.

При неуспехе выдачи после оплаты Sale Flow вызывает Order/Payment contract для фиксации требования возврата, сохраняет ссылку на исходный payment fact и освобождает складской резерв. Повторное machine event не создаёт второй refund request. Реальный production refund не реализован.

## Статус готовности

- `FOUNDATION_ONLY`: in-memory sale-flow state, idempotency keys, fulfillment authorization, payment linkage, reservation linkage, completion/refund markers; synchronous event publication; simulator adapters.
- `BLOCKED_EXTERNAL`: production payment/machine adapters; подпись, source authentication, timestamp/nonce и replay protection callbacks; реальный refund; проверка на физическом аппарате.
- Production readiness требует PostgreSQL repository, блокировок/уникальных ограничений, durable workflow, transactional outbox, защищённых callbacks, reconciliation и испытаний с утверждёнными провайдерами.
