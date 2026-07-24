# API складского учёта, версия 1

Базовые маршруты: `/api/v1/inventory` и псевдоним Консоли администратора для чтения `/api/v1/admin/inventory`.

Все маршруты требуют аутентифицированного контекста администратора. Для изменений необходим `Idempotency-Key`; ответы содержат `correlation_id` и `idempotent_replay`.

| Метод | Маршрут | Назначение |
| --- | --- | --- |
| `GET` | `/items` | Получить определения складских позиций |
| `POST` | `/items` | Создать ингредиент, расходный или сервисный материал |
| `GET` | `/locations` | Получить места хранения на складах и в автоматах |
| `POST` | `/locations` | Создать место хранения |
| `GET` | `/balances?item_id=&location_id=` | Рассчитать текущие остатки |
| `GET` | `/movements?item_id=&location_id=&movement_type=` | Прочитать неизменяемый журнал |
| `POST` | `/movements` | Записать поступление, расход, тест, обслуживание, инвентаризацию или корректировку |
| `GET` | `/reservations?item_id=&location_id=&status=` | Прочитать резервы |
| `POST` | `/reservations` | Зарезервировать доступный остаток |
| `POST` | `/reservations/:id/consume` | Списать резерв и добавить движение |
| `POST` | `/reservations/:id/release` | Освободить резерв |

Пример движения:

```json
{
  "item_id": "ingredient_ice_cream_mix",
  "location_id": "machine_machine_01",
  "movement_type": "TEST_CONSUMPTION",
  "quantity": 0.12,
  "reason": "operator_test_run",
  "source_type": "MACHINE_OPERATIONS",
  "source_id": "test_run_01"
}
```

Основные коды ошибок: `VALIDATION_FAILED`, `IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_KEY_REUSED`, `RESOURCE_NOT_FOUND`, `INVENTORY_INSUFFICIENT_STOCK`, `INVENTORY_INSUFFICIENT_AVAILABLE_STOCK`, `INVENTORY_RESERVATION_TERMINAL`.
