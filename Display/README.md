# Display — покупательский экран автомата «У Тимоши»

**Домен:** `display.utimoshi.ru`.

## Перенесённые исходники

- [Display/app/terminal](app/terminal/) — покупательский экран, оплата, получение заказов, QR, проверка пользователя и тесты
- [SalesTerminalPage.jsx](app/terminal/SalesTerminalPage.jsx) — основной экран
- [TerminalPaymentApi.js](app/terminal/TerminalPaymentApi.js) — клиент платежного backend
- [PrepaidPickupScreen.jsx](app/terminal/PrepaidPickupScreen.jsx) — получение предоплаченного заказа
- [DisplayRecognitionApi.js](app/terminal/DisplayRecognitionApi.js) — узнавание покупателя
- Общая сборка и зависимые компоненты остаются в [frontend/miniapp](../frontend/miniapp/)
- [Серверный сервис узнавания](../backend/src/modules/customer/DisplayCustomerRecognitionService.js)
- [ADR каталога и цен](../docs/architecture/ADR/ADR-052-unified-display-catalog-pricing.md)
- [ADR узнавания клиента](../docs/architecture/ADR/ADR-053-display-phone-recognition-boundary.md)

## Проверки

Изолированная production-сборка Mini App успешно прошла после обновления путей импортов и `resolve.dedupe` React.

В выборке из 10 Display unit-тестов: 8 успешны, 2 упали из-за несоответствия возвращаемых полей `bonusBalance:null` и `purchaseToken:null` старым ожиданиям `DisplayRecognitionApi.test.js`. **Те же две ошибки подтверждены на исходной версии до переноса**, функциональное поведение в рамках миграции не изменялось.

[Отчёт этапа](stages/2026-11-17-module-layout.md). Производственная публикация не выполнялась.
