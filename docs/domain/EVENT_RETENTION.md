# Хранение событий

Foundation v1: информация — 30 дней, бизнес-событие — 365, предупреждение — 180, инцидент — 365, критическое — 3 года, аварийное — 5 лет. `EventTypeDefinition.retentionDays` переопределяет значение.

Платёжные, security/audit и официальные incident records требуют отдельной политики. Legal hold блокирует удаление. Удаление идемпотентно и создаёт `EventDeletionAudit`; активный автоматический job и production PostgreSQL adapter имеют статус `FOUNDATION_ONLY`.
