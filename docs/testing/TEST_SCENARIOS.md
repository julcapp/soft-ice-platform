# TEST_SCENARIOS

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
