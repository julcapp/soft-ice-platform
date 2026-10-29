## 2026-10-29 — Live customer bonuses and identity release

- CRM user list/card uses the persisted BonusAccount.balanceBonus value as the authoritative bonus balance.
- Added audited manual bonus adjustments through POST /api/v1/admin/crm/customers/:customerId/bonus-adjustments; adjustments create immutable BonusTransaction rows instead of rewriting history.
- Added POST /api/v1/admin/crm/customers/:customerId/erase-and-release for profile removal and identifier release. It revokes sessions, removes active identity/channel bindings, clears phone/email/Telegram/VK profile fields, resets bonus balance and marks the retained technical customer shell as deleted_released.
- Financial, order, fiscal and audit history is intentionally retained against the anonymized technical customer id; released phone/email/channel identifiers can be used for a new registration.
- Added authenticated terminal lookup POST /api/v1/terminal/customers/by-phone protected by TERMINAL_API_TOKEN. The response exposes only the returning-customer projection required by the vending UI, including the live bonus_balance value.
- Added terminal frontend lookup client. The deployed display.utimoshi.ru screen still requires deployment wiring once server access is restored.

## 2026-10-29 — Admin Console LIVE mode

- Админ-панель переведена из общей маркировки READ_ONLY/DEMO в рабочий режим LIVE.
- Доступ к dashboard теперь разрешается для любого подтверждённого permission scope, кроме DENIED; режим больше не требует строго READ_ONLY.
- Навигация и заголовки разделов обозначают боевой контур, а production-переменные VITE_ADMIN_ROLE / VITE_ORGANIZATION_ID имеют приоритет над legacy demo-переменными.
- Раздел «Экономика продукта» добавлен в боевую консоль: упаковка 6 ₽/шт., минимальная партия 3000 шт., минимальная закупка 18000 ₽; zhuQ default 120 г, допустимый диапазон 85–120 г, guoQ 40 г, dingQ 20 г.
- Сохраняются защитные инварианты: платёж должен быть подтверждён до выдачи; опасный повтор reqShip запрещён; machine dispense recovery остаётся classify-only; неизменяемые журналы и аудит не редактируются.
- Разделы, для которых backend уже содержит mutation API (CRM, inventory, maintenance, organizations), считаются готовыми к последовательному включению UI-операций с аудитом. Разделы без подтверждённого write API не получают декоративных или небезопасных кнопок.


# CHANGELOG

## 2026-10-19

### Уточнена интеграция TCN Vending SDK

Поставщик окончательно подтвердил правило для поставленной машины:

```text
zhuliao = 0
```

Другие значения `zhuliao` считаются недопустимыми для этой конфигурации.

Обновлён `docs/integrations/TCN_VENDING_SDK.md`:

* противоречие по `zhuliao` снято;
* `zhuliao = 0` зафиксирован как обязательное production-значение;
* адаптер должен отклонять любое `zhuliao != 0` до вызова SDK;
* параметр не должен быть пользовательской или администраторской настройкой рецепта;
* старые примеры поставщика с `zhuliao = 1` признаны неприменимыми к нашей машине;
* `zhuliao` удалён из списка production blockers.

Backend-код не изменялся: hardware adapter ещё не реализован, а текущая серверная модель выдачи уже соответствует безопасной схеме Payment `SUCCEEDED` → machine command → подтверждённый физический результат.

### Зафиксирована интеграция TCN Vending SDK

Добавлен `docs/integrations/TCN_VENDING_SDK.md`.

Зафиксированы:

* подтверждённая 9-параметровая сигнатура `TcnVendIF.getInstance().reqShip(...)`;
* публичный путь инициализации `SerialPortSetting` + `reqSlotNoInfoOpenSerialPort()`;
* требование уникального `tradeNo`;
* безопасная политика: неизвестный исход физической выдачи не допускает автоматического повторного `reqShip`;
* соответствие текущей backend-модели `RECONCILIATION_REQUIRED` рекомендациям по безопасному recovery;
* известные selector-комбинации `guojiang`;
* список блокирующих противоречий и уточнений поставщику.

Production hardware adapter оставлен заблокированным до разрешения оставшихся противоречий по единицам `zhuQ/dingQ/guoQ`, mixed dispensing, физической карте контейнеров, `slotNo/shipMethod`, serial settings, terminal success callback и duplicate-command behavior.

Исходный backend-код не изменялся: существующие idempotency/reconciliation safeguards соответствуют безопасной архитектуре.

## 2026-06-24

### Добавлена модель Payment

Создана таблица Payment.

Назначение:

* учет платежей клиентов;
* интеграция ЮKassa;
* учет статусов оплаты;
* хранение идентификаторов платежной системы;
* контроль пополнения клубного счета.

Статусы:

* pending
* waiting_for_capture
* succeeded
* canceled
* failed

Миграция:

add_payment_model

Результат:

Таблица Payment успешно создана в PostgreSQL.
