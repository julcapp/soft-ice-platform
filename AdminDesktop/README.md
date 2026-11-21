# AdminDesktop — единая панель администратора Soft_ICE

**Домен:** `admin.utimoshi.ru`; **исходники:** [AdminDesktop/app](app/); сборка React/Vite.

## Разделы

- [Главное приложение](app/src/App.jsx) и [навигация](app/src/components/index.jsx)
- [Точки и продавцы TimoPOS](app/src/TimoPosWorkstations.jsx): выбор организации/точки/сотрудника, регистрация терминала, назначение и отзыв допуска продавца
- [Организации и роли](app/src/Organizations.jsx)
- [API назначений TimoPOS](../backend/src/api/v1/timoPosAdminRoutes.js)
- [История переноса и проверок](stages/2026-11-17-module-layout.md)

## Архитектура

`admin.utimoshi.ru`, `master.utimoshi.ru` и `tehnik.utimoshi.ru` используют единую Admin Console согласно [ADR-050](../docs/architecture/ADR/ADR-050-unified-admin-console-entrypoints.md). Поддомены не повышают полномочия.

**Состояние:** перенос исходников и локальная сборка проверены, рабочий сервер не обновлялся. API назначений требует серверной авторизации, настроенной PostgreSQL и обязательного аудита; production-маршрут пока не активирован.
