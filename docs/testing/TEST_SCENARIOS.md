# TEST_SCENARIOS

## Machine Operations Platform v1

1. Verify an active Operator can execute only an assigned task and must submit every required checklist result.
2. Verify an Operator can submit reports, attach valid SHA-256 photo metadata, and record positive consumption.
3. Verify every test run atomically creates consumption for cups, ice cream mix, and toppings; missing categories reject the command without writes.
4. Verify an Operator is denied price, commercial, loyalty, checklist, report-approval, global-action, and machine-setting changes.
5. Verify an Admin can configure versioned checklists, assign tasks, approve submitted reports, read all operator audit actions, and manage operational settings.
6. Verify suspended, missing, and unknown operators cannot execute commands.
7. Verify audit facts use canonical operator IDs and never contain credentials or binary photos.

## Consent Privacy Core v1

1. Submit every supported type through authenticated `POST /api/v1/customers/me/consents`; verify an immutable record with a server timestamp and approved source channel.
2. Read `GET /api/v1/customers/me/consents`; verify complete customer-scoped history.
3. Submit an unsupported type or channel; verify `VALIDATION_FAILED`.
4. Repeat an identical `decision_id`; verify idempotent success without duplication.
5. Reuse a `decision_id` with changed facts; verify `CONSENT_DECISION_CONFLICT`.
6. Call the endpoints without a customer session; verify authentication failure.
7. Record `ADVERTISING`; verify it triggers no advertising behavior.

Expected result: constrained, timestamped and auditable consent history with no advertising implementation.

## Customer Identity Core v1

1. Resolve a customer through verified Telegram Mini App init data and confirm one canonical `customer_id` and safe Telegram binding.
2. Submit a normalized phone and opaque proof to a configured test phone verifier; confirm the verified E.164 phone becomes the primary identifier.
3. List external identities and confirm provider subject hashes and credentials are absent.
4. Invoke SberID and MAX provider placeholders without configured adapters; confirm fail-closed `IDENTITY_PROVIDER_UNAVAILABLE` results.
5. Append the same versioned consent decision twice with one `decision_id`; confirm one immutable record, `201` then idempotent `200`.
6. List consent history and verify document type/version, decision and timestamps.
7. Call identity endpoints without a Bearer session and confirm `401`.

Expected result: Customer Identity Core unifies phone and provider aliases behind canonical `customer_id`, accepts phone identity only from a verifier, stores idempotent versioned consent decisions, exposes safe DTOs and introduces no loyalty, promotion or advertising behavior.

## Production Platform Foundation v1

- Production startup rejects missing database and Telegram secrets or invalid typed configuration.
- `/health/live` remains `200` independently of database availability; `/health/ready` returns `503` when the database/Prisma probe fails.
- API responses carry request and correlation trace headers and safe standardized errors.
- Structured JSON logging covers requests, domain events, payments and machines without credentials.
- Metrics instruments cover orders, payments, machine status, inventory and Telegram sessions.
- Shutdown stops HTTP traffic, releases resources, disconnects Prisma and flushes logs.

Статус: Draft
Версия: 0.1

## TS-001 Запуск Mini App
1. Открыть app.utimoshi.ru.
2. Проверить отображение главного экрана.
3. Проверить отсутствие ошибок JavaScript.

Ожидаемый результат: приложение открывается без белого экрана.

## TS-002 Выбор продукта
1. Нажать «Купить мороженое».
2. Проверить переход на экран выбора.

Ожидаемый результат: отображается экран продукта.

## TS-003 Выбор сиропа
1. Выбрать каждый сироп по очереди.
2. Проверить выделение выбранного элемента.
3. Проверить изменение изображения (после реализации MediaService).
4. Проверить изменение цены (после подключения PricingEngine).

## TS-004 Выбор топпинга
1. Выбрать каждый топпинг.
2. Проверить выделение.
3. Проверить обновление изображения.
4. Проверить перерасчёт стоимости.

