# API — точки продаж и журнал кодов

## Новые маршруты в изолированной ветке

Под защищённым `/api/v1/admin/timopos` (не активирован в production):
- `POST /organizations/:organizationId/points/initialize`: пять стартовых точек, режим 24/7
- `POST /organizations/:organizationId/points`: новая точка
- `PATCH /organizations/:organizationId/points/:pointId`: название, адрес, координаты, недельный график
- `POST /organizations/:organizationId/points/:pointId/sellers`: создание сотрудника OPERATOR, привязка к точке, аудит

Под защищённым `/api/v1/admin/verification` (не активирован в production):
- `GET /organizations/:organizationId/verification-events`: ограниченный журнал событий MAX/TimoPOS и связанных существующих AuditEvent
- `POST /organizations/:organizationId/verification-events/:challengeId/revoke`: отзыв ещё действующего кода с записью AuditEvent.

Существующие каналы Telegram, email и SMS в этой версии отображаются только при наличии соответствующих структурированных записей AuditEvent; единый registry всех отправителей пока не интегрирован. Секреты OTP и хеши не возвращаются.

Подключение зависимостей — только явно через timoPosAdminRuntime/verificationAdminRuntime. Реальное развёртывание не выполнялось.
