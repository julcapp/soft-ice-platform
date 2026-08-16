# Equipment Integration Sandbox v1 — test scenarios

Status: Ready for hardware integration test
Date: 2026-08-16

## Automated backend scenarios

- heartbeat updates ONLINE/READY state;
- telemetry is visible in the dashboard projection;
- DISPENSE transitions PENDING -> ACKNOWLEDGED -> SUCCESS/FAILED;
- repeated identical completion is idempotent;
- conflicting completion is rejected;
- supplier routes reject missing/invalid API key;
- public health does not require supplier credentials;
- internal dashboard/test command routes reject unauthenticated calls;
- internal controls require ADMIN or PLATFORM_OWNER.

Automated implementation: `backend/tests/equipmentIntegration.test.js`.

## Hardware acceptance — H01 Connectivity

1. Enable sandbox with a non-production key.
2. Register `TEST-MACHINE-001`.
3. Send heartbeat `READY` every agreed interval.
4. Open Admin Console -> `Тестовый стенд оборудования`.

Expected: machine is online, status is READY, last-seen/controller metadata updates, and data mode is visibly SANDBOX.

## Hardware acceptance — H02 Telemetry

Send all physically supported controller values, including available temperature, cup, mix and topping data.

Expected: the latest values appear in the test screen. Unsupported sensors remain absent/unknown; Soft_ICE does not fabricate values.

## Hardware acceptance — H03 Successful dispense

1. Administrator creates a test dispense.
2. Controller polls `/commands`.
3. Controller ACKs the returned `command_id`.
4. Machine performs one physical dispense.
5. Controller reports SUCCESS for the same `command_id`.

Expected: one successful dispense is counted, pending command disappears and technical success rate updates.

## Hardware acceptance — H04 Failed dispense

Repeat H03 while causing a safe supplier-approved test failure or using a controller test-mode failure response.

Expected: FAILED is recorded once with a machine-readable error code and appears in recent equipment events.

## Hardware acceptance — H05 Idempotency

Replay the exact terminal result of an already completed `command_id`.

Expected: Soft_ICE returns the same accepted fact; no additional command is created and no second physical dispense is requested.

Then send a conflicting terminal state for the same completed `command_id`.

Expected: `EQUIPMENT_COMMAND_RESULT_CONFLICT`.

## Hardware acceptance — H06 Security boundary

Verify that the supplier API key:

- can call only `/equipment/v1` protected routes;
- cannot create a test command through `/api/v1/admin/equipment`;
- cannot read CRM, payments, customer or loyalty data;
- does not appear in application logs or source control.

## Exit criteria for first supplier test

The increment is accepted for the next integration phase when connectivity, telemetry, one successful dispense, one controlled failure, idempotency and access-boundary tests all pass and the supplier provides the completed controller-capability matrix.
