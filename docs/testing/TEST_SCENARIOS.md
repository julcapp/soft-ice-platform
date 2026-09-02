# TEST_SCENARIOS

## Bot Core — безопасная доставка приглашения о подарке

1. Private Telegram update binds only when canonical Customer Identity matches the sender and `chat_id == user_id`.
2. Telegram group/supergroup/channel updates never become personal delivery bindings.
3. MAX binding uses the verified inbound `user_id`; a subject already linked to another customer is rejected.
4. Database contains only the subject hash and AES-256-GCM ciphertext, never a plaintext destination.
5. Ciphertext cannot be decrypted under another customer/channel associated-data context.
6. Both delivery flags default to false and provider clients are not called while disabled.
7. A registered, bound recipient receives the message independently in each enabled channel.
8. An unregistered or unbound recipient produces `UNAVAILABLE` delivery attempts without an external call.
9. Message text and provider request contain no invitation token, phone, redemption code or payment data.
10. `GiftInvitation.status` becomes `SENT` and emits `GIFT_INVITATION_SENT` only if at least one provider returns `SENT` or `DELIVERED`.

## Bot Core — принятие подарка

1. Неаутентифицированный callback `gift_accept` не вызывает Gift Transfer Runtime и предлагает завершить вход.
2. Раздел «Мои подарки» показывает только подарки текущего получателя в состояниях `AVAILABLE`, `ACCEPTED` и `REDEMPTION_READY`.
3. Подарок отправителя, другого получателя, отменённый или возвращённый подарок не создаёт кнопку принятия.
4. Валидный callback передаёт канонический `customerId` и `giftId` в `GiftTransferRuntime.accept`.
5. Повторное принятие не создаёт повторное событие и возвращает текущее состояние.
6. Просроченный подарок не принимается и возвращается отправителю существующим доменным сценарием.
7. После успеха Telegram показывает disabled button только при включённом флаге; при выключенном флаге кнопка скрывается.
8. После успеха MAX не показывает повторную кнопку принятия.
9. Подтверждение принятия не содержит ephemeral delivery; код получения, invitation token, телефон и финансовые сведения не выводятся.
10. Ошибки доступа и недоступного статуса преобразуются в безопасный пользовательский текст без внутренних подробностей.


## Сквозная продажа Soft ICE v1 — ревизия orchestration boundary

- Проверить, что `PAYMENT_CONFIRMED` не означает `COMPLETED` и не вызывает consume/loyalty.
- Проверить, что один `orderId` даёт не более одного complete, consume, loyalty update и `SALE_COMPLETED`.
- Проверить, что повторный `DISPENSE_FAILED` создаёт ровно один domain refund request, сохраняет payment fact и не завершает заказ.
- Проверить, что Sale Flow repository хранит только workflow state, idempotency/correlation metadata и ссылки на domain entities.

## Organization 360 v1

### Целостность истории ответственности за аппарат

1. Создать организацию, сотрудника, аппарат и активную ответственность со scope `MACHINE`.
2. Убедиться, что ответственность содержит `machineId` и проходит CHECK `OrganizationResponsibility_scope_target_check`.
3. Отозвать ответственность и убедиться, что историческая запись сохраняет `machineId`.
4. Попытаться физически удалить связанный `Machine`: операция должна завершиться ошибкой FK `RESTRICT`, а историческая запись должна остаться консистентной.
5. Выполнить штатный перевод аппарата через завершение текущего назначения и создание нового; назначить нового ответственного отдельной записью.