## TS-005 Экран предпросмотра
1. Выбрать сироп и топпинг.
2. Проверить, что CTA продолжения заказа использует текст «Продолжить с комфортом».
3. Перейти на экран Preview.
4. Проверить итоговое изображение, состав и цену.

## TS-006 Адаптивность
Проверить отображение на:
- 390×844
- 768×1024
- 1280×720
- 1920×1080

## TS-007 Регрессия
После каждого релиза проверить:
- запуск приложения;
- переходы между экранами;
- корректность изображений;
- расчёт стоимости;
- отсутствие ошибок в консоли браузера.

## TS-008 Backend foundation
1. Запустить backend с PostgreSQL configuration из `backend/.env.example`.
2. Проверить `GET /health`.
3. Проверить `GET /health/ready`.

Ожидаемый результат: `/health` возвращает liveness backend, `/health/ready` возвращает readiness по фактической доступности PostgreSQL. Платёжные операции, YooKassa API calls, Telegram integration и machine dispatch не выполняются.

## TS-009 MVP vertical slice 001 - customer registration
1. Configure backend with `DATABASE_URL` and `TELEGRAM_BOT_TOKEN`.
2. Send valid Telegram Mini App init data to `POST /api/v1/auth/telegram-mini-app/sessions` with `source_channel = telegram_mini_app`.
3. Verify response contains `customer_id`, `session_id`, Bearer `access_token` and `expires_at`.
4. Call `GET /api/v1/customers/me` with the Bearer token.
5. Call `GET /api/v1/club-accounts/me` with the Bearer token.
6. Call `GET /api/v1/telegram/mini-app/bootstrap` with the Bearer token.
7. Send invalid Telegram init data to the session endpoint.
8. Send valid Telegram Mini App init data to `POST /api/auth/telegram`.
9. Call `GET /api/customer/me` with the Bearer token returned by the compatibility endpoint.

Expected result: valid Telegram init data creates or resolves one canonical customer, creates a zero-balance RUB Club Account after registration, returns customer-safe profile/account/bootstrap DTOs through API v1, returns the customer-safe profile through the compatibility API aliases and rejects invalid init data with `AUTHENTICATION_INVALID`. Payments, top-ups and machine dispatch remain disabled in this slice.

## TS-010 MVP vertical slice 002 - Club Account and Loyalty Core
1. Create a customer session through `POST /api/v1/auth/telegram-mini-app/sessions`.
2. Call `GET /api/v1/club-account/me` with the Bearer token.
3. Call `POST /api/v1/club-account/top-up` with an initial RUB amount, reason and reference entity.
4. Call `GET /api/v1/club-account/me` again.
5. Call `GET /api/v1/club-account/history`.
6. Exercise an internal debit through Club Account Runtime test coverage.
7. Call `GET /api/v1/club-account/me`, `POST /api/v1/club-account/top-up` and `GET /api/v1/club-account/history` without a Bearer token.

Expected result: the customer has an active Club Account after registration, the top-up creates an immutable credit ledger record and updates the stored balance projection, internal debit creates an immutable debit ledger record and recalculates balance from ledger deltas, history returns customer-safe credit/debit records with reason, reference entity and timestamps, and unauthenticated requests return `401`.

## TS-011 MVP vertical slice 003 - Order and Purchase Core
1. Create a customer session through `POST /api/v1/auth/telegram-mini-app/sessions`.
2. Call `POST /api/v1/orders` with a RUB amount and Bearer token.
3. Call `GET /api/v1/orders/:id` with the same Bearer token.
4. Call the internal Order Runtime payment confirmation flow for the order.
5. Call `GET /api/v1/orders/:id` again.
6. Create a second order and call `GET /api/v1/customer/orders`.
7. Call order create/read/history endpoints without a Bearer token.

Expected result: order creation returns a customer-owned `PAYMENT_PENDING` order and emits `OrderCreated`, internal payment confirmation changes the order to `PAID`, prepares the Club Account future integration point and emits `OrderPaid`, order history returns only the current customer's orders, and unauthenticated requests return `401`. YooKassa, machine dispatch and Telegram notifications remain out of scope.

