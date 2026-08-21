# Inventory Reservation & Locking v1

## Владение

Inventory Runtime владеет физическими остатками, активными резервами, движениями, расходом и корректировками. Sale Flow хранит только ссылку на резерв и не рассчитывает складской баланс.

## Модель и правила

`InventoryRuntimeStock` содержит tenant/machine/location/item scope, физический и активный зарезервированный остаток. `InventoryRuntimeReservation` хранит durable lifecycle, срок, тип операции, аудит и correlation; состав находится в `InventoryRuntimeReservationItem`.

Поддерживаются конфигурационные позиции `CUP`, `MIX`, `TOPPING`, `ADDITIVE` без зашитых вкусов. `CUSTOMER_SALE` создаёт `CONSUMPTION`; `OPERATOR_TEST` и `MAINTENANCE_TEST` создают `TEST_CONSUMPTION`, поэтому фактически использованные стакан, смесь и добавки уменьшают остаток.

## Атомарность и concurrency

Reserve блокирует строки stock через PostgreSQL `FOR UPDATE` в порядке `inventoryItemId`. Проверка всех позиций, запись агрегата/items, increment резерва и `INVENTORY_RESERVATION_CREATED` плюс итоговое `INVENTORY_RESERVED` или `INVENTORY_RESERVATION_FAILED` выполняются в одной transaction. Ограничения БД гарантируют `0 <= activeReservedQuantity <= physicalQuantity`, `quantity > 0`, `0 <= reservedQuantity <= quantity` и `0 <= consumedQuantity + releasedQuantity <= reservedQuantity`.

Для создания продажи тот же transaction client используется для Inventory reserve, Sale Flow state/idempotency и существующего Transactional Outbox. Production composition не поднимает legacy in-memory stock как fallback: при отсутствии durable adapter или recipe mapping продажа закрывается ошибкой до fulfillment.

Production composition также требует реальные `organizationContext`, `orderDomain` и `priceCalculator`. Отсутствие любой dependency завершает composition контролируемой ошибкой до recovery/бизнес-транзакции. Organization context совмещает активное Organization 360 assignment с активной Inventory location аппарата; серверная цена вычисляется существующим Product Engine из Product + Configuration + Recipe, а не принимается из client total.

Consume/release/expire блокируют агрегат и stock. Повтор целевого терминального перехода возвращает текущий результат без второго движения. Consume уменьшает physical и active reserved ровно один раз. После снижения до `lowStockThreshold` создаётся `INVENTORY_LOW_STOCK`.

## Изоляция и API

List, reserve, consume, release и expiration требуют organization scope. Reserve дополнительно проверяет, что location активна, имеет тип `MACHINE` и принадлежит `machineId`; stock выбирается полным ключом organization/machine/location/item. Admin не имеет операции произвольного изменения reserved quantity.

## Восстановление

Резервы и idempotency key находятся в PostgreSQL. После restart действующий `RESERVED` сохраняется; `expireDue` переводит просроченные записи в `EXPIRED` и освобождает stock. Внешний scheduler остаётся `FOUNDATION_ONLY`.

## Legacy migration

До удаления однопозиционных legacy-колонок migration создаёт item rows и переносит item, quantity, unit, status, timestamps, purpose/source metadata и identity. Machine и organization выводятся только из единственной активной Organization 360 assignment; отсутствующий или неоднозначный scope останавливает migration с `INVENTORY_LEGACY_RESERVATION_RECONCILIATION_REQUIRED`, не подставляя фиктивные значения.

## Partial dispense

Items имеют отдельные `reservedQuantity`, `consumedQuantity`, `releasedQuantity`, но текущий simulator сообщает только итог заказа. До component-level аппаратных подтверждений частичное списание — `FOUNDATION_ONLY`; система не заявляет фиктивную точность.
