# Soft_ICE — единый навигатор по модулям

Рабочая структура в ветке `feature/module-layout-login-admin-20261117`. Git-монорепозиторий сохраняет общий backend, но интерфейсы теперь живут в собственных каталогах.

| Модуль | Исходники интерфейса | Назначение |
|---|---|---|
| [TimoPOS](TimoPOS/) | [TimoPOS/app](TimoPOS/app/) | Терминал продавца: первый экран [login.html](TimoPOS/app/login.html), кассовый автономный прототип v0.9, смены |
| [Display](Display/) | [Display/app/terminal](Display/app/terminal/) | Покупательский экран; использует общие зависимости [Mini App](frontend/miniapp/) |
| [AdminDesktop](AdminDesktop/) | [AdminDesktop/app](AdminDesktop/app/) | Единая React Admin Console, включая управление точками и продавцами TimoPOS |
| [Master](Master/) | [AdminDesktop/app](AdminDesktop/app/) | Ролевой профиль мастера в единой Admin Console |
| [Technician](Technician/) | [AdminDesktop/app](AdminDesktop/app/) | Ролевой профиль техника в единой Admin Console |
| [API](API/) | [backend/src/api/v1](backend/src/api/v1/) | HTTP-маршруты, общие контракты и [реестр API](API/MODULE_REGISTRY.md) |

## Правило владения кодом

- UI TimoPOS → `TimoPOS/app/`; UI Display → `Display/app/terminal/`; UI администратора и сервисных ролей → `AdminDesktop/app/`.
- Бизнес-логика и общий backend остаются в `backend/src/modules/` и `backend/src/api/`: **не копировать** их в папки интерфейсов.
- Display продолжает использовать общие файлы `frontend/miniapp/`. Не смешивать перенос терминальных компонентов с отдельным рефакторингом всего Mini App.
- Для Master и Technician **одна** сборка Admin Console. Авторизация и область доступа определяются сервером согласно [ADR-050](docs/architecture/ADR/ADR-050-unified-admin-console-entrypoints.md).
- Новые сервисные роли в экспериментальной политике TimoPOS требуют сверки с канонической RBAC, прежде чем их подключать к API.

## Учёт изменений

В каждом разделе ведётся `stages/` с коммитом, точными проверками, блокерами и условиями отката. Межмодульная интеграция: [TimoPOS/stages/2026-11-17-module-layout.md](TimoPOS/stages/2026-11-17-module-layout.md).

**Безопасность:** production, реальные платежи, фискализация и оборудование не меняются в этой ветке. Маршруты авторизации продавца и управления терминалами требуют явного серверного подключения после интеграционных испытаний.
