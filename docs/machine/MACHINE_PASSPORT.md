# Machine Passport

Document code: MACHINE-PASSPORT-001
Task: EPIC-372 / MACHINE-002
Version: 0.1
Status: Draft, official source of truth pending hardware verification
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-09
Last updated: 2026-07-09
Scope: Documentation only

This document is the official engineering passport for the Soft ICE vending machine.

Source rule:

```text
Only information verified in repository documentation may be recorded as known.
Unknown hardware characteristics must be marked as Unknown or To be confirmed.
Assumptions are not accepted as hardware facts.
```

Verification status values:

- `Verified` - confirmed by approved or active project documentation.
- `Partially verified` - some facts are confirmed, but hardware detail is incomplete.
- `Unknown` - no verified project source exists yet.

Current verification summary:

| Section | Verification status |
|---|---|
| General information | Partially verified |
| Physical characteristics | Unknown |
| Hardware components | Partially verified |
| Capacity | Partially verified |
| Sensors | Unknown |
| Actuators | Unknown |
| Consumables | Partially verified |
| Connectivity | Partially verified |
| Payments supported by equipment | Partially verified |
| Maintenance | Partially verified |
| Safety | Partially verified |
| Known manufacturer limitations | Unknown |
| Expandability | Partially verified |
| References | Verified |

---

# 1. General Information

Verification status: `Partially verified`

Verified information:

- The equipment is a vending machine for selling soft ice cream in a cup.
- The machine belongs to the Soft ICE Platform / Utimoshi operating context.
- The platform treats the machine as a physical execution boundary through Machine Domain and Machine Dispatch.
- The machine must receive only paid orders through approved platform dispatch contracts.

| Field | Value | Verification |
|---|---|---|
| Manufacturer | Unknown | No verified manufacturer source is present in the repository. |
| Model | Unknown | No verified model name or number is present in the repository. |
| Version | To be confirmed | No verified hardware revision is present in the repository. |
| Country | Unknown | Manufacturer country and operating country for a specific unit are not verified in this passport. |
| Serial number | `SERIAL_NUMBER_TO_BE_CONFIRMED` | Placeholder only. Real serial number must be provided from equipment label or manufacturer documents. |
| Platform compatibility | Soft ICE Platform machine integration, vending terminal channel, Machine Domain and Order Machine Dispatch. Direct vendor protocol compatibility is Unknown. | Platform compatibility is verified at architecture level; hardware protocol is not verified. |

Assumptions:

- None.

---

# 2. Physical Characteristics

Verification status: `Unknown`

No verified physical specification for the machine is present in the repository.

| Characteristic | Value |
|---|---|
| Dimensions | Unknown |
| Weight | Unknown |
| Power supply | Unknown |
| Maximum power | Unknown |
| Network interfaces | Unknown |
| Display | To be confirmed. A vending terminal UI is required by platform documentation, but physical display size, type and resolution are unknown. |
| Operating temperature | Unknown |

Assumptions:

- None.

---

# 3. Hardware Components

Verification status: `Partially verified`

Verified information:

- The machine is intended to prepare and dispense soft ice cream in a cup.
- At the current stage, the terminal flow uses one active mix/flavor at a time.
- The terminal flow supports syrup selection and topping selection.
- The preparation flow includes receiving a cup, filling it with ice cream, adding syrup, adding topping and moving the product to the pickup window.

Hardware details still require manufacturer or equipment verification.

| Component | Status |
|---|---|
| Refrigeration system | To be confirmed. Required by product type, but no verified refrigeration model, compressor type, cooling method or temperature range is documented. |
| Mix tanks | To be confirmed. One active mix type is verified for the current stage; physical tank count and volume are unknown. |
| Mixers | Unknown |
| Pumps | Unknown |
| Valves | Unknown |
| Syrup dispensers | Partially verified. The terminal spec supports 3 syrup options; dispenser count, mechanism, container volume and calibration data are unknown. |
| Topping dispensers | Partially verified. The terminal spec supports 3 topping options; dispenser count, mechanism, container volume and calibration data are unknown. |
| Cup dispenser | Partially verified. Cup handling and cup inventory control are documented; dispenser model and mechanism are unknown. |
| Waste container | Unknown |
| Cleaning system | Partially verified. Machine Domain defines cleaning cycle and cleaning maintenance scenarios; physical cleaning hardware and chemicals are unknown. |
| Controller | To be confirmed. Machine Domain supports controller and adapter identity, but the physical controller is unknown. |

Assumptions:

- None.

---

# 4. Capacity

Verification status: `Partially verified`

Verified information:

- Cup inventory control values are documented for the vending UI: 160 cups, warning at 20 cups and sales blocking at 0 cups.
- The current terminal flow supports 3 syrup options and 3 topping options.

