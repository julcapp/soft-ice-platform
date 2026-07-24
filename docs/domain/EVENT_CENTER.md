# Центр событий

Статус: Foundation v1

Центр событий — bounded context долговременной регистрации, нормализации, поиска и отображения событий платформы. Он не заменяет Platform Event Bus, не является application log и не переводит платформу на event sourcing. Текущее состояние остаётся в доменных моделях; `EventRecord` хранит неизменяемый исторический факт.

## Модель

Запись содержит tenant/organization scope, код и версию, категорию, важность, источник, основной субъект, actor, доменные ссылки, `correlationId`, `causationId`, `traceId`, русские `title`/`summary`, временные метки, очищенный payload и retention. Состояние обработки, подтверждения, комментарии, теги, evidence и legal hold хранятся отдельно.

Активный repository v1 — in-memory. Prisma и PostgreSQL adapter contract являются durable target со статусом `FOUNDATION_ONLY`.

## Использование

События предназначены для истории, расследований, интеграций, уведомлений и аналитики. Event Intelligence должен в будущем читать нормализованные записи, а не доменные таблицы; статус слоя — `PLANNED`.