## TS-012 MVP vertical slice 004 - Machine Integration and Dispense Flow
1. Create a customer session through `POST /api/v1/auth/telegram-mini-app/sessions`.
2. Register an online machine through `POST /api/v1/machines/register` with a Bearer token.
3. Call `GET /api/v1/machines/:id` with the same Bearer token.
4. Create an order through `POST /api/v1/orders`.
5. Call the internal Order Runtime payment confirmation flow for the order.
6. Call `GET /api/v1/orders/:id/dispense` with the same Bearer token.
7. Exercise Machine Runtime command receipt so the dispense request moves from `REQUESTED` to `STARTED`.
8. Exercise Machine Runtime completion so the dispense request moves to `COMPLETED`.
9. Exercise a separate Machine Runtime failure path so the dispense request moves to `FAILED` with a safe failure reason.
10. Call machine register/read and order dispense endpoints without a Bearer token.

Expected result: a paid order creates exactly one `DispenseRequest` with a stored `DispenseCommand`, emits `MachineDispenseRequested`, command receipt emits `DispenseStarted`, completion emits `DispenseCompleted`, failure emits `DispenseFailed`, failed requests keep the safe reason and reject completion, and unauthenticated requests return `401`. Vendor SDKs, Huaxin API integration, real telemetry, payment providers and Telegram notifications remain out of scope.

## TS-013 Huaxin Machine Gateway v1

1. Build a dispense command containing XML-sensitive values and verify escaped Huaxin XML.
2. Parse successful, rejected, heartbeat and telemetry XML; reject unsafe declarations and unsupported responses.
3. Queue concurrent commands and verify serialized execution and bounded overflow behavior.
4. Connect a fake transport, correlate acknowledgements by command ID and map rejections/timeouts safely.
5. Verify connection/availability transitions, heartbeat freshness, stale status, telemetry retention and machine events.
6. Fail a connection, verify retryable `MACHINE_CONNECTION_UNAVAILABLE`, then reconnect successfully.
7. Call status, telemetry, command and reconnect endpoints with valid authentication; verify unauthenticated calls return `401`.
8. Run existing paid-order and dispense tests to prove business behavior is unchanged.

Expected result: Huaxin details remain inside `machine_gateway`; commands and responses are safe and correlated; operational state and telemetry are observable; failures use stable API errors; existing order and machine-domain tests remain green. A real machine connection requires a deployment transport based on the manufacturer-verified protocol.

## TS-014 Vending Machine Simulator v1

1. Create two simulators with the same seed, clock, cup stock and ingredient levels.
2. Start both and verify `OFFLINE -> ONLINE -> READY`, matching heartbeat timestamps and identical first telemetry samples.
3. Send a dispense command through `MachineGateway.sendCommand`; verify `READY -> BUSY -> DISPENSING -> READY`, one cup consumed and only requested ingredient doses consumed.
4. Run `READY -> CLEANING -> READY`.
5. Script a dispense failure; verify the simulator enters `ERROR`, exposes a safe telemetry error code and can reset through `ONLINE -> READY`.
6. Exhaust cup stock and verify `MACHINE_INVENTORY_INSUFFICIENT` without false success.
7. Create an order, confirm payment through existing Order Runtime, obtain the resulting `DispenseCommand`, send it through the simulated `MachineGateway`, and report start/completion through existing Machine Runtime.

Expected result: the simulator is deterministic, implements only the vendor-neutral gateway interface, covers all seven simulator lifecycle states, simulates heartbeat/telemetry/inventory/success/failure/error behavior, and completes the automated `order -> payment -> machine -> dispense` flow without changing business logic or using Huaxin-specific behavior.
# Customer Segmentation Core v1

- Create manual and system segments with unique stable codes.
- Add declarative criteria to a system segment and reject rules for a manual segment.
- Assign a customer idempotently and retain the closed assignment in history after unassignment.
- Reject assignment to an inactive segment and exclude inactive memberships from the active projection.
- Return authenticated customer-safe active and historical segment DTOs without rule criteria.
