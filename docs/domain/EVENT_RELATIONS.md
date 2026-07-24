# Связи событий

Основной субъект задаётся парой `subjectType` + `subjectId`. Дополнительные объекты связываются через `EventRelation` типами `CAUSED_BY`, `RELATED_TO`, `GENERATED_BY`, `AFFECTS`, `EVIDENCE_FOR`, `PART_OF`, `PRECEDED_BY`, `FOLLOWED_BY`, `RESOLVED_BY`.

`correlationId` объединяет одну бизнес-операцию. `causationId` указывает непосредственное событие-причину, `traceId` связывает технический trace. Evidence хранится только безопасной ссылкой на объект другого домена или storage reference; файлов и публичных ссылок в Event Center нет.
