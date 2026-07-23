# Consent Privacy Core v1

Status: Implemented  
Version: 1.0  
Updated: 2026-07-21

## Runtime contract

Consent Privacy Core is the source of truth for authenticated customer consent decisions. Each decision is an immutable `CustomerConsent` record linked to canonical `customer_id` and a versioned `DocumentVersion`. Repeated delivery can use `decision_id`; the same ID with different facts is rejected.

Canonical v1 consent types are `PERSONAL_DATA`, `MARKETING`, `ADVERTISING`, `PARTNER_OFFERS`, and `PHOTO_USAGE`. Canonical source channels are `TELEGRAM`, `MINI_APP`, `MACHINE`, and `WEBSITE`. The backend records the authoritative `consented_at` timestamp. A negative decision is appended with `is_granted = false` and `revoked_at`; history is never overwritten.

Authenticated API:

- `POST /api/v1/customers/me/consents` appends a decision;
- `GET /api/v1/customers/me/consents` returns complete customer history;
- `/api/v1/customers/me/consent-decisions` remains a compatibility alias.

`ADVERTISING` is only a consent classification in v1. This increment does not implement advertising, profiling, targeting, campaign selection, partner delivery, or outbound communication.

## Legacy draft reference

Статус: Draft  
Версия: 0.1  
Проект: Soft ICE Platform / бренд «У Тимоши»

## 1. Назначение

Consent Model описывает, как Soft ICE Platform получает, хранит, проверяет и отзывает согласия пользователя.

Согласия нужны для:

- обработки персональных данных;
- cookie и аналитики;
- маркетинговых коммуникаций;
- email / SMS / Telegram / MAX / VK рассылок;
- фото-челленджа;
- участия в Клубе Тимоши;
- связи anonymous_user_id с customer_id.

## 2. Главный принцип

> Backend consent record является источником истины. Cookie хранит только технический идентификатор и версию согласия.

## 3. Типы согласий

| Consent Type | Описание |
|---|---|
| `necessary_cookies` | обязательные cookie |
| `analytics_cookies` | аналитические cookie |
| `personalization_cookies` | персонализация интерфейса |
| `marketing_cookies` | реклама и ретаргетинг |
| `personal_data_processing` | обработка персональных данных |
| `marketing_communications` | рекламные материалы |
| `transactional_communications` | сервисные уведомления |
| `photo_processing` | обработка фото для челленджа |
| `location_processing` | обработка геолокации |
| `loyalty_terms_acceptance` | правила Клуба Тимоши |
| `referral_program_terms` | правила реферальной программы |

## 4. Статусы согласия

| Status | Описание |
|---|---|
| `granted` | согласие предоставлено |
| `denied` | пользователь отказался |
| `revoked` | согласие отозвано |
| `expired` | срок действия истёк |
| `superseded` | заменено новой версией |

## 5. Каналы получения согласия

| Channel | Описание |
|---|---|
| `website` | сайт / лендинг |
| `web_app` | Web App |
| `telegram_bot` | Telegram-бот |
| `telegram_mini_app` | Telegram Mini App |
| `max_mini_app` | MAX Mini App |
| `vk_mini_app` | VK Mini App |
| `terminal` | вендинговый терминал |
| `seller_app` | приложение продавца |
| `crm` | оператор CRM |

## 6. Consent Record

Базовая структура записи:

```json
{
  "consent_id": "uuid",
  "customer_id": "customer_123",
  "anonymous_user_id": "anon_456",
  "consent_type": "analytics_cookies",
  "status": "granted",
  "version": "2026-06-26.v1",
  "channel": "telegram_mini_app",
  "source": "cookie_banner",
  "granted_at": "2026-06-26T12:00:00Z",
  "revoked_at": null,
  "ip_hash": "hash",
  "user_agent_hash": "hash",
  "evidence": {
    "screen": "CookieBanner",
    "button": "AcceptAll"
  }
}
```

## 7. Consent Versioning

Каждая политика имеет версию.

Пример:

```text
2026-06-26.v1
```

Если политика меняется существенно, создаётся новая версия, а пользователю может быть повторно показан экран согласия.

## 8. Consent Evidence

Для каждого согласия фиксируется доказательство:

- где показали согласие;
- какой текст/версия политики действовали;
- какую кнопку нажал пользователь;
- дата и время;
- канал;
- технические признаки запроса;
- связанный customer_id или anonymous_user_id.

## 9. Связь с Customer Identity

До идентификации пользователя согласия могут быть связаны с `anonymous_user_id`.

После подтверждения телефона, Telegram ID, MAX ID или другого identity-канала согласия могут быть связаны с `customer_id`.

Правило:

> Связка должна сохранять историю происхождения согласия. Нельзя просто перезаписать anonymous consent без аудита.

## 10. Отзыв согласия

Пользователь должен иметь возможность отозвать согласия.

После отзыва:

- новые аналитические события не должны собираться сверх необходимого;
- маркетинговые cookie должны быть удалены или отключены;
- маркетинговые коммуникации должны быть прекращены;
- в истории остаётся audit record об отзыве.

## 11. Минимальные согласия для сценариев

| Сценарий | Требуемые согласия |
|---|---|
| Быстрая покупка без клуба | necessary_cookies / transactional processing |
| Получить чек на телефон | personal_data_processing, transactional_communications |
| Вступить в Клуб Тимоши | personal_data_processing, loyalty_terms_acceptance |
| Получать акции | marketing_communications |
| Аналитика поведения | analytics_cookies |
| Персональные предложения | personalization_cookies, marketing_communications |
| Фото-челлендж | photo_processing, personal_data_processing |
| Геолокация ближайшей точки | location_processing |

## 12. События согласий

Согласия порождают события:

- `CookieConsentShown`;
- `CookieConsentAcceptedNecessary`;
- `CookieConsentAcceptedAll`;
- `CookieConsentCustomized`;
- `ConsentGranted`;
- `ConsentDenied`;
- `ConsentRevoked`;
- `ConsentExpired`;
- `ConsentVersionChanged`.

## 13. Privacy-by-design правила

1. Не собирать больше данных, чем требуется для сценария.
2. Не включать маркетинг по умолчанию.
3. Разделять сервисные уведомления и рекламные коммуникации.
4. Хранить доказательства согласий.
5. Не полагаться только на cookie для юридически значимого согласия.
6. Обеспечить отзыв согласия.
7. Не смешивать техническую аналитику и маркетинговое отслеживание.

## 14. Связанные документы

- `docs/privacy/COOKIE_AND_TRACKING_POLICY.md`
- `docs/domain/ANALYTICS_EVENTS.md`
- `docs/telegram_bot.md`
- `docs/integrations/YOOKASSA.md`
