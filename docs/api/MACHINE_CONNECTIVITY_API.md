# API связи автомата

Маршруты `/api/v1/admin/machines/:machineId` требуют `PLATFORM_OWNER` или `ADMIN`.

- `GET /connectivity`, `/sim-card`, `/mobile-plan`, `/connectivity/history`
- `POST|PATCH /sim-card/manual`
- `POST|PATCH /mobile-plan/manual`

Оператор рабочего места не имеет mutation-доступа. Технические идентификаторы скрываются без отдельного разрешения.
