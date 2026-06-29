# Analytics Events Domain Model

Статус: Draft  
Версия: 0.1  
Проект: Soft ICE Platform / бренд «У Тимоши»

## 1. Назначение

Документ описывает событийную модель аналитики Soft ICE Platform.

Цель — собирать статистику поведения пользователей, клиентов, продавцов, автоматов и системных процессов без смешивания аналитики с бизнес-логикой.

## 2. Главный принцип

> Всё значимое действие в системе оформляется как событие.

Событие должно быть:

- минимальным;
- структурированным;
- привязанным ко времени;
- привязанным к источнику;
- по возможности не содержать лишних персональных данных.

## 3. Базовая структура события

```json
{
  "event_id": "uuid",
  "event_name": "MiniAppOpened",
  "occurred_at": "2026-06-26T12:00:00Z",
  "source": "telegram_mini_app",
  "actor_type": "customer",
  "actor_id": "customer_123",
  "anonymous_user_id": "anon_456",
  "session_id": "session_789",
  "context": {
    "utm_source": "telegram",
    "entry_point": "bot_menu",
    "device_type": "mobile"
  },
  "payload": {}
}
```

## 4. Источники событий

| Source | Описание |
|---|---|
| `landing` | лендинги и публичный сайт |
| `web_app` | веб-приложение |
| `telegram_bot` | Telegram-бот |
| `telegram_mini_app` | Telegram Mini App |
| `max_mini_app` | MAX Mini App |
| `vk_mini_app` | VK Mini App |
| `terminal` | вендинговый терминал |
| `seller_app` | приложение продавца |
| `crm` | CRM / админ-панель |
| `backend` | backend-события |
| `payment_provider` | платёжные провайдеры |
| `machine_controller` | контроллер автомата |

## 5. Категории событий

## 5.1 Consent Events

| Event | Описание |
|---|---|
| `CookieConsentShown` | показан баннер cookie |
| `CookieConsentAcceptedNecessary` | приняты только обязательные cookie |
| `CookieConsentAcceptedAll` | приняты все cookie |
| `CookieConsentCustomized` | пользователь настроил категории |
| `ConsentRevoked` | согласие отозвано |
| `ConsentVersionChanged` | изменилась версия политики |

## 5.2 Entry Events

| Event | Описание |
|---|---|
| `LandingVisited` | пользователь открыл лендинг |
| `DeepLinkOpened` | открыт deep link |
| `QrCodeScanned` | отсканирован QR-код |
| `NfcTagOpened` | открыт NFC-тег |
| `ReferralLinkOpened` | открыта реферальная ссылка |
| `TelegramBotStarted` | пользователь нажал START в Telegram |
| `MiniAppOpened` | открыт Mini App |

## 5.3 Product Events

| Event | Описание |
|---|---|
| `ProductViewed` | просмотр карточки продукта |
| `ProductSelected` | выбран продукт |
| `FlavorOfDayViewed` | показан вкус дня |
| `SyrupSelected` | выбран сироп |
| `ToppingSelected` | выбран топпинг |
| `OrderPreviewShown` | показана проверка заказа |

## 5.4 Order Events

| Event | Описание |
|---|---|
| `OrderStarted` | начат заказ |
| `OrderConfirmed` | заказ подтверждён |
| `OrderCancelled` | заказ отменён |
| `OrderExpired` | заказ истёк |
| `PrepaidOrderCreated` | создан предоплаченный заказ |
| `PrepaidOrderRedeemed` | предоплаченный заказ получен |
| `PrepaidOrderRefunded` | деньги возвращены за неиспользованный заказ |

## 5.5 Payment Events

| Event | Описание |
|---|---|
| `PaymentStarted` | начат платёж |
| `PaymentMethodSelected` | выбран способ оплаты |
| `PaymentSuccess` | успешная оплата |
| `PaymentFailed` | ошибка оплаты |
| `PaymentCancelled` | платёж отменён |
| `FiscalReceiptGenerated` | сформирован фискальный чек |
| `FiscalReceiptQrShown` | показан QR фискального чека |
| `ReceiptPhoneRequested` | пользователь запросил чек на телефон |

## 5.6 Loyalty Events

| Event | Описание |
|---|---|
| `ClubOfferShown` | показано предложение Клуба Тимоши |
| `ClubJoinStarted` | начат сценарий вступления в клуб |
| `ClubJoined` | пользователь вступил в клуб |
| `BonusAccrued` | начислены бонусы |
| `BonusSpent` | списаны бонусы |
| `TrustedCustomerAchieved` | получен статус доверенного клиента |
| `BirthdayRewardIssued` | выдан подарок на день рождения |

## 5.7 Identity Events

| Event | Описание |
|---|---|
| `PhoneInputStarted` | открыт ввод телефона |
| `PhoneVerificationStarted` | начата верификация телефона |
| `PhoneVerificationCodeSent` | отправлен код или обратный звонок |
| `PhoneVerificationSucceeded` | телефон подтверждён |
| `PhoneVerificationFailed` | телефон не подтверждён |
| `IdentityLinked` | связана новая identity |
| `TelegramIdentityLinked` | связан Telegram ID |
| `MaxIdentityLinked` | связан MAX ID |

## 5.8 Machine Events

| Event | Описание |
|---|---|
| `MachineReady` | аппарат готов |
| `MachineOutOfStock` | закончился ключевой ресурс |
| `PreparationStarted` | начато приготовление |
| `IceCreamDispensed` | выдано мороженое |
| `SyrupDispensed` | добавлен сироп |
| `ToppingDispensed` | добавлен топпинг |
| `ProductReady` | продукт готов |
| `DoorOpened` | дверца открыта |
| `DoorClosed` | дверца закрыта |
| `ProductTaken` | продукт забран |
| `CleaningStarted` | началась очистка |
| `CleaningFinished` | очистка завершена |
| `MachineError` | ошибка аппарата |

## 5.9 Seller / Operations Events

| Event | Описание |
|---|---|
| `ShiftOpened` | продавец открыл смену |
| `ShiftClosed` | продавец закрыл смену |
| `PointOpened` | точка открылась на карте |
| `PointClosed` | точка закрылась |
| `ChecklistStarted` | начат чек-лист |
| `ChecklistStepCompleted` | шаг чек-листа выполнен |
| `ChecklistCompleted` | чек-лист завершён |
| `ViolationDetected` | выявлено нарушение регламента |

## 6. Правила privacy-by-design

1. События не должны содержать лишние персональные данные.
2. Номер телефона не пишется в payload в открытом виде без необходимости.
3. Для аналитики использовать `customer_id`, `anonymous_user_id`, `session_id`.
4. Сырые технические логи отделяются от продуктовой аналитики.
5. Маркетинговые события создаются только при наличии соответствующего согласия.

## 7. Связанные документы

- `docs/privacy/COOKIE_AND_TRACKING_POLICY.md`
- `docs/domain/CONSENT_MODEL.md`
- `docs/WORKING_DECISIONS_CURRENT.md`
