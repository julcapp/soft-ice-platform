# API рабочего места оператора v1

Базовый путь: `/api/v1/operator-workspace`.

Заголовки: `X-Operator-ID`, `X-Operator-Role`, `Idempotency-Key` для изменяющих запросов.

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/machines` | Назначенные автоматы |
| `GET` | `/machines/{machineId}` | Карточка автомата |
| `POST` | `/machines/{machineId}/sessions` | Начать обслуживание |
| `GET` | `/sessions/{sessionId}` | Состояние сессии |
| `PUT` | `/sessions/{sessionId}/checklist/{itemId}` | Отметить пункт |
| `POST` | `/sessions/{sessionId}/photos` | Добавить фото до/после |
| `POST` | `/sessions/{sessionId}/tests` | Зафиксировать тест |
| `POST` | `/sessions/{sessionId}/consumptions` | Списать материал |
| `POST` | `/sessions/{sessionId}/complete` | Завершить обслуживание |
| `GET` | `/actions` | Журнал действий |

Фото содержит `stage` (`BEFORE` или `AFTER`), `storage_key`, `content_type`, `checksum_sha256`, `captured_at`. Тест содержит `type` (`CUP`, `ICE_CREAM`, `SYRUP`) и `status`. Сервер запрещает сиропный тест автомату без сиропных линий.