1. Создать и изменить организацию; проверить реквизиты, статусы, аудит и `organization.created`/`organization.updated`/`organization.status_changed`.
2. Создать корневое и вложенное подразделение; запретить self-parent, косвенный цикл и ссылку на другую организацию.
3. Создать, изменить и деактивировать сотрудника без хранения пароля; связать его с существующим пользователем.
4. Назначить и отозвать организационную роль; убедиться, что технические разрешения RBAC не создаются автоматически.
5. Создать и изменить точку с координатами, режимом работы, подразделением и ответственным.
6. Привязать существующий Machine, сменить/отозвать ответственного и отвязать аппарат без копирования runtime-данных.
7. Проверить `ORGANIZATION_ADMIN` для своей/чужой организации, read-only `ORGANIZATION_MANAGER` и глобальный `PLATFORM_OWNER`.
8. Проверить стандартный event envelope, correlation, аудит и список событий организации.
9. Проверить read-only показатели и явные статусы `FOUNDATION_ONLY` отсутствующих production-проекций.
10. Проверить список, восемь вкладок, loading/empty/error/denied и адаптивность Admin Console; все пользовательские тексты должны быть на русском языке.
11. Проверить составные foreign key: подразделение, сотрудник, точка и ответственность не могут ссылаться на объект другой организации даже при прямой записи в БД.
12. Проверить соответствие scope и цели ответственности, а также запрет организационному администратору назначать владельца/оператора аппарата из другой организации.
13. После передачи аппарата другой организации проверить, что исторические продажи и оборот остались в интервале прежнего назначения.

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
# Admin Console Vertical Slice 001

Status: `IMPLEMENTED`

## Dashboard endpoint

1. Request `GET /api/v1/admin/dashboard` without administrator authentication and expect `401`.
2. Request with `REGIONAL_MANAGER` and expect `403` without metric disclosure.
3. Request with `ADMIN` or `PLATFORM_OWNER` and expect `200`.
4. Verify `generatedAt`, `freshness`, `permissionScope`, `summary`,
   `machineStatus`, `inventoryAlerts`, `operatorSummary`, `maintenanceSummary`,
   `paymentSummary` and `recentEvents`.
5. Verify `freshness.isDemo=true`, `source=DEMO_READ_MODEL` and
   `permissionScope.access=READ_ONLY`.
6. Verify POST/PUT/PATCH/DELETE are not routed.

## Admin Console states

1. Pending request preserves layout with skeletons and no fake values.
2. Empty activity renders the approved empty state.
3. Demo/stale data renders the freshness warning.
4. Transport failure renders the unavailable state without mutation affordances.
5. `401`/`403` renders the permission-denied state without hidden values.
6. Dashboard renders every required Vertical Slice 001 widget and chart.
7. Production build completes and responsive CSS covers desktop, tablet and mobile.
# Machine Digital Twin Core v1 scenarios

- ADMIN and PLATFORM_OWNER can list and inspect twins; OPERATOR is denied.
- Projection contains the complete contract and every source declares status.
- Missing telemetry is UNAVAILABLE; aged telemetry becomes STALE/EXPIRED.
- Simulator projections include `dataMode: DEMO`, generation time, and source.
- Health score is deterministic, clamped to 0–100, and returns factors.
- Snapshots and twin events are immutable and event-versioned.
- All six GET endpoints respond; POST/PUT/PATCH/DELETE are not implemented.
- Development admin headers fail in production configuration.
- Admin Console covers list/detail/components/events/snapshots/health and
  loading, empty, stale, unavailable, denied, and demo presentation.
- Digital Twin adapters never expose source-domain mutation methods.
# Machine Runtime and Event Bus Foundation v1

Automated coverage includes legal/illegal transitions; purchase, test, and maintenance sessions; conflict prevention; error/recovery; normalized signals; envelope validation/immutability; ordered handlers; failure isolation/retry/dead letters; subscriber idempotency; duplicate consumption prevention; Digital Twin projection; read authorization/no mutation; and Admin Console loading, empty, denied, unavailable, runtime, event, and foundation/stale displays.
# Inventory Runtime Foundation v1

- Create ingredients, consumables, service materials, warehouse locations, and machine locations with stable IDs.
- Record receipt, consumption, test consumption, maintenance consumption, inventory count, and signed adjustment movements.
- Verify on-hand, reserved, and available balances independently for multiple locations.
- Reject negative stock and reservations above available stock.
- Reserve, consume, and release stock while preserving terminal reservation history.
- Replay identical commands without duplicate movements; reject an idempotency key reused with a different payload.
- Deliver a Machine Runtime consumption event twice and verify one Inventory movement.
- Verify every mutation emits audit and platform event facts.
- Verify Admin Console renders only balances and movement journal without stock mutation controls.
# Maintenance Runtime v1

