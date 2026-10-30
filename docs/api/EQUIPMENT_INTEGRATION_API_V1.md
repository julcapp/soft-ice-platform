# Soft_ICE Equipment Integration API v1

Status: Draft / Sandbox
Version: 1.0
Date: 2026-08-16

## Purpose

`Equipment Integration API` is the vendor-neutral external boundary between Soft_ICE Platform and a vending-machine controller. It exists to test physical equipment without exposing CRM, payments, customer identities, loyalty rules, databases, internal Event Bus contracts or repository source code.

The sandbox is disabled by default and is not a production equipment protocol claim.

## Architecture boundary

```text
Soft_ICE business runtimes
        |
Machine Runtime / Gateway contracts
        |
Equipment Integration API v1
        |
Supplier controller
        |
Physical vending machine
```

Supplier credentials authenticate a non-human equipment actor only. They never grant administrative access.

## Sandbox configuration

Required to enable the external interface:

```text
EQUIPMENT_INTEGRATION_ENABLED=true
EQUIPMENT_INTEGRATION_API_KEY=<secret generated outside Git>
EQUIPMENT_INTEGRATION_TEST_MACHINE_ID=TEST-MACHINE-001
```

Optional:

```text
EQUIPMENT_INTEGRATION_TELEMETRY_LIMIT=200
EQUIPMENT_INTEGRATION_EVENT_LIMIT=200
```

Do not commit the API key. Rotate it after supplier testing or whenever compromise is suspected.

## External supplier endpoints

Base path:

```text
/equipment/v1
```

`GET /health` is intentionally public and reveals only service availability and sandbox mode.

All other routes require:

```text
X-API-Key: <sandbox key>
```

Endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Availability check |
| POST | `/machines/register` | Register/update a sandbox machine identity |
| POST | `/machines/{id}/heartbeat` | Report connectivity and operational status |
| POST | `/machines/{id}/telemetry` | Report controller/sensor telemetry |
| POST | `/machines/{id}/status` | Report aggregated machine status |
| GET | `/machines/{id}/commands` | Poll pending commands |
| POST | `/machines/{id}/commands/{commandId}/ack` | Acknowledge receipt of a command |
| POST | `/machines/{id}/dispense/result` | Report physical dispense result |
| POST | `/machines/{id}/events` | Report technical/service event |

## Internal administrator endpoints

Base path:

```text
/api/v1/admin/equipment
```

These routes use the existing Soft_ICE administrator authentication boundary and are not accessible with the supplier API key.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/machines/{id}` | Read the sandbox dashboard projection |
| POST | `/machines/{id}/test-dispense` | Create a test DISPENSE command |

Development/test environments can use the repository's existing `X-Admin-Role` development authentication mechanism. Production must use the approved administrative security context.

## Test machine

Default sandbox machine:

```text
TEST-MACHINE-001
```

The identity is configurable and must not be confused with a production machine identity.

## Telemetry payload

Telemetry is capability-driven. The supplier must report only values physically available from the controller; Soft_ICE must not infer a sensor that does not exist.

Example:

```json
{
  "machine_id": "TEST-MACHINE-001",
  "timestamp": "2026-08-16T10:15:26Z",
  "telemetry": {
    "temperature_c": -4.1,
    "cups_remaining": 87,
    "mix_level_percent": 62,
    "topping_levels_percent": {
      "chocolate": 48,
      "strawberry": 76,
      "caramel": 31
    }
  },
  "errors": []
}
```

The first supplier capability review must explicitly state whether each value is measured, calculated by the controller, event-only, or unavailable.

## Command lifecycle

```text
PENDING -> ACKNOWLEDGED -> SUCCESS | FAILED
```

`ACKNOWLEDGED` means the controller accepted/received the command. It does not mean a physical product was dispensed.

A completed `command_id` is idempotent. Repeating the same terminal result is accepted as the same fact. A conflicting terminal result for the same command is rejected with `EQUIPMENT_COMMAND_RESULT_CONFLICT`.

## Dashboard projection

The sandbox read model exposes:

- machine online/status and last-seen time;
- controller/firmware versions;
- latest telemetry sample;
- total test commands;
- successful and failed physical dispenses;
- technical success rate;
- recent equipment events;
- currently pending commands;
- explicit `data_mode: SANDBOX` marker.

This projection is intended to validate dashboard hypotheses before production persistence and vendor-specific mapping are approved.

## First integration acceptance scenario

1. Supplier calls `/health`.
2. Supplier registers `TEST-MACHINE-001` using its sandbox key.
3. Equipment sends heartbeat with `READY`.
4. Equipment sends a telemetry sample.
5. Soft_ICE administrator verifies values in the sandbox dashboard projection.
6. Soft_ICE administrator creates a test `DISPENSE` command.
7. Controller polls and receives the command.
8. Controller sends ACK.
9. Physical machine executes the test dispense.
10. Controller sends `SUCCESS` or `FAILED` with an equipment error code.
11. Dashboard counters and recent events update.
12. The same completed command/result is replayed to prove idempotency and that a second physical dispense is not created by the Soft_ICE contract.

## Current limitations

Sandbox v1 keeps its machine state, telemetry, events and command queue in memory. Restarting the backend clears the integration-test data. This is deliberate for the first hardware compatibility test and must not be represented as production durability.

Before production, the following remain mandatory: durable PostgreSQL persistence, transactional/outbox integration as required by architecture, verified vendor protocol mapping, credential lifecycle/rotation, rate limiting, replay protection or mTLS/HMAC as approved, verified machine identity provisioning and operational monitoring.
