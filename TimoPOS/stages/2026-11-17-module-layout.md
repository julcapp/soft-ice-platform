# TimoPOS — перенос и первый экран авторизации

**Ветка:** `feature/module-layout-login-admin-20261117`.

- `git mv frontend/timopos TimoPOS/app`: сохранена история Git
- Добавлен [login.html](../app/login.html): ввод телефона, MAX-OTP, session-check/logout, отказ в отправке локальных файлов, тройное нажатие открывает защищённую демонстрационную форму
- Подготовлены административные маршруты назначения сотрудников и регистрации терминала в `backend/src/api/v1/timoPosAdminRoutes.js`; транзакционная запись аудита, проверка роли и организации
- Сторона администратора: `AdminDesktop/app/src/TimoPosWorkstations.jsx`
- Тесты первого экрана локально проверяют отсутствие отправки с `file://` и вызов сервисного окна
- Выборочные тесты TimoPOS/backend/авторизации: 69/69 прошли; тесты AdminDesktop: 39/39. Два старых теста DisplayRecognitionApi остаются падающими и на исходной версии, см. Display/stages.
- Комплексные реальные интеграционные проверки PostgreSQL, MAX-бота, TLS, KKT, платежей и устройства **не выполнены**

**Порядок продолжения:** isolated PostgreSQL → миграции/seed точки 001 → MAX identity onboarding → server runtime + limiter → тестовые сессии и админ назначения → сканер/ККТ/платежный sandbox → релиз и rollback.