- MR-001: ADMIN creates a versioned preventive plan assigned to multiple machines.
- MR-002: OPERATOR resolves a registered QR and opens an exclusive maintenance session.
- MR-003: another active session for the same machine is rejected.
- MR-004: only the assigned operator can complete checklist, photo, replacement and test steps.
- MR-005: submission fails until required checklist items, photo count and test dispense are complete.
- MR-006: replacement records an idempotent Inventory Runtime maintenance movement.
- MR-007: ADMIN approves or rejects; OPERATOR cannot approve.
- MR-008: approved sessions reject further mutation and retain append-only audit history.
- MR-009: identical idempotent replay returns the first result; changed input conflicts.
- MR-010: event-driven Admin Console projection reports multi-machine queue and KPIs.
# Operator Workspace v1

## OW-001 — Область назначенных автоматов

Оператор видит только назначенные ему автоматы. Запрос чужого автомата возвращает запрет доступа. Администратор может читать все автоматы и журнал.

## OW-002 — Обязательная фотофиксация

Сессию нельзя завершить без минимум одной фотографии до и одной фотографии после обслуживания. Метаданные содержат ключ объекта, MIME-тип, время съёмки и SHA-256.

## OW-003 — Комплект тестов

Для каждого автомата обязательны тест стаканчика и тест выдачи мороженого. Тест сиропов обязателен и доступен только при наличии сиропных линий.

## OW-004 — Отдельный тестовый расход

Каждый тест создаёт расход категории `TEST_CONSUMPTION`, `commercialSale: false`, связанный с тестом. Коммерческий заказ, продажа и платёж не создаются.

## OW-005 — Завершение обслуживания

После заполнения чек-листа, фото и тестов оператор завершает сессию. Создаётся `OperatorWorkspace.SessionCompleted`, обновляется агрегат Digital Twin, завершённая сессия становится неизменяемой.
# CRM Soft ICE

- CRM Dashboard показывает число клиентов, покупки, обязательства по бонусам, активные акции и очередь уведомлений.
- Список клиентов поддерживает безопасный поиск по имени, телефону и электронной почте.
- Карточка клиента объединяет клубный и бонусный счета, операции, покупки, начисления, рефералов, сегменты и уведомления.
- Пополнение из CRM проходит только через Club Account Runtime и требует ключ идемпотентности.
- Назначение сегмента проходит только через Segmentation Runtime и попадает в аудит.
- Клиент с запретом коммуникаций не может получить новое уведомление.
- Интерфейс рабочего места и человекочитаемые сообщения отображаются на русском языке.
- Неавторизованный запрос к `/api/v1/admin/crm/*` отклоняется.
# Customer 360 Platform v1

- Единый профиль возвращает идентификацию, лояльность, покупки, предпочтения, коммуникации, акции, рефералов, игры и AI-фундамент.
- Сумма и количество покупок рассчитываются из авторитетной истории заказов.
- Customer Timeline объединяет события доменов и сортирует их по убыванию времени.
- Фильтр категории Timeline не возвращает события других категорий.
- Обновление явного предпочтения создаёт событие `Customer360.PreferenceUpdated`.
- Значение достоверности предпочтения вне диапазона от 0 до 1 отклоняется.
- Клиент не может запросить профиль другого клиента через маршрут `/me`.
- Административный профиль недоступен без административного контекста безопасности.
- Admin Console показывает все разделы и Customer Timeline на русском языке.
# Внешние каналы и связь автомата

Проверяются VK-профиль и подписка, разделение согласия, ручной источник, недоступная интеграция, детерминированный индекс, маскирование телефона, SIM и тариф, низкие баланс/трафик, устаревание, авторизация API, события и оба UI-блока.
# VIDEO — Видеонаблюдение и инциденты

