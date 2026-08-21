# ADR-043 — Inventory Reservation & Locking v1

Статус: Accepted
Дата: 2026-08-21

## Контекст

Inventory Runtime уже владеет остатками, движениями и резервами, но in-memory реализация и резерв одной позиции не защищают несколько backend instances от over-reservation.

## Решение

Inventory остаётся единственным source of truth. Для каждой позиции аппарата хранится `physicalQuantity` и `activeReservedQuantity`; доступно `physicalQuantity - activeReservedQuantity`. Команда резерва в одной PostgreSQL transaction блокирует требуемые строки `InventoryRuntimeStock` через `SELECT ... FOR UPDATE` в стабильном порядке, проверяет все позиции, создаёт агрегат и items, меняет reserved quantity и пишет события в существующий Transactional Outbox.

Pessimistic row locking выбран потому, что решение зависит от нескольких строк и должно работать между процессами. `version` сохраняется для аудита изменений и будущего optimistic API, но не является основной защитой от oversell. DB `CHECK` дополнительно запрещает отрицательный остаток, `activeReservedQuantity > physicalQuantity`, неположительный item quantity, `reservedQuantity > quantity` и `consumedQuantity + releasedQuantity > reservedQuantity`.

Lifecycle: `PENDING → RESERVED → CONSUMED | RELEASED | EXPIRED`; недостаток переводит созданный агрегат в `FAILED`. Терминальные команды идемпотентны. `CONSUMED` один раз уменьшает физический остаток и создаёт движение `CONSUMPTION` либо `TEST_CONSUMPTION`.

Production Sale Flow получает только PostgreSQL Inventory adapter. Reserve, reservation items, stock mutation, создание Sale Flow, persistent idempotency marker и события существующего Transactional Outbox фиксируются одним Prisma transaction client. Ошибка любого шага откатывает весь переход; production fallback на legacy in-memory Inventory запрещён. Sale Flow хранит только `inventoryReservationReference`.

Production composition явно подключает PostgreSQL Organization context, существующий Order Runtime и Product Engine Pricing. Фабрика composition отклоняет отсутствующую либо test/fake dependency до запуска recovery или бизнес-транзакции. Цена вычисляется Product Engine из серверно проверяемых Product, Configuration и Recipe; переданный клиентом итог не используется.

Migration `20260821000100_inventory_reservation_locking_v1` на момент исправления оставалась новым неопубликованным файлом рабочего дерева (`git status: ??`). Поэтому quantity invariant добавлен в неё до публикации; исторические опубликованные migrations не менялись и новая migration только ради имени не создавалась.

## Последствия

- Несколько backend instances сериализуют конфликтующие резервы на уровне PostgreSQL.
- Ошибка Outbox insert откатывает резерв и изменение остатка.
- Legacy reservation migration переносит item/quantity/unit/status/timestamps до удаления старых колонок; неоднозначный machine/organization scope останавливает migration для ручной сверки.
- Expiration выполняется durable recovery executor командой `expireDue`; внешний production scheduler не добавлен.
- Ручные корректировки остаются отдельными Inventory Movement и не проходят через reserve/consume.

## FOUNDATION_ONLY

- покомпонентное подтверждение фактической выдачи аппаратным адаптером;
- распределённый склад во внешней ERP;
- production scheduler expiration;
- сверка аппаратных измерений с учётным остатком.
