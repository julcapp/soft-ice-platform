# Bot Core — Telegram + MAX

Status: Foundation
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

## Deep-link context

Bot Core нормализует `start`/`startapp` контекст в единую модель независимо от канала.

Поддерживаемые сценарии foundation:

- `ref_<code>` — реферальное приглашение;
- `m_<machineId>` — QR конкретного аппарата;
- `campaign_<campaignId>` — маркетинговая кампания;
- `partner_<partnerId>` — партнёрский источник;
- direct/website/vk/telegram/max — источник без дополнительного идентификатора.

Deep-link payload не является доказательством реферального целевого действия. Он только фиксирует attribution context.

## Первый вход

Foundation flow:

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
Customer identity / onboarding (следующий инкремент)
```

Приветствие должно зависеть от контекста:

- direct;
- referral;
- machine QR;
- campaign/partner.

## Следующие инкременты

### Bot Core 1.1 — Identity + onboarding

- Telegram identity resolution;
- MAX identity verification/linking;
- единая bot session;
- приветствия по контексту;
- переход в Mini App на целевой экран;
- предложение подписаться на Telegram/MAX каналы после верификации;
- журналирование согласий и каналов.

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

## Ограничения foundation

Этот инкремент не меняет текущий рабочий Telegram bot для ЮKassa и не подключает production webhook. Токены Telegram/MAX и transport-specific HTTP logic добавляются только после интеграции Bot Core с runtime и проверок на тестовом контуре.
