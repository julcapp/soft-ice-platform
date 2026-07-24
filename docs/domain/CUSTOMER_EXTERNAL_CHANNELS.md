# Внешние каналы Customer 360

Статус: реализовано, версия 1.

Customer 360 агрегирует внешние профили, подписки и ссылки на согласия, но не объединяет эти факты. Consent Core остаётся владельцем юридических решений. Фактическую подписку подтверждает внешний канал через официальный API; ручная запись всегда имеет `source=MANUAL` и не считается внешне подтверждённой.

Поддерживаются `VK`, `TELEGRAM`, `MAX`, `EMAIL`, `PHONE`, `PUSH`, `OTHER`. Цели подписки: `COMMUNITY`, `CHANNEL`, `CHAT`, `BOT`, `NEWSLETTER`, `OTHER`. Модель включает `CustomerExternalChannel`, `CustomerExternalProfile`, `CustomerChannelSubscription`, `CustomerChannelVerification`, `CustomerCommunicationPermission`.

VK поддерживает VK ID, ссылку, имя, аватар, статус проверки, подписку на сообщество «У Тимоши», даты проверки/подписки/отписки, источник и ссылку на согласие. `ManualVkExternalChannelAdapter` и `MockVkExternalChannelAdapter` готовы; официальный адаптер имеет статус `BLOCKED_EXTERNAL`.

`CustomerEngagementSummary` — read-only детерминированная проекция 0–100. Каждый из 12 факторов возвращает объяснение, вклад и максимум; машинное обучение не используется.