| Capacity item | Value | Verification |
|---|---|---|
| Cups | 160 pcs inventory control value; warning at 20 pcs; block sales at 0 pcs. | Verified in vending UI documentation. Whether this equals physical dispenser capacity is To be confirmed. |
| Mix volume | Unknown | No verified tank volume or mix pack size is documented. |
| Syrup containers | 3 syrup options are supported by terminal flow. | Container count, volume and refill unit are To be confirmed. |
| Topping containers | 3 topping options are supported by terminal flow. | Container count, volume and refill unit are To be confirmed. |
| Estimated servings | To be confirmed | Cup count gives an upper inventory-control value of 160 cups, but real serving capacity also depends on mix, syrup and topping quantities. |

Assumptions:

- None.

---

# 5. Sensors

Verification status: `Unknown`

No verified installed sensor list is present in the repository.

The platform documentation defines event and telemetry concepts that may be backed by sensors, controller signals or adapter logic. These are not yet verified as physical installed sensors.

| Sensor or signal area | Hardware verification status |
|---|---|
| Door open sensor | To be confirmed |
| Door closed sensor | To be confirmed |
| Product taken sensor | To be confirmed |
| Product presence sensor | To be confirmed |
| Cup dispenser sensor | To be confirmed |
| Mix level sensor | To be confirmed |
| Syrup level sensors | To be confirmed |
| Topping level sensors | To be confirmed |
| Temperature sensor | To be confirmed |
| Weight sensor | To be confirmed |
| Waste container level sensor | Unknown |
| Cleaning system sensor | Unknown |
| Safety interlock sensors | To be confirmed |
| Emergency stop sensor | Unknown |

Assumptions:

- None.

---

# 6. Actuators

Verification status: `Unknown`

No verified installed actuator, motor, pump or controlled mechanism list is present in the repository.

The platform flow references preparation steps, but exact physical actuators must be confirmed from the manufacturer or equipment inspection.

| Actuator or controlled mechanism | Hardware verification status |
|---|---|
| Cup dispensing mechanism | To be confirmed |
| Ice cream dispensing mechanism | To be confirmed |
| Syrup dispensing mechanism | To be confirmed |
| Topping dispensing mechanism | To be confirmed |
| Pickup window or hatch mechanism | To be confirmed |
| Mixers | Unknown |
| Pumps | Unknown |
| Valves | Unknown |
| Cleaning cycle mechanism | To be confirmed |
| Refrigeration control mechanism | Unknown |
| Controller reboot mechanism | To be confirmed |

Assumptions:

- None.

---

# 7. Consumables

Verification status: `Partially verified`

Verified information:

- The initial product is soft ice cream in a cup.
- At the current stage, the machine uses one active mix/flavor at a time.
- Current platform catalog direction includes syrup and topping options.
- Cup inventory control is documented.

| Consumable | Status |
|---|---|
| Ice cream mix | Partially verified. One active mix type is used at the current stage; exact mix product, pack size, storage requirement and refill unit are unknown. |
| Syrups | Partially verified. The terminal supports 3 syrup options. Current product catalog direction includes strawberry, chocolate and caramel. Physical loaded SKUs and container specs are To be confirmed. |
| Toppings | Partially verified. The terminal supports 3 topping options. Current product catalog direction includes Oreo, sprinkles and chocolate chips. Physical loaded SKUs and container specs are To be confirmed. |
| Cups | Partially verified. Cup inventory control is 160 pcs with warning at 20 pcs and block at 0 pcs. Cup material, size and supplier are unknown. |
| Water | Unknown |
| Cleaning chemicals | Unknown |
| Filters or service materials | Unknown |

Assumptions:

- None.

---

# 8. Connectivity

Verification status: `Partially verified`

Verified information:

- The machine must exchange operational facts with the platform through Machine Domain, Machine Dispatch, API and/or adapter contracts.
- Vending UI documentation requires data exchange through API for orders, bonus data, balances, error log and sales log.
- QR code and NFC tag entry points on the machine are documented for platform deep links. They are not verified as network interfaces.

| Connectivity item | Status |
|---|---|
| Ethernet | Unknown |
| Wi-Fi | Unknown |
| 4G/5G | Unknown |
| Bluetooth | Unknown |
| USB | Unknown |
| Cloud | Partially verified. Platform/API integration is required; exact cloud provider, endpoint, protocol, adapter and authentication method are To be confirmed. |
| QR code on machine | Partially verified as a customer entry point. Not a network interface. |
| NFC tag on machine | Partially verified as a customer entry point. Payment NFC capability is Unknown. |

Assumptions:

- None.

---

# 9. Payments Supported by Equipment

Verification status: `Partially verified`

