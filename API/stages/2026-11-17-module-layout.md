# API — изменения для связки TimoPOS / AdminDesktop

В ветке `feature/module-layout-login-admin-20261117` создан `backend/src/api/v1/timoPosAdminRoutes.js` и добавлено **условное** подключение `/api/v1/admin/timopos` только при наличии `dependencies.timoPosAdminRuntime`.

- GET `/organizations/:organizationId/points` — данные точек, терминалов и назначений
- PUT `/organizations/:organizationId/points/:pointId/sellers/:sellerId` — назначить / отозвать продавца (`active`)
- POST `/organizations/:organizationId/points/:pointId/terminals` — зарегистрировать терминал
- Все операции требуют подлинную админ-сессию и scope организации; изменения идут в PostgreSQL-транзакции с AuditEvent. Реальные операции не включены
- Изолированные HTTP-тесты на моках: 4/4; PostgreSQL интеграция ещё не проверена

**Примечание:** рабочие backend и API-серверы не перезапускались; API не опубликован.
