# Многоканальные транзакционные уведомления

Одна бизнес-нотификация создаётся для одного получателя и одного подарка. `NotificationOrchestrator` одновременно создаёт попытки доставки для всех подтверждённых каналов. Telegram и MAX равноправны; схема primary/fallback запрещена.

Каждый канал имеет `NotificationDeliveryAttempt` со статусом `QUEUED`, `SENT`, `DELIVERED`, `OPENED`, `FAILED`, `UNAVAILABLE` или `UNKNOWN`. `DELIVERED` и `OPENED` устанавливаются только при достоверном provider-сигнале. Ошибка одного канала не отменяет успешную попытку другого.

Telegram использует существующую инфраструктуру; deep link содержит только одноразовый безопасный token. Телефон и Customer ID в URL запрещены. Production MAX API отсутствует: `MaxNotificationAdapter` возвращает `BLOCKED_EXTERNAL`; `MockMaxNotificationAdapter` допускается только в тестах.
