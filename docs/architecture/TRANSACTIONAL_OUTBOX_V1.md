# Transactional Outbox v1

## Transaction boundary

Каждый поддержанный переход Sale Flow выполняет `BEGIN -> compare-and-set SaleFlow -> insert TransactionalOutboxEvent -> COMMIT`. Для создания процесса атомарная граница также включает persistent idempotency marker. Ошибка любой SQL-операции откатывает обе записи.

Поддержанные факты соответствуют существующей state machine: `SALE_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_FAILED`, `FULFILLMENT_AUTHORIZED`, `DISPENSE_STARTED`, `REFUND_REQUIRED`, `SALE_COMPLETED`. Несуществующие переходы не синтезируются.

## Envelope and safety

Envelope содержит `eventId`, `eventType`, `eventVersion`, `occurredAt`, aggregate, `organizationId`, correlation/causation и payload. Рекурсивная валидация запрещает известные secret/credential/token/payment-card/RTSP/SIM поля. Полный payload worker не логирует.

Проверка проходит objects и arrays на произвольной разумной глубине, сравнивает запрещённые имена case-insensitive и учитывает camelCase/snake_case. Ошибка содержит только путь к запрещённому полю и не содержит его значение.

## Lifecycle and concurrency

`PENDING -> PROCESSING -> PUBLISHED`; временная ошибка даёт `RETRY`, последняя попытка — `DEAD_LETTER`. Claim использует PostgreSQL `FOR UPDATE SKIP LOCKED`. Lease по умолчанию 60 секунд. Retry policy: exponential 1 s, 2 s, 4 s и далее с cap 5 min; `maxAttempts=5`.

`DELIVERY SEMANTICS = AT_LEAST_ONCE`. Если publisher успешно отправил событие, но процесс завершился до `markPublished()`, запись остаётся `PROCESSING`. После истечения lease она снова claimable и может быть опубликована повторно; `eventId` при этом сохраняется.

Каждый consumer обязан поддерживать дедупликацию минимум по `eventId`, а для применимых бизнес-операций — также по `idempotencyKey`. Transactional Outbox обеспечивает atomic state + event persistence и at-least-once event delivery. Exactly-once business effect обеспечивает idempotent consumer, а не Outbox publisher; exactly-once delivery не заявляется.

## Isolation and administration

Tenant API требует `organizationId`; только `PLATFORM_OWNER` имеет system scope. Admin Console показывает статусы, тип, aggregate, организацию, автомат, попытки, timestamps и последнюю ошибку. Payload не редактируется. Retry `DEAD_LETTER` явный и аудируется.

## Readiness boundary

- `FOUNDATION_ONLY`: publisher port/worker hosting, production scheduling, distributed consumer idempotency, broker transport.
- `BLOCKED_EXTERNAL`: Telegram, MAX, VK, Payment provider, Machine Runtime callbacks и внешний broker.
