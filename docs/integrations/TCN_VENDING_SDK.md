# TCN Vending SDK Integration — verified facts and blocking questions

**Project:** Soft ICE Platform / «У Тимоши»  
**Supplier SDK:** TCN vending SDK  
**Status:** PARTIALLY VERIFIED — production hardware adapter remains blocked until remaining supplier answers are resolved  
**Updated:** 2026-10-19

## Purpose

This document records supplier-confirmed SDK facts, contradictions found in supplier replies, and mandatory platform rules for the Android machine controller / hardware adapter.

The platform must not infer undocumented hardware behavior. Any unresolved item below is a release blocker for production dispensing.

## Confirmed SDK entry points

The supplier has confirmed the public SDK path:

```java
TcnVendIF.getInstance().reqShip(
    slotNo,
    zhuliao,
    dingliao,
    guojiang,
    zhuQ,
    dingQ,
    guoQ,
    shipMethod,
    tradeNo
);
```

Serial initialization is to use the public SDK configuration / opening path:

```java
SerialPortSetting
TcnVendIF.getInstance().reqSlotNoInfoOpenSerialPort()
```

The closed control-board protocol must not be accessed directly.

The supplier also indicated status querying through:

```java
reqQueryStatus(-1)
```

with results delivered through `VendListener m_vendListener`, including `TcnVendEventID.CMD_QUERY_STATUS_LIFTER` and status data in `cEventInfo.m_lParam1`.

Known status/event names referenced by supplier material include:

- `STATUS_FREE`
- `STATUS_WAIT_TAKE_GOODS`
- `STATUS_HEATING_START`
- `STATUS_HEATING`
- `STATUS_HEATING_END`
- `CMD_NO_DATA_RECIVE`
- `CMD_TAKE_GOODS_DOOR`
- `COMMAND_SHIPMENT_SUCCESS`

The exact production-success semantic for our firmware still requires final confirmation; see blockers below.

## tradeNo and idempotency

The supplier confirmed that `tradeNo` is required and must be unique.

The MCU / SDK does not provide durable historical recovery of a previous `tradeNo` after an unexpected restart or power loss. It does not automatically repeat the previous operation. Retry policy therefore belongs to our application.

Platform rule:

- never auto-redispense after an unknown physical outcome;
- persist the local command / dispense attempt before sending;
- if the process, connection or controller fails after send and before a trustworthy terminal callback, mark the attempt as ambiguous / reconciliation required;
- do not create a second physical vend until the first outcome has been manually or technically reconciled.

This matches the existing backend `MachineDispenseService` model with `RECONCILIATION_REQUIRED`.

## Ingredient selectors

Supplier replies indicate that `zhuliao`, `dingliao` and `guojiang` are SDK selector parameters.

For sauce selection, supplier material recorded the following selector combinations:

- `guojiang = 1` — sauce channel 1
- `guojiang = 2` — sauce channel 2
- `guojiang = 3` — sauce channel 3
- `guojiang = 4` — channels 1 + 2
- `guojiang = 5` — channels 1 + 3
- `guojiang = 6` — channels 2 + 3
- `guojiang = 7` — channels 1 + 2 + 3

However, the quantity semantics for a mixed selector are still **not verified**. Example: for `guojiang = 4, guoQ = 20`, it is not yet confirmed whether 20 means total quantity or 20 per selected channel.

The equivalent combination rules for `dingliao` must also be explicitly confirmed before production use.

## Confirmed zhuliao rule for our supplied machine

The supplier has now explicitly confirmed:

```text
zhuliao = 0
```

is the **only valid value** for our supplied machine configuration.

Production rule:

- every `reqShip(...)` command for this machine must use `zhuliao = 0`;
- any internal configuration or adapter input with `zhuliao != 0` must be rejected before the SDK call;
- `zhuliao` is not customer-configurable and must not be exposed as a recipe option;
- previous supplier examples containing `zhuliao = 1` are not applicable to our supplied machine.

This item is no longer a production blocker.

## Quantity fields — BLOCKED BY CONTRADICTORY SUPPLIER REPLIES

Supplier replies currently conflict on the meaning of:

- `zhuQ`
- `dingQ`
- `guoQ`

One reply states that these values are **grams** with protocol range `0..255`, where 0 means the corresponding ingredient is omitted.

Another supplier example / explanation describes them as **time-based dosing values (deciseconds)** with a practical range around `10..100`.

Because the unit determines actual physical output, this contradiction is a production blocker.

Until the supplier resolves it:

- do not encode these fields as grams in production;
- do not calculate physical ingredient consumption from these values;
- do not apply a server-side `0..255 g` validation rule;
- do not use any assumed safe operating range;
- keep hardware recipe conversion behind a blocked/configurable adapter.

## Physical ingredient mapping — NOT YET VERIFIED

The logical selector numbers are not sufficient. We still require the physical map for our machine:

- sauce selector -> physical container position -> board connector;
- topping selector -> physical container position -> board connector.

Application recipes must store logical ingredient IDs. Mapping from logical ingredient IDs to physical selector numbers must be machine configuration, not business-logic hard-code.

Recommended machine configuration fields:

```text
selector
physical_position
board_connector
ingredient_id
machine_id
firmware_version
```

## slotNo and shipMethod

