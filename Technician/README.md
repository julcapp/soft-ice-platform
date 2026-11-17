# Technician — сервисный интерфейс техника Soft_ICE

**Точка входа:** `tehnik.utimoshi.ru`.  
**Назначение каталога:** собственные этапы и функциональная карта обслуживания без дублирования приложения.

## Ролевая модель

Принятое [ADR-050](../docs/architecture/ADR/ADR-050-unified-admin-console-entrypoints.md) закрепляет `SERVICE_SPECIALIST` как каноническую серверную роль технического специалиста. Доступ ограничивается назначенной организацией, точкой и оборудованием.

Адрес `tehnik.utimoshi.ru` использует ту же [Admin Console](../frontend/admin-console/), что AdminDesktop и Master; отдельный домен сам по себе **не даёт доступа**.

## Существующие исходники

- [Интерфейс обслуживания](../frontend/admin-console/src/Maintenance.jsx)
- [Обслуживание и диагностика](../backend/src/modules/maintenance/)
- [Сервисные операции](../backend/src/modules/operator_workspace/ServiceVisitService.js)
- [Мобильный сервисный API](../backend/src/api/v1/mobileServiceRoutes.js)
- [API сервисного рабочего места](../backend/src/api/v1/serviceWorkspaceRoutes.js)
- [Справочник API](../API/README.md)

## Учёт этапов

- [Первичная фиксация](stages/2026-11-17.md)
- Диагностика, осмотр, фотоотчёты и разрешённые проверки оборудования — только с серверной проверкой роли, назначения и аудитом действий
- Опасные команды и настройка аппарата требуют отдельного разрешения; не переносить тестовые кнопки в production без испытаний
