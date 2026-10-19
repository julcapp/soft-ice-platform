
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