- VIDEO-001: PIR пробуждает камеру, но не подтверждает инцидент.
- VIDEO-002: аналитика зоны подтверждает движение и запись.
- VIDEO-003: событие автомата запускает запись независимо от PIR.
- VIDEO-004: pre/post buffer, продление, cooldown и maximum duration.
- VIDEO-005: retention 72 часа, автоматическое удаление и аудируемый результат.
- VIDEO-006: legal hold блокирует удаление и требует отдельного разрешения.
- VIDEO-007: просмотр/выгрузка/изменение настроек аудируются.
- VIDEO-008: роли и Operator Workspace ограничивают архив.
- VIDEO-009: недоступный RTSP, отказ авторизации, нет кадров, frozen frame, мало места.
- VIDEO-010: UI — рабочее, пустое, устаревшее, недоступное и запрещённое состояния.
# Event Center foundation v1

- EC-01: регистрация создаёт одну неизменяемую нормализованную запись.
- EC-02: повторная доставка по eventId/source identity не создаёт дубликат.
- EC-03: password/token/secret/authorization/cookie/apiKey/rtspUrl/cardNumber/cvv/biometric исключаются рекурсивно.
- EC-04: фильтры, cursor, machine/customer/correlation scope и сортировка сохраняют tenant boundary.
- EC-05: processing state, acknowledgement, comments, tags, evidence и legal hold не изменяют EventRecord.
- EC-06: legal hold блокирует retention, удаление идемпотентно и аудируемо.
- EC-07: role permissions маскируют payload, security events и operator machine scope.
- EC-08: Admin Console отображает русский список/карточку и не показывает raw enum.
- EC-09: EventFeed покрывает empty/loading/error/forbidden/stale и интегрирован в Machine Twin/Customer 360.

# Универсальный терминал продаж

1. Открыть Mini App с параметром `?mode=terminal`; проверить адаптивный экран на мобильном, планшете, desktop и большом touch-экране.
2. Переключить сиропы и топпинги; проверить, что конфигурация проходит через Configuration, Recipe и Pricing services, а итог остаётся `130 ₽`.
3. Переключить формат выдачи между автоматом и мобильной точкой; проверить соответствующее описание выполнения заказа.
4. Перейти к оплате, переключить СБП и банковскую карту; проверить состояние ожидания подтверждения.
5. Проверить, что UI не подтверждает оплату по таймеру, QR или возврату со страницы провайдера.
6. Запустить явно обозначенное демонстрационное событие Payment Runtime; проверить состояние `оплата подтверждена`.
7. Для автомата проверить сообщение об отправке команды выдачи; для мобильной точки — номер заказа, код выдачи и уведомление продавца.
8. Нажать «Новый заказ» и убедиться, что терминал возвращается к выбору.
# Передача подарочного заказа и реферальная система v1

- Отказ от оплаченного невыданного заказа возвращает стоимость отдельной записью внутреннего баланса; повтор не создаёт вторую запись; бонусы не начисляются.
- Нельзя подарить себе, отменённый/выданный заказ или создать вторую передачу.
- Зарегистрированный получатель ищется только по подтверждённому телефону; незарегистрированному Customer не создаётся.
- Invitation token одноразовый, хранится как hash и принимается только владельцем указанного подтверждённого номера.
- До принятия отправитель может отменить передачу, после принятия — нет; переподарить нельзя.
- Redemption-код действует 5 минут, одноразовый и использует Machine Fulfillment.
- При истечении подарок закрывается, а стоимость идемпотентно возвращается отправителю.
- Gift Redemption не начисляет purchase-бонусы и не считается first own purchase.
- Telegram и MAX вызываются одновременно; проверяются частичный успех, оба unavailable и достоверность статусов.
- Все события передачи имеют общий `correlationId`; Customer Timeline, роли и русские UI-тексты проверяются отдельно.

# Telegram Bot API 10.3 — поэтапная приёмка

