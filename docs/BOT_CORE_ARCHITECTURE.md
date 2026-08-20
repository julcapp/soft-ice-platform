# Bot Core — Telegram + MAX

Status: Foundation + Onboarding
Branch: `feature/bot-core-foundation`

## Назначение

Bot Core — единое серверное ядро коммуникационных сценариев «У Тимоши» для Telegram и MAX.

Бот не является копией Mini App. Его роль:

- первый вход и приветствие;
- идентификация пользователя и привязка канала к единому Customer;
- обработка QR/deep links и источника привлечения;
- быстрый доступ к Mini App;
- персональные уведомления;
- «Мой клуб»;
- «Пригласить друга»;
- информация о заказе;
- «Счётчик добра» и переходы в Good Deeds Core.

## Архитектурное правило

Telegram и MAX являются транспортными адаптерами. Бизнес-правила не должны находиться внутри Telegram/Max handlers.

```text
Telegram ─┐
          ├── Bot Core / Gateway ── Customer Core
MAX ──────┘             │              │
                        │              ├── Club Account
                        │              ├── Bonus
                        │              ├── Referral (planned)
                        │              ├── Orders
                        │              └── Good Deeds (planned)
                        └── Event Center
```

## Identity

Один человек должен иметь один внутренний Customer ID и несколько внешних идентичностей:

- phone;
- telegram;
- max;
- другие поддерживаемые каналы в будущем.

Существующий Customer Core уже является источником истины для внешних identity providers. Bot Core не создаёт собственную базу пользователей.

Telegram Customer может быть разрешён через существующий `resolveOrCreateTelegramCustomer`.

Для MAX действует более строгая граница: неподтверждённый `max user_id` не должен автоматически создавать второй Customer. До подключения MAX identity provider такой вход остаётся pending и после подтверждения должен либо привязаться к существующему Customer, либо безопасно создать нового без дублирования профиля.

## Deep-link context

Bot Core нормализует `start`/`startapp` контекст в единую модель независимо от канала.

Поддерживаемые сценарии foundation:

- `ref_<code>` — реферальное приглашение;
- `m_<machineId>` — QR конкретного аппарата;
- `campaign_<campaignId>` — маркетинговая кампания;
- `partner_<partnerId>` — партнёрский источник;
- direct/website/vk/telegram/max — источник без дополнительного идентификатора.

Deep-link payload не является доказательством реферального целевого действия. Он только фиксирует attribution context.

## Первый вход и onboarding

Текущий flow:

```text
/start
  ↓
TelegramAdapter / MaxAdapter
  ↓
нормализация входящего события
  ↓
DeepLinkParser
  ↓
BOT_START_RECEIVED
  ↓
BotOnboardingService
  ↓
контекстное приветствие
  ↓
Customer identity resolution
  ↓
phone verified?
  ├── нет → PHONE_VERIFICATION_REQUIRED
  └── да  → предложение каналов + персональное меню
```

Приветствие зависит от контекста:

- direct — общее приветствие «У Тимоши»;
- referral — сообщение о приглашении в Клуб Тимоши;
- machine QR — приветствие у конкретного аппарата;
- campaign — сообщение о специальном приглашении.

После успешной верификации подписка на Telegram/MAX предлагается добровольно. Бот не пытается принудительно подписывать пользователя. В onboarding предусмотрено действие «Напомнить позже».

Если вход пришёл от конкретного аппарата, кнопка открытия Mini App получает `machine_id` и ведёт в контекст этого аппарата.

## Персональное меню после верификации

- `📱 Открыть У Тимоши`;
- `🎁 Мой клуб`;
- `👥 Пригласить друга`;
- `📦 Мой заказ`;
- `📍 Где купить`;
- `💬 Помощь`.

Каталог, корзина и конфигуратор продукта остаются в Mini App и не дублируются внутри Bot Core.

## Следующие инкременты

### Bot Core 1.1 — Identity + onboarding

Foundation реализован:

- Telegram identity resolution через Customer Core;
- контекстные приветствия;
- состояние необходимости phone verification;
- добровольное предложение Telegram/MAX каналов после верификации;
- персональное меню;
- machine-aware Mini App route;
- onboarding events.

Остаётся до production:

- MAX verified identity provider;
- runtime/webhook wiring;
- реальная проверка подписки, где это разрешает API;
- журналирование выбора каналов и соответствующих согласий.

### Bot Core 1.2 — Referral Core

- персональный referral code;
- «Пригласить друга»;
- первая покупка или квалифицирующее пополнение клубного счёта как target action;
- защита от self-referral и повторного reward;
- аналитика referral funnel.

### Bot Core 1.3 — Welcome Bonus

- отдельный promo balance;
- срок действия 30 дней;
- qualifying events: реферал либо повторное квалифицирующее пополнение;
- автоматическое истечение по правилам программы.

### Bot Core 1.4 — Good Deeds / «Счётчик добра»

- добровольный вклад;
- личный вклад благотворителя;
- «Стать благотворителем»;
- «Стать партнёром добрых дел»;
- детские Gift Token;
- групповая выдача через уполномоченного представителя;
- VEND SUCCESS как единственный триггер увеличения «Счётчика добра»;
- фотоотчёт, модерация и публикационные права;
- «Резерв Тимоши»;
- отдельный PARTNER_REWARD ответственному представителю после принятия отчёта;
- полный складской и финансовый учёт подарочных порций через Recipe/Inventory.

## Ограничения текущего инкремента

Инкремент не меняет текущий рабочий Telegram bot для ЮKassa и не подключает production webhook. Токены Telegram/MAX и transport-specific HTTP logic добавляются только после интеграции Bot Core с runtime и проверок на тестовом контуре.
