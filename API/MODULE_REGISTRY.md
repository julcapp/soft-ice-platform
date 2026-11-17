# Реестр API по модулям — 17.11.2026

Это **карта исходников**, не автоматически сгенерированный список опубликованных URL. Проверку фактического запуска маршрутов проводить отдельно.

| Потребитель | Код маршрутов | Контракты / примечания |
|---|---|---|
| AdminDesktop | [adminAuthRoutes.js](../backend/src/api/v1/adminAuthRoutes.js), [administratorSecurityRoutes.js](../backend/src/api/v1/administratorSecurityRoutes.js), [adminDashboardRoutes.js](../backend/src/api/v1/adminDashboardRoutes.js) | Сессии администратора и серверная RBAC |
| TimoPOS | [timoPosSellerAuthRoutes.js](../backend/src/api/v1/timoPosSellerAuthRoutes.js), [seller_auth](../backend/src/modules/seller_auth/), [timopos](../backend/src/modules/timopos/) | MAX OTP продавца, авторизация точки; opt-in маршрут **не включён** в production |
| Display | [terminalCustomerRoutes.js](../backend/src/api/v1/terminalCustomerRoutes.js), [authRoutes.js](../backend/src/api/v1/authRoutes.js) | Клиентский терминал, узнавание пользователя, оплата и выдача; подтверждать действующие пути по `index.js` |
| Master / Technician | [mobileServiceRoutes.js](../backend/src/api/v1/mobileServiceRoutes.js), [serviceWorkspaceRoutes.js](../backend/src/api/v1/serviceWorkspaceRoutes.js), [maintenanceRoutes.js](../backend/src/api/v1/maintenanceRoutes.js) | Канонические полномочия определены ADR-050; не утверждается, что все сервисные маршруты уже включены |
| Каталог и цены | [catalogRoutes.js](../backend/src/api/v1/catalogRoutes.js), [pricingRoutes.js](../backend/src/api/v1/pricingRoutes.js) | Общая бизнес-логика для каналов |
| Заказы и платежи | [orderRoutes.js](../backend/src/api/v1/orderRoutes.js), [paymentRoutes.js](../backend/src/api/v1/paymentRoutes.js) | Подтверждение платежа и правила выдачи только на backend |
| Оборудование | [machineGatewayRoutes.js](../backend/src/api/v1/machineGatewayRoutes.js), [machineRuntimeRoutes.js](../backend/src/api/v1/machineRuntimeRoutes.js) | Команды через проверенную серверную границу |

## Конфликт ролей для согласования

[ADR-050](../docs/architecture/ADR/ADR-050-unified-admin-console-entrypoints.md) называет `SERVICE_SPECIALIST` и `MACHINE_RESPONSIBLE` каноническими ролями. В экспериментальной [политике TimoPOS](../backend/src/modules/timopos/TimoPosServiceAccessPolicy.js) используются `TECHNICIAN`, `MASTER`, `PLATFORM_ADMIN`. **Не считать их автоматически эквивалентными**. До активации защищённых API необходимы отдельное архитектурное решение, серверное сопоставление прав и тесты отказов.

## Следующее развитие

Добавить автоматически проверяемую таблицу методов и маршрутов, OpenAPI для реально используемых публичных контрактов, матрицу доступа по ролям и результаты интеграционных испытаний.
