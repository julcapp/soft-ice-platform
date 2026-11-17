# Display — экран автомата «У Тимоши»

**Модуль:** покупательский экран автомата и выдачи. **Домен:** [display.utimoshi.ru](https://display.utimoshi.ru/).  
**Назначение этой папки:** навигация по исходникам, самостоятельная история этапов Display, результаты испытаний и правила релизов. Это **не** копия развёрнутого веб-сайта.

## Где сейчас находится код Display

| Область | Канонический путь |
|---|---|
| Покупательский экран терминала | [frontend/miniapp/src/terminal/SalesTerminalPage.jsx](../frontend/miniapp/src/terminal/SalesTerminalPage.jsx) |
| Оплата на терминале | [frontend/miniapp/src/terminal/TerminalPaymentScreen.jsx](../frontend/miniapp/src/terminal/TerminalPaymentScreen.jsx) |
| Клиент API оплаты | [frontend/miniapp/src/terminal/TerminalPaymentApi.js](../frontend/miniapp/src/terminal/TerminalPaymentApi.js) |
| Предоплаченная выдача | [frontend/miniapp/src/terminal/PrepaidPickupScreen.jsx](../frontend/miniapp/src/terminal/PrepaidPickupScreen.jsx) |
| Узнавание клиента | [frontend/miniapp/src/terminal/DisplayRecognitionApi.js](../frontend/miniapp/src/terminal/DisplayRecognitionApi.js) |
| API узнавания на backend | [backend/src/modules/customer/DisplayCustomerRecognitionService.js](../backend/src/modules/customer/DisplayCustomerRecognitionService.js) |
| Архитектура общего каталога и цены | [ADR-052](../docs/architecture/ADR/ADR-052-unified-display-catalog-pricing.md) |
| Граница узнавания клиента | [ADR-053](../docs/architecture/ADR/ADR-053-display-phone-recognition-boundary.md) |
| Проверки каталога/цен Display | [docs/testing/CATALOG_PRICE_DISPLAY_MIGRATION_REHEARSAL.md](../docs/testing/CATALOG_PRICE_DISPLAY_MIGRATION_REHEARSAL.md) |

## Развитие по этапам

- [Журнал и точка отсчёта](stages/2026-11-17.md)
- Для следующих задач создавать `stages/YYYY-MM-DD.md` с версией, коммитом, тестами, поведением экрана, схемой публикации и откатом
- Сохранять единые backend, каталог, тарифы, согласия и механизмы платежей — без дублирования их бизнес-логики между Display и TimoPOS

## Правила

- Весь UI/статус заказа согласуется с фактическим подтверждением платежа сервером; `SUCCEEDED` обязателен перед выдачей.
- Изменения конфигурации реального автомата и production — только после тестов и согласования.
- Перенос существующих файлов в эту папку сейчас **не выполняется**, поскольку он потребует проверки импортов, сборки и развёртывания.
