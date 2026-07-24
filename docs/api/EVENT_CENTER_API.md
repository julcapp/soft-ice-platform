# API Центра событий v1

Префикс: `/api/v1/admin`.

Read API: `/events`, `/events/:eventId`, дочерние `/relations`, `/evidence`, `/comments`, `/events/correlation/:correlationId`, `/event-types`, object-scoped machine/customer/organization/video-incident feeds и `/events/statistics`.

Mutation API: подтверждение, комментарии, processing state, теги и legal hold. `EventRecord` не имеет update API. `/events/export` возвращает ограниченный CSV/JSON без raw payload и пишет аудит. Внутренний `/internal/events` принимает нормализуемое событие.

Фильтры: период, категория, важность, код, домен, субъект, автомат, клиент, корреляция, status, acknowledgement, tag, text, cursor и limit. Сортировка по умолчанию — `occurredAt DESC`.

Raw payload доступен только с `event_center.view_payload` и всегда проходит sanitization.
