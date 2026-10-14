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
