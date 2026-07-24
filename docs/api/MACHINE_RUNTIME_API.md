# API контура управления автоматами для администратора, версия 1

Все маршруты требуют аутентификации, доступны только для чтения и только ролям `PLATFORM_OWNER` и `ADMIN`:

- `GET /api/v1/admin/machine-runtime`
- `GET /api/v1/admin/machine-runtime/:machineId`
- `GET /api/v1/admin/machine-runtime/:machineId/session`
- `GET /api/v1/admin/machine-runtime/:machineId/transitions`

Ответы содержат статусы `READ_ONLY` и `IN_MEMORY_FOUNDATION`. Роли `SUPPORT` и `READ_ONLY_AUDITOR` зарезервированы для будущей политики фильтрации. Маршрутов изменения данных и дистанционного управления нет.