- При трёх выключенных флагах Bot Core отправляет прежний `sendMessage`, не добавляет ephemeral-параметры и не передаёт `disabled` в Telegram.
- При включённом rich-message флаге подготовленный Telegram view вызывает `sendRichMessage`; при выключенном флаге тот же view отправляет обычный текстовый fallback.
- Rich-message ошибка не запускает автоматическую повторную отправку обычного сообщения после неопределённого результата сети, чтобы не создавать дубликат.
- Ephemeral отправляется только при `critical=false`, известном `receiver_user_id` и включённом флаге.
- Код получения, чек, оплаченный заказ и другое критичное сообщение всегда отправляются обычным способом, даже если view ошибочно запросил ephemeral.
- При включённом disabled-button флаге завершённое действие отображается как `InlineKeyboardButton.disabled={}`.
- При выключенном disabled-button флаге завершённое действие отсутствует в клавиатуре и не становится активным повторно.
- MAX renderer для тех же shared actions не получает Telegram `disabled`, `rich_message` или `ephemeral_message_parameters`.
- Повторный callback по завершённому действию остаётся безопасным за счёт backend-идемпотентности, независимо от вида кнопки.
# Сквозная продажа Soft ICE v1

- Happy path: заказ → PAID → AUTHORIZED → DISPENSING → DISPENSED → Inventory → Sale → CRM/Customer 360 → Loyalty → COMPLETED.
- Оплата: DECLINED, TIMEOUT и CANCELLED не разрешают выдачу.
- Аппарат: ACCEPTED и DISPENSING не считаются успехом; FAILED и TIMEOUT требуют возврата и не создают продажу/бонусы.
- Безопасность: offline/чужой аппарат, недостаток ингредиентов и повторное использование токена отклоняются.
- Идемпотентность: повторные payment callback и machine event не дублируют финансовый факт, списание, продажу или лояльность.
# Регрессия сквозной продажи Soft ICE v1 — 2026-08-17

- Happy path с единственными dispense, inventory consume, Customer 360, CRM и Loyalty effect.
- `PAID` не создаёт `SALE_COMPLETED` и финальные эффекты.
- Повторное создание заказа с одним idempotency key.
- Duplicate payment callback и duplicate provider transaction id.
- Payment declined/timeout/cancelled с release резерва.
- Machine accepted/dispensing/failed/timeout и `REFUND_REQUIRED` после оплаты.
- Duplicate machine callback, duplicate `DISPENSED`, reused fulfillment token.
- Недостаток ингредиентов и недоступный аппарат до оплаты.
- Запрещённые state transitions.
- Authoritative organization/location relation и tenant mismatch.
- Уникальные `eventId`, общий `correlationId`, последовательный `causationId`.
- Русскоязычное Admin-представление orchestration state и domain-ссылок с маркировкой «Тестовый режим».

Service restart остаётся непроверяемым до durable repository (`FOUNDATION_ONLY`). Production callback security и физический аппарат — `BLOCKED_EXTERNAL`.
# Durable Sale Flow Runtime v1

- создание/чтение по flow, order и correlation ID;
- optimistic CAS и конкурентный конфликт;
- `PAID`, `FULFILLMENT_AUTHORIZED`, `DISPENSING`, `COMPLETED`, `REFUND_REQUIRED` после пересоздания repository/service;
- duplicate payment callback и duplicate `DISPENSED` после restart;
- различение `STARTED`/`COMPLETED` idempotency marker;
- recovery: safe resume против reconciliation;
- terminal completion, retention policy, health и русское Admin-представление;
- PostgreSQL integration выполняется только с отдельной временной БД; production database запрещена.
# Transactional Outbox v1

- Sale Flow state и outbox event commit атомарно; ошибка любой стороны откатывает транзакцию.
- `eventId` и `idempotencyKey` уникальны, включая конкурентное создание.
- Два PostgreSQL worker claim не получают одно событие; `PUBLISHED` не выбирается повторно.
- Retry имеет deterministic backoff, max attempts переводит в `DEAD_LETTER`, просроченный lease восстанавливается.
- Tenant не читает события другой организации; platform scope явный.
- Admin retry разрешён только роли администратора и создаёт audit trail; payload не редактируется.
- Известные secret fields в payload отклоняются.
# Transactional Outbox v1 revision defects — 2026-08-20

