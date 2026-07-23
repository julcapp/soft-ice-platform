# Everything Is Event Foundation v1

Status: Approved  
Version: 1.0  
Date: 2026-07-23  
Classification: FOUNDATION_ONLY

## Principle

Material domain outcomes are represented by immutable, versioned events so audit, integrations, read models and recovery can refer to the same accepted facts. Events complement authoritative domain state; they do not replace it. Event-driven integration is preferred across bounded contexts, while explicit synchronous service contracts remain valid when an immediate answer is required.

## Standard envelope

```json
{
  "eventId": "evt_...",
  "eventType": "ORDER_CREATED",
  "eventVersion": 1,
  "occurredAt": "2026-07-23T10:00:00Z",
  "recordedAt": "2026-07-23T10:00:01Z",
  "aggregateType": "ORDER",
  "aggregateId": "order_...",
  "actorType": "CUSTOMER",
  "actorId": "customer_...",
  "sourceChannel": "MINI_APP",
  "correlationId": "corr_...",
  "causationId": "evt_or_request_...",
  "payload": {},
  "metadata": {
    "schemaRef": "events/order-created/v1",
    "dataClassification": "INTERNAL"
  }
}
```

IDs are stable and globally unique. Timestamps are UTC ISO 8601. `occurredAt` is the domain occurrence; `recordedAt` is platform acceptance. Actor and source may be `SYSTEM` only when an accountable service/job identity is recorded in metadata. Payload schemas are typed and versioned.

## Initial event catalog

| Domain | Events |
|---|---|
| Customer/Consent | `CUSTOMER_REGISTERED`, `PHONE_VERIFIED`, `CONSENT_GRANTED`, `CONSENT_REVOKED`, `CUSTOMER_SEGMENT_CHANGED` |
| Order/Payment | `ORDER_CREATED`, `PAYMENT_PENDING`, `PAYMENT_CONFIRMED`, `PAYMENT_FAILED` |
| Dispense/Machine | `DISPENSE_AUTHORIZED`, `DISPENSE_STARTED`, `DISPENSE_COMPLETED`, `DISPENSE_FAILED`, `MACHINE_ONLINE`, `MACHINE_OFFLINE`, `MACHINE_ERROR_REPORTED` |
| Inventory/Operations | `INVENTORY_REFILLED`, `INVENTORY_CONSUMED`, `TEST_RUN_STARTED`, `TEST_RUN_COMPLETED`, `MAINTENANCE_STARTED`, `MAINTENANCE_COMPLETED`, `SERVICE_REPORT_SUBMITTED`, `SERVICE_REPORT_APPROVED` |
| Commercial/Engagement | `PRICE_CHANGED`, `CAMPAIGN_ACTIVATED`, `AD_IMPRESSION_RECORDED`, `AD_CLICK_RECORDED`, `BONUS_ACCRUED`, `BONUS_REDEEMED` |

Names describe completed facts in past tense. `PAYMENT_PENDING` and other state facts mean the owning domain accepted that state, not that a UI predicted it. Detailed payload schemas require separate domain approval before implementation.

## Governance

- Events are immutable; corrections are new events.
- Event types and payloads are versioned; breaking changes use a new version with migration guidance.
- Sensitive personal data is minimized; secrets, raw credentials and unnecessary provider payloads are forbidden.
- Consumers are idempotent by `eventId`, tolerate duplicates and handle out-of-order delivery where applicable.
- Failed consumers do not block the originating business transaction unless an approved invariant explicitly requires atomic handling.
- Use an outbox or equivalent atomic publication boundary for authoritative state plus integration event.
- Audit events and integration events may share correlation but are not identical: audit records policy/accountability; integration events communicate domain outcomes.
- Cross-domain consumers may build projections or invoke their own policy; they do not rewrite the producer's facts.
- Vendor-specific machine events are normalized behind `MachineGateway` before platform publication.
- Every new event requires an owner, purpose, producer, consumers, schema, classification, retention, ordering expectation and version documentation.