This section records hardware or terminal-equipment payment capabilities only.

Verified information:

- The vending UI specification allows bank card, QR and SBP payment scenarios.
- The vending UI specification forbids cash, coin acceptor and bill acceptor scenarios.

| Payment capability | Status |
|---|---|
| Bank card | Partially verified as an approved terminal payment method. Exact card reader, acquiring terminal, contactless capability and hardware model are Unknown. |
| QR | Partially verified as an approved terminal payment method. Exact QR display, static QR, dynamic QR and payment-provider hardware dependencies are To be confirmed. |
| SBP | Partially verified as an approved terminal payment method. Exact equipment dependency is To be confirmed. |
| Cash | Not an approved supported equipment payment method. |
| Coin acceptor | Not an approved supported equipment payment method. |
| Bill acceptor | Not an approved supported equipment payment method. |
| NFC payment | Unknown. NFC tag entry is documented as a platform entry point, but payment NFC hardware capability is not verified. |

Assumptions:

- None.

---

# 10. Maintenance

Verification status: `Partially verified`

Verified maintenance categories from Machine Domain:

- cleaning;
- refill;
- calibration;
- component repair;
- firmware update;
- installation check;
- safety inspection;
- incident recovery;
- retirement preparation.

Maintenance schedule is not verified.

| Maintenance interval | Status |
|---|---|
| Daily | To be confirmed |
| Weekly | To be confirmed |
| Monthly | To be confirmed |
| Service intervals | To be confirmed |
| Cleaning interval | To be confirmed |
| Refill interval | To be confirmed |
| Calibration interval | To be confirmed |
| Safety inspection interval | To be confirmed |

Assumptions:

- None.

---

# 11. Safety

Verification status: `Partially verified`

Verified platform safety rules:

- The machine must not start preparation before payment is confirmed and accepted by Order policy.
- The machine receives only paid orders through approved dispatch contracts.
- Unsupported recipe, missing inventory, unsafe temperature or blocked component must reject the command before preparation.
- Maintenance state blocks customer preparation unless an approved policy allows limited safe operations.
- Stale telemetry must not be treated as proof of readiness.
- Physical preparation failure must be reported as a Machine event.

Unknown safety characteristics:

| Safety item | Status |
|---|---|
| Electrical certification | Unknown |
| Food safety certification | Unknown |
| Emergency stop hardware | Unknown |
| Door interlock hardware | To be confirmed |
| Temperature safety limits | Unknown |
| Cleaning safety procedure | To be confirmed |
| Customer pickup safety mechanism | To be confirmed |
| Manufacturer safety manual | Unknown |

Assumptions:

- None.

---

# 12. Known Manufacturer Limitations

Verification status: `Unknown`

No verified manufacturer, model or manufacturer limitation document is present in the repository.

Known manufacturer limitations:

```text
Unknown
```

Assumptions:

- None.

---

# 13. Expandability

Verification status: `Partially verified`

Verified platform direction:

- The current stage uses one active mix/flavor at a time.
- Future support for 2-3 mixes is mentioned only as a future possibility if the machine supports it.
- Future platform direction includes multiple vending machines in a network.
- Machine Domain supports capability profiles, configuration versions and adapter-based integration.

Hardware expandability remains unverified.

| Expandability item | Status |
|---|---|
| Additional mix tanks | To be confirmed |
| Additional syrup channels | To be confirmed |
| Additional topping dispensers | To be confirmed |
| Additional payment devices | To be confirmed |
| Additional network modules | To be confirmed |
| Multiple machines in platform network | Partially verified as platform direction; physical fleet hardware model is To be confirmed. |
| New product categories | Partially verified as platform direction; machine hardware support is To be confirmed. |

Assumptions:

- None.

---

# 14. References

Verification status: `Verified`

Repository references used for this passport:

- `AGENTS.md`
- `PROJECT_MEMORY.md`
- `docs/domain/MACHINE_DOMAIN.md`
- `docs/tasks/ORDER-008_MACHINE_DISPATCH.md`
- `docs/WORKING_DECISIONS_CURRENT.md`
- `docs/vending_machine_ui.md`
- `docs/domain/PRODUCT_CATALOG.md`
- `docs/domain/SYRUP_CATALOG.md`
- `docs/domain/TOPPING_CATALOG.md`
- `docs/api/REST_API.md`
- `docs/api/EVENT_API.md`

References not yet available:

- manufacturer passport;
- manufacturer user manual;
- manufacturer service manual;
- electrical specification;
- refrigeration specification;
- controller and firmware specification;
- payment terminal hardware specification;
- sensor and actuator inventory;
- installation checklist;
- safety certificate;
- food safety and sanitation requirements;
- maintenance schedule;
- real equipment serial number.