- Рекурсивная payload validation отклоняет точные sensitive keys в корне, nested objects, arrays и objects внутри arrays без раскрытия значения в ошибке.
- Case-insensitive validation отклоняет camelCase, uppercase и snake_case варианты sensitive keys.
- Безопасные бизнес-поля `productTokenCount`, `tokenizedLabel`, `secretaryName`, `authorizationStatus` не блокируются substring matching.
- Crash window после успешного publisher и до `markPublished()` оставляет событие `PROCESSING`; после истечения lease оно публикуется повторно с тем же `eventId`, подтверждая at-least-once semantics.
# Inventory Reservation & Locking v1

- Успешный и недостаточный reserve; атомарный rollback при ошибке Outbox.
- Два конкурентных заказа последней единицы: один `RESERVED`, один `FAILED`.
- Stress 50×1 при stock=10: 10 успехов, 40 отказов, reserved=10.
- Stress 50×1 повторяется пять независимых раз; каждый прогон: 10 успехов, 40 отказов, over-reservation=0.
- Multi-item reserve с недоступной третьей позицией не меняет reserved ни для одной позиции.
- Concurrent consume, concurrent release, consume vs release и expire vs consume не выполняют двойную модификацию stock.
- Идемпотентные consume/release, expiration и восстановление после пересоздания service.
- Tenant и machine isolation; `OPERATOR_TEST`/`MAINTENANCE_TEST` создают `TEST_CONSUMPTION`.
- Production wiring использует PostgreSQL Inventory; отсутствие durable adapter закрывает Sale Flow ошибкой.
- Failure injection A/B/C доказывает общий rollback reserve/items/stock, Sale Flow и Outbox.
- Production composition содержит production Organization/Order/Pricing dependencies; отсутствие каждой отдельно останавливает startup до транзакции.
- Product Engine пересчитывает серверную цену и игнорирует переданный клиентом итог.
- PostgreSQL отклоняет quantity=0/negative, отрицательные reserved/consumed/released, over-consume, over-release и combined overflow; invalid item откатывает multi-item transaction.
- Legacy fixtures single/multi/released/consumed/expired сохраняют item composition; невосстановимый tenant/machine scope останавливает migration.
# Финальная ревизия Inventory Reservation & Locking v1 — CRITICAL regression

- Production composition требует `organizationContext`, `orderDomain`, `priceCalculator`, `paymentAdapter`, `machineAdapter`, PostgreSQL Inventory и PostgreSQL Transactional Outbox до начала бизнес-транзакции; внешние Payment/Machine границы честно возвращают `BLOCKED_EXTERNAL`.
- Одна Prisma/PostgreSQL transaction фиксирует Order, multi-item Inventory reservation/stock, Sale Flow и Outbox; инъекции отказа Order, Inventory, Sale Flow и Outbox дают полный rollback.
- Legacy migration fixtures покрывают `ACTIVE`, `CONSUMED`, `RELEASED`, `EXPIRED`, single-item и multi-item; terminal rows сохраняют `reservedQuantity = quantity`, а невосстановимое ownership приводит к abort всей migration transaction.

## Gift Transfer PostgreSQL Runtime

- Создание подарка атомарно сохраняет transfer, invitation и referral link.
- После создания нового экземпляра runtime ранее сохранённый подарок доступен отправителю и получателю.
- Принятие сохраняет `ACCEPTED` и реферальную стадию; повторный вызов идемпотентен.
- Claim сохраняет получателя, приглашение, claim и реферальную связь одной транзакцией репозитория.
- Выдача сохраняет redemption и состояние подарка; хеш кода остаётся в базе, открытый код — только в ответе Mini App.
- Попытка уведомления повторно использует уникальную пару `notificationId + channel`.
- Пользовательский и административный API корректно ожидают асинхронные чтения Prisma.
- Prisma schema и чистая цепочка миграций содержат `OrderStatus.GIFT_TRANSFERRED`.
- Перезапуск backend не удаляет подарки и историю попыток доставки.
