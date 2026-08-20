# Bot Core — Telegram + MAX

Status: Foundation + onboarding + referral persistence + welcome bonus
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
                        │              ├── Referral
                        │              ├── Welcome Bonus
                        │              ├── Orders
                        │              └── Good Deeds (planned)
                        └── Event Center
```

## Identity

Один человек должен иметь один внутренний Customer ID и несколько внешних идентичностей: phone, telegram, max и другие каналы в будущем. Bot Core не создаёт собственную базу пользователей.

## Deep-link context

Поддерживаются `ref_<code>`, `m_<machineId>`, `campaign_<campaignId>`, `partner_<partnerId>` и direct/website/vk/telegram/max. Deep-link фиксирует attribution context, но не является доказательством реферального целевого действия.

## Referral Core

Реферальная связь закрепляется после разрешения реального Customer. Состояния:

```text
invited → registered → qualified → rewarded
```

Квалифицирующие действия:

- первая оплаченная покупка;
- квалифицирующее пополнение клубного счёта.

Self-referral запрещён. Повторная квалификация не создаёт повторное право на reward. Отдельная `ReferralQualification` хранит qualifying action и source event, а существующая `Referral` остаётся основной сущностью связи.

Раздел «Пригласить друга» показывает: приглашено, зарегистрировано, первая покупка, квалифицирующее пополнение, ожидают выполнения условия, rewarded; доступны Telegram, MAX, копирование ссылки и QR.

## Reward Engine

Referral Reward Engine не хранит деньги и не меняет Club Account напрямую. Он оркестрирует начисления через отдельный Bonus Ledger contract с idempotency key на пару `referral + получатель`. Это исключает двойное начисление при повторной доставке события.

## Welcome Bonus

`welcome_bonus` — отдельный промо-баланс и не является:

- денежным остатком Club Account;
- обычным BonusAccount.

Grant хранит `amountGranted`, `amountRemaining`, `issuedAt`, `expiresAt`, status и qualifying event. Базовый срок — 30 дней.

Qualifying events, сохраняющие бонус от автоматического сгорания:

- `referral_qualified` — пользователь привёл квалифицированного реферала;
- `repeat_club_topup` — пользователь повторно квалифицирующе пополнил клубный счёт.

Если qualifying event не наступил до `expiresAt`, grant получает `EXPIRED`, `amountRemaining = 0`, и событие `WELCOME_BONUS_EXPIRED` уходит в Event Center. Денежный баланс и обычные бонусы при этом не затрагиваются.

## MAX

MAX identity разрешается только после подтверждённой верификации. По одному неподтверждённому MAX user_id второй Customer не создаётся.

## Good Deeds / «Счётчик добра» — следующий крупный контур

Планируются: добровольный вклад, личный вклад благотворителя, «Стать благотворителем», «Стать партнёром добрых дел», детские Gift Token, групповая выдача, `VEND SUCCESS` как единственный триггер «Счётчика добра», фотоотчёт/модерация, «Резерв Тимоши», PARTNER_REWARD и полный складской/финансовый учёт подарочных порций.

## Ограничения текущего инкремента

Текущий рабочий Telegram bot для ЮKassa не изменяется. Production webhook/tokens не подключены. Миграция добавляет persistence-таблицы, но `schema.prisma` пока намеренно не расширен моделями `ReferralQualification`/`WelcomeBonusGrant`: репозитории используют фиксированные SQL-запросы. Перед production это следует синхронизировать с Prisma schema и прогнать `prisma validate/migrate` в рабочем окружении.