Supplier replies contain differing descriptions around `slotNo` / recipe targeting. The latest working integration material confirms these fields exist in the 9-argument `reqShip(...)` call.

Do not infer product quantity or recipe semantics from `slotNo` or `shipMethod` until their exact meaning for our machine is confirmed.

Where supplier examples use `shipMethod = "1"`, treat it as an example only unless the engineer confirms it is the required standard local-vend value for our firmware.

## Serial connection policy

Confirmed:

- use `SerialPortSetting`;
- open through `reqSlotNoInfoOpenSerialPort()`;
- do not use the closed board protocol directly.

Still required from supplier:

- baud rate;
- data bits;
- stop bits;
- parity;
- device path / port identifier;
- whether repeated initialization is safe;
- exact reconnect procedure after Android process restart, sleep/wake, USB/serial loss or controller reset;
- authoritative method for checking that the controller is responsive after reconnect.

Platform policy:

- only one connection manager may own the serial port;
- no `reqShip(...)` is allowed while controller communication is unverified;
- connection loss after command send produces an ambiguous physical outcome until reconciled.

## Physical completion semantics

A successful `reqShip(...)` invocation is **not** product completion.

The platform distinguishes:

```text
SENT
ACCEPTED
DISPENSING
DISPENSED
FAILED
RECONCILIATION_REQUIRED
```

Supplier material references `STATUS_WAIT_TAKE_GOODS`, `COMMAND_SHIPMENT_SUCCESS` and physical door callbacks. It also indicates that firmware behavior may place shipment-success at different points around ready-for-pickup / door activity.

Therefore the exact terminal signal for our firmware remains to be confirmed.

The Android adapter must not translate a command-return value into `DISPENSED`.

A production `DISPENSED` event must be emitted only from the supplier-confirmed terminal physical-success condition.

## Busy / ready state

Status polling through `reqQueryStatus(-1)` and `STATUS_FREE` is supported by supplier material.

Before production dispatch, the adapter must translate hardware state into platform readiness:

- `READY`
- `BUSY`
- `ERROR`
- `OFFLINE`

The final mapping between supplier constants and these platform states must be confirmed for our firmware.

Do not equate “serial port open” with `READY`.

## Duplicate command protection

The application already owns end-to-end idempotency. The supplier confirmed that the SDK/MCU does not provide durable operation history after restart.

Still unresolved: exact behavior if two `reqShip(...)` calls are issued close together during the same live controller session — execute twice, queue, reject as busy, or return an error.

Until confirmed, the Android adapter must serialize physical vend commands and allow only one active vend operation per machine.

## Recommended platform sequence

The current safe platform sequence is:

```text
1. Initialize serial configuration
2. Open the public SDK serial connection
3. Verify controller communication
4. Query machine state
5. Require READY
6. Persist dispense attempt / unique tradeNo
7. Build reqShip(...) with zhuliao = 0
8. Send reqShip(...)
9. Record command transport result
10. Wait for supplier-confirmed accepted / started facts
11. Wait for supplier-confirmed terminal physical result
12. Only then emit DISPENSED
13. Re-query readiness before accepting the next physical vend
```

If communication is lost after step 8 and before step 11, do **not** automatically resend. Move to reconciliation.

## Existing Soft ICE backend assessment

The current backend already enforces the important safety rules:

- customer dispense creation requires authoritative `Payment.status = SUCCEEDED`;
- command attempts have a unique `commandId` / idempotency key;
- duplicate delivery is guarded;
- unknown send outcomes move to `RECONCILIATION_REQUIRED`;
- callbacks distinguish `ACCEPTED`, `DISPENSING`, `DISPENSED`, `FAILED`;
- timeout is not treated as proof of failure;
- reconciliation is preferred over repeating a physical side effect.

Therefore no backend source-code change is required from the current supplier answer about `zhuliao`.

The production hardware adapter must enforce `zhuliao = 0` when it is implemented.

The production `MachineProviderAdapter` must remain blocked until the remaining hardware-specific items in this document are resolved and implemented in the Android/controller adapter.

## Supplier clarification blockers

Production integration remains blocked pending written confirmation of:

1. Exact unit of `zhuQ`, `dingQ`, `guoQ`: grams, deciseconds, motor ticks, or another controller unit.
2. Mixed quantity rule for `guojiang = 4/5/6/7` and the equivalent `dingliao` combinations.
3. One verified recipe with all 9 `reqShip` arguments and measured physical output, using `zhuliao = 0`.
4. Normal/minimum/maximum safe values and expected dosing tolerance.
5. Physical container mapping and board connector mapping.
6. Exact `slotNo` and `shipMethod` semantics for our machine.
7. Exact serial settings and reconnect procedure.
8. Exact final success callback/state for our firmware.
9. Exact behavior of a second `reqShip` while the first vend is active.
10. Exact mapping from supplier status constants to READY/BUSY/ERROR/OFFLINE.
11. Confirmation of the complete recommended vending sequence and when the machine becomes READY for the next vend.

## Release gate

Do not enable real customer production commands until all blocker items above are resolved, implemented in the hardware adapter, and verified on the supplied machine with at least one controlled end-to-end test:

```text
Payment SUCCEEDED
-> machine READY
-> reqShip(..., zhuliao = 0, ...)
-> accepted
-> physical dispensing
-> terminal success callback
-> platform DISPENSED
-> machine READY
```
