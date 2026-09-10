# Machine / Dispense Runtime v1

## Владение

Runtime хранит durable `MachineDispenseAttempt`, callback Inbox, audit и reconciliation. Допустимые состояния: `CREATED → AUTHORIZED → QUEUED → DISPATCHING → SENT → ACCEPTED → DISPENSING → DISPENSED`; ветви `FAILED`, `TIMED_OUT`, `CANCELED`, `RECONCILIATION_REQUIRED` deny-by-default. `DISPATCHING` является PostgreSQL claim до внешнего side effect: конкурентный worker не вызывает provider, а crash/неизвестный результат переводится только в reconciliation без автоматической повторной выдачи.

Callback Inbox хранит immutable fingerprint факта и отклоняет повторный `providerEventId`, если изменены command, machine, status или payload. `(provider, providerCommandId)` уникален. PostgreSQL составными FK связывает callback с machine attempt и reservation с organization/machine/location/order/Sale Flow.

Обработка callback использует durable lease и монотонную `processingLeaseVersion` в `MachineCallbackInbox`. Незавершённый `PROCESSING` после истечения lease конкурентно reclaim-ится через PostgreSQL `FOR UPDATE SKIP LOCKED`; прежний owner после reclaim получает `MACHINE_CALLBACK_CLAIM_LOST`/no-op. Проверка ownership, physical result, Inventory/Order/Sale Flow/Outbox и Inbox finalization выполняются одной PostgreSQL-транзакцией. Replay завершает тот же Inbox и тот же attempt, не создавая новую physical command.

Успешный Payment в production composition атомарно переводит Sale Flow и создаёт `MachineDispenseAttempt` вместе с `MACHINE_COMMAND_QUEUED`. Отдельный Machine Command Worker выбирает только эти intent через существующий Transactional Outbox `FOR UPDATE SKIP LOCKED`. Crash после commit до send повторяет тот же intent и тот же `commandId`; crash после возможного send в `DISPATCHING` не вызывает provider повторно и создаёт reconciliation.

Machine Recovery Worker использует отдельный PostgreSQL lease. Он восстанавливает внутреннюю finalization/callback обработку или классифицирует неоднозначность. `QUEUED` принадлежит command worker; recovery никогда не создаёт новую physical command. Admin Console показывает provider event, terminal fact, retry/recovery counts и audit trail; действие «Классифицировать восстановление» не отправляет команду.

## Инварианты

- выдача разрешается только для authoritative `Payment=SUCCEEDED`, `Inventory=RESERVED`, допустимого Sale Flow и активного organization/location assignment;
- на пару organization/order/Sale Flow существует не более одной логической попытки и одного `commandId`;
- ACK не завершает продажу и не списывает Inventory;
- timeout не инициирует повторную физическую команду;
- один provider event обрабатывается один раз;
- неизвестный физический расход не вызывает автоматический release;
- внешний физический факт при внутренней ошибке направляется в reconciliation, а не в повтор выдачи.
- PostgreSQL CHECK запрещает `PROCESSING/PROCESSED/FAILED` callback без соответствующих temporal facts и `SENT/ACCEPTED/DISPENSING/DISPENSED/FAILED/TIMED_OUT` attempt без обязательных timestamps;
- `OPERATOR_TEST` и `MAINTENANCE_TEST` связывают idempotency также с reason и безопасным service context; customer Payment/Order/Loyalty для них отсутствуют.
- `OPERATOR_TEST` разрешён только server-authenticated активному участнику организации с ролью `OPERATOR` или `MACHINE_RESPONSIBLE`; `MAINTENANCE_TEST` — только с ролью `SERVICE_SPECIALIST`. Identity берётся из `securityContext`; payload actorId, roles, organizationMember и organizationId не могут подменить identity или tenant.

Health (`ONLINE/OFFLINE/DEGRADED/UNKNOWN`) и SIM/connectivity остаются отдельными read-only входами. `OPERATOR_TEST` и `MAINTENANCE_TEST` не являются customer sale, но используют Inventory test consumption.
