
# CHANGELOG

## 2026-10-19

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

Production hardware adapter оставлен заблокированным до разрешения противоречий по единицам `zhuQ/dingQ/guoQ`, `zhuliao`, mixed dispensing, физической карте контейнеров, serial settings, terminal success callback и duplicate-command behavior.

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
