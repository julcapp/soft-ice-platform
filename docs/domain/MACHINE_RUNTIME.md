# Machine Runtime

Status: Foundation v1 (in-memory, non-durable)  
Version: 1.0

Machine Runtime is authoritative only for the current operational execution state and valid transitions of a machine session. Orders owns order state; Payments owns payment state; Gateway owns vendor communication; Inventory owns stock; Machine Operations owns operator/test/service records; Digital Twin owns read projections; Event Bus transports facts and owns no domain state.

## States

- Stable: `UNKNOWN`, `OFFLINE`, `IDLE`, `READY`, `TEST_MODE`, `CLEANING`, `MAINTENANCE`, `OUT_OF_SERVICE`, `ERROR`.
- Transient: `BOOTING`, `CUSTOMER_SESSION`, `ORDER_PENDING`, `PAYMENT_PENDING`, `PAYMENT_CONFIRMED`, `DISPENSE_AUTHORIZED`, `CUP_DISPENSING`, `PRODUCT_DISPENSING`, `TOPPING_DISPENSING`, `COMPLETING`, `RECOVERING`, `SHUTTING_DOWN`.
- Terminal for one execution cycle: `COMPLETED`. It transitions to `READY`; it is not a terminal machine lifecycle state.

The canonical purchase path is `OFFLINE → BOOTING → IDLE → READY → CUSTOMER_SESSION → ORDER_PENDING → PAYMENT_PENDING → PAYMENT_CONFIRMED → DISPENSE_AUTHORIZED → CUP_DISPENSING → PRODUCT_DISPENSING → TOPPING_DISPENSING → COMPLETING → COMPLETED → READY`. Explicit interruption/recovery transitions are held in `MachineRuntimePolicy`; all others fail deterministically.

Sessions: `CUSTOMER_PURCHASE`, `OPERATOR_TEST`, `MAINTENANCE`, `CLEANING`, `CALIBRATION`, `RECOVERY`. Conflicting active sessions are denied by default. Operator sessions cannot change commercial configuration. Runtime never directly adjusts inventory.

Gateway/Simulator inputs are normalized to `MACHINE_CONNECTED`, `MACHINE_DISCONNECTED`, cup/product/topping confirmation or failure, door signals, `DEVICE_ERROR`, and `DEVICE_RECOVERED`. Raw Huaxin XML never enters Runtime. Huaxin-specific mapping remains `FOUNDATION_ONLY`; Simulator is executable.

Safe configuration defaults: 60-second default transition timeout, 300-second payment wait, two recovery attempts, three event delivery attempts/dead-letter threshold, and no concurrent sessions.
