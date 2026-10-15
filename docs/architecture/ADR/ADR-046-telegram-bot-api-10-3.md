# ADR-046: поэтапное подключение Telegram Bot API 10.3

**Статус:** принято  
**Дата:** 2026-08-25

## Контекст

Telegram Bot API 10.3 от 24 августа 2026 года расширяет актуальный Bot API, среди прочего:

- добавляет кнопки, документы и раскрываемые цитаты в Rich Messages (метод `sendRichMessage` существует с Bot API 10.1);
- `EphemeralMessageParameters` для персонального временного сообщения;
- `DisabledButton` через поле `InlineKeyboardButton.disabled`;
- `force_reply` в inline/reply markup.

Эти возможности относятся только к Telegram. Они не меняют контракт MAX, бизнес-правила подарков, рефералов, заказов и выдачи, а также не ускоряют загрузку Mini App.

Официальный источник: <https://core.telegram.org/bots/api#recent-changes>.

## Решение

1. Поддержка 10.3 добавляется внутри Telegram transport boundary Bot Core.
2. Все новые возможности выключены по умолчанию и включаются независимо:
   - `TELEGRAM_RICH_MESSAGES_ENABLED=false`;
   - `TELEGRAM_EPHEMERAL_MESSAGES_ENABLED=false`;
   - `TELEGRAM_DISABLED_BUTTONS_ENABLED=false`.
3. Shared view model может передавать только явные Telegram-подсказки в `channelOptions.telegram`:
   - `richMessage` — проверенный объект Telegram `RichMessage`;
   - `delivery` — `{ mode: 'ephemeral', critical: false }`;
   - для действия `channelOptions.telegram.disabled=true`.
4. При отключённом rich-message флаге отправляется обычный текстовый fallback.
5. При отключённом ephemeral-флаге сообщение отправляется обычным способом.
6. Завершённое действие при отключённом disabled-button флаге удаляется из Telegram-клавиатуры, а не становится снова активным.
7. MAX renderer и MAX client не получают Telegram-поля.

## Граница безопасности временных сообщений

Telegram прямо указывает, что доставка ephemeral-сообщения не гарантируется, особенно если получатель офлайн. Поэтому ephemeral разрешён только когда одновременно выполнены условия:

- функция включена;
- `delivery.mode === 'ephemeral'`;
- `delivery.critical === false`;
- известен корректный Telegram `receiver_user_id`.

Ephemeral запрещён как единственный носитель:

- кода получения;
- чека или факта оплаты;
- статуса оплаченного заказа;
- срока получения;
- финансовой операции или изменения баланса;
- обязательного предупреждения.

При нарушении любого условия Bot Core выполняет обычную отправку без `ephemeral_message_parameters`.

## Идемпотентность

Disabled button является только отображением уже подтверждённого сервером состояния. Он не заменяет доменную идемпотентность. Повторное принятие подарка, формирование кода, благодарность или иное действие обязано безопасно обрабатываться backend-сервисом независимо от состояния кнопки.

## Поэтапное включение

1. Оставить все три флага `false` в production.
2. Проверить payload и fallback на изолированном Telegram test bot.
3. Включить `TELEGRAM_DISABLED_BUTTONS_ENABLED` и проверить завершённые/idempotent действия.
4. Включить `TELEGRAM_RICH_MESSAGES_ENABLED` только для подготовленных rich-message шаблонов с обычным текстовым fallback.
5. Включить `TELEGRAM_EPHEMERAL_MESSAGES_ENABLED` последним и только для неважных персональных подтверждений.
6. После каждого шага проверить ошибки Bot API, задержку и возможность отката одним изменением флага.

## Не входит в решение

- импорт адресной книги Telegram;
- перенос Telegram deep-link в MAX или наоборот;
- изменение реферальной атрибуции;
- автоматическая миграция всех существующих сообщений на RichMessage;
- изменение production systemd/nginx/DNS.
