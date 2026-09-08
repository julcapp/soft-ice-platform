# Приёмка Telegram/MAX уведомлений о подарках

## Назначение

Этот runbook проверяет тестовые provider-контуры и Durable Gift Notification Outbox.
Он не разрешает production deployment и не является командой включения рабочих ботов.

## Стоп-условия

Приёмка немедленно прекращается, если:

- используется production-сервер, production-БД, рабочий токен или реальный неподтверждённый получатель;
- тестовый токен совпадает с production-токеном;
- не применена миграция `20260908000100_gift_notification_outbox_v1`;
- тестовый получатель не подтвердил получение служебного сообщения;
- `BOT_PROVIDER_TIMEOUT_MS` не меньше `GIFT_NOTIFICATION_OUTBOX_LEASE_MS`;
- в логах, Outbox payload или delivery attempts обнаружен открытый телефон, токен или destination ID;
- обязательный CI не зелёный.

## Контуры и порядок

1. Telegram `sendMessage` + disabled button.
2. Telegram `sendRichMessage` с текстовым сценарием подарка.
3. MAX обычное уведомление с Mini App link.
4. Полный Gift Transfer → Outbox → provider на отдельной тестовой PostgreSQL.
5. Отдельно, после первых четырёх пунктов, некритичное ephemeral-сообщение в тестовой группе.

Telegram и MAX принимаются независимо. Успех одного канала не подтверждает другой.

## Подготовка test runtime

Секреты test runtime:

- `TELEGRAM_TEST_BOT_TOKEN`;
- `TELEGRAM_TEST_RECIPIENT_ID` — только подтверждённый private chat тестировщика;
- `MAX_TEST_BOT_TOKEN`;
- `MAX_TEST_RECIPIENT_ID` — только подтверждённый тестовый user ID.

Переменная только для MAX provider smoke:

- `GIFT_NOTIFICATION_SMOKE_MINI_APP_URL` — явный HTTPS URL тестового Mini App. Production-адрес `app.utimoshi.ru` запрещён и fallback отсутствует.

Секреты не выводятся в лог и не хранятся в Git. Test runtime должен быть отделён
от production по рабочему каталогу, базе, токенам и конфигурации.

## Provider smoke

Guarded smoke запускается вручную в test runtime отдельно для `telegram` и `max`.
Значение `GIFT_NOTIFICATION_SMOKE_CONFIRM=YES_TEST_RECIPIENT` означает, что
destination проверен и согласован. За один запуск отправляется ровно одно явно
помеченное тестовое сообщение; настоящий подарок, заказ и бонус не создаются.

Для Telegram выполняются два запуска:

```bash
GIFT_NOTIFICATION_SMOKE_CHANNEL=telegram \
TELEGRAM_GIFT_SMOKE_RICH_MESSAGE=false \
npm run gift-notifications:provider-smoke
```

```bash
GIFT_NOTIFICATION_SMOKE_CHANNEL=telegram \
TELEGRAM_GIFT_SMOKE_RICH_MESSAGE=true \
npm run gift-notifications:provider-smoke
```

`TELEGRAM_GIFT_SMOKE_RICH_MESSAGE=false` проверяет обычное сообщение и disabled button;
`TELEGRAM_GIFT_SMOKE_RICH_MESSAGE=true` — Rich Message и disabled button.

Ожидаемый результат: команда завершилась с `ok=true`, сообщение пришло тестовому адресату, кнопка
не выполняет действие, открытые токены/ID отсутствуют в логах.

## Полный Outbox-сценарий

На отдельном тестовом backend:

1. Применить все миграции к новой тестовой PostgreSQL.
2. Настроить тестовый webhook и выполнить вход тестового пользователя в private chat.
3. Убедиться, что recipient binding создан после канонического Customer Identity resolution.
4. Включить только проверяемый канал и `GIFT_NOTIFICATION_OUTBOX_WORKER_ENABLED=true`.
5. Создать один тестовый предоплаченный заказ и передать его второму тестовому клиенту.
6. Запустить один проход: `npm run gift-notifications:outbox`.
7. Проверить: Outbox=`PUBLISHED`, invitation=`SENT`, одна delivery attempt на канал.
8. Повторить worker: нового provider-сообщения и второй успешной попытки быть не должно.
9. Имитировать временный отказ второго канала: первый успешный канал не должен отправиться повторно.
10. Создать приглашение до recipient binding: событие должно ожидать без расходования `attemptCount`, а после входа тестового пользователя — доставиться.
11. Отменить подарок во время искусственно задержанного provider response: `CANCELLED` не должен стать `SENT`.
12. После теста выключить worker и оба delivery-флага, удалить тестовые секреты из runtime.

## Критерии приёмки

- миграции применяются к чистой PostgreSQL;
- обычный Telegram, Rich Message и disabled button подтверждены фактическим сообщением;
- MAX подтверждён отдельным фактическим сообщением;
- Outbox переживает перезапуск и завершает событие без дублей;
- временная ошибка даёт `RETRY`, исчерпание попыток — `DEAD_LETTER`;
- закрытый или просроченный подарок не отправляется;
- invitation становится `SENT` только после provider success;
- production, рабочие токены и реальные клиентские данные не использовались.

## Production gate

После успешной приёмки оформляется отдельное решение с резервной копией, миграцией,
расписанием worker, мониторингом `RETRY`/`DEAD_LETTER`, health-check и откатом.
До этого все production-флаги остаются `false`.
