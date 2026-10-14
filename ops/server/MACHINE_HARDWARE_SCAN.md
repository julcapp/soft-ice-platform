# Machine hardware scan contract

## Goal
At machine startup, the edge agent inventories physically connected and runtime-accessible peripherals and reports factual state to the platform. Configuration and factual discovery are separate.

## Config keys
Stored in PostgreSQL `MachineSetting`:
- `camera_qr` — QR pickup camera/scanner behavior.
- `startup_hardware_scan` — which classes of hardware should be scanned.
- `hardware_inventory_runtime` — reserved for the latest factual edge-agent report; admin UI treats it as read-only runtime evidence.

## Startup scan classes
- camera: USB/UVC, Android camera, browser media devices;
- QR scanner: USB HID, serial, native scanner;
- POS;
- MDB controller/bus;
- network interfaces and API reachability.

## Report model
The edge agent should report a timestamped snapshot:
```json
{
  "scanId": "uuid",
  "capturedAt": "ISO-8601",
  "agentVersion": "...",
  "devices": [
    {
      "id": "stable local id",
      "type": "CAMERA|QR_SCANNER|POS|MDB|NETWORK",
      "name": "...",
      "vendor": "...",
      "model": "...",
      "driver": "...",
      "status": "ONLINE|OFFLINE|DEGRADED|UNSUPPORTED",
      "capabilities": {}
    }
  ]
}
```

## Rules
- Never infer that configured hardware is physically present.
- Never treat browser permission as equivalent to OS device presence.
- Camera QR pickup requires both a configured pickup source and a runtime-capable camera/scanner.
- Payment/dispense business logic remains on backend; hardware adapters only report capabilities and transport scan results.
- Hardware reports must be machine-authenticated before server ingestion is enabled.


## Machine edge ingestion

Production endpoint:

`POST https://display.utimoshi.ru/api/v1/machine-edge/machines/:machineId/hardware-inventory`

Authentication:

`X-API-Key: <machine-edge key>`

The machine-edge key is a dedicated HKDF-derived subkey from `TERMINAL_CHANNEL_CHALLENGE_SECRET` using purpose `softice.machine-edge.v1` when an explicit `EQUIPMENT_INTEGRATION_API_KEY` is not configured. The master secret is never provisioned to an edge device.

A wrong key must return HTTP 401. A valid snapshot returns HTTP 202 and is persisted as `MachineSetting.key = hardware_inventory_runtime`.

## Windows reference scanner

Reference implementation:

`ops/edge/windows-hardware-scan.ps1`

It scans only factual OS-visible devices:
- UVC/Windows cameras with PnP driver data;
- explicitly named QR/barcode scanners;
- explicitly named POS terminals;
- serial ports, marking MDB only when the device identifies itself as MDB;
- physical network adapters.

It does not classify generic keyboards as QR scanners and does not infer absent POS/MDB hardware.

The production vending machine may use a different platform adapter (Android/native/Linux), but all adapters must emit the same normalized snapshot contract.
