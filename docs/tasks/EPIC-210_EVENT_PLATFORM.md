# EPIC-210 - Event Platform

**Status:** Architecture documented
**Priority:** Critical
**Sprint:** Platform Core
**Type:** Documentation-only architecture epic

## 1. Epic Goal

Define Event Platform as the shared event architecture for Soft ICE Platform.

The epic establishes how Product, Finance, Machine, CRM, AI, Analytics and Notification modules will publish and consume formal events without direct domain dependencies.

This task is documentation-only. It does not implement an event bus, event store, frontend behavior, backend API, analytics code, package dependency or cloud infrastructure.

## 2. Business Value

Event Platform enables Soft ICE Platform to grow from an MVP purchase flow into an operational business platform.

Business value:

- full traceability of order, payment and vending machine lifecycle;
- clean integration between product, finance and machine domains;
- reliable customer history for CRM and loyalty;
- notification workflows based on confirmed state changes;
- future AI and analytics pipelines based on structured facts;
- safer scaling to multiple vending machines, channels and product categories;
- reduced coupling between teams and modules.

Strategic principle:

```text
Every state change in the platform should eventually produce a formal event.
```

## 3. Architecture Scope

Included:

- Event Platform purpose and role;
- Event Bus architecture rules;
- Domain Events and Integration Events;
- event envelope standard;
- event naming standard;
- event versioning;
- event delivery principles;
- event storage principles;
- event security rules;
- relationship with Product, Finance, Machine, CRM, AI, Analytics and Notification modules;
- future implementation roadmap.

Not included:

- JavaScript implementation;
- frontend source changes;
- App.jsx changes;
- page, route, style or asset changes;
- analytics implementation changes;
- package or dependency changes;
- cloud provisioning.

## 4. Domains Affected

Event Platform affects these domains by defining integration contracts, not by changing their implementation:

| Domain | Event Platform role |
|---|---|
| Product Platform | Publishes product, configuration, recipe and pricing facts. |
| Finance Platform | Publishes transaction, ledger, wallet, bonus, payment and refund facts. |
| Machine Platform | Publishes machine state, preparation and error facts. |
| CRM Platform | Consumes customer history events and publishes CRM operation facts. |
| Notification Engine | Consumes business events and publishes delivery facts. |
| AI Platform | Consumes historical event streams and publishes recommendation or prediction facts. |
| Analytics Platform | Consumes formal events for reporting and behavior analysis. |
| Identity and Consent | Publishes profile, consent and verification facts. |
| Operations | Publishes operator, support and maintenance facts. |

## 5. Initial Event Catalog

The initial catalog is a planning catalog. It defines stable names and categories for future implementation.

### Product Events

| Event | Producer | Purpose |
|---|---|---|
| `ProductCatalogUpdated` | Catalog Engine | Product catalog changed. |
| `ConfigurationCreated` | Configuration Engine | Customer product configuration was created. |
| `ConfigurationValidated` | Configuration Engine | Product configuration passed validation. |
| `RecipeCalculated` | Recipe Engine | Machine-independent recipe was calculated. |
| `PriceCalculated` | Pricing Engine | Final payable price was calculated. |

### Order Events

| Event | Producer | Purpose |
|---|---|---|
| `OrderCreated` | Order Engine | Order draft or confirmed order was created. |
| `OrderConfirmed` | Order Engine | Customer confirmed the order. |
| `OrderCancelled` | Order Engine | Order was cancelled. |
| `OrderExpired` | Order Engine | Order expired before completion. |
| `ProductDelivered` | Order or Machine Platform | Customer received the product. |

### Finance Events

| Event | Producer | Purpose |
|---|---|---|
| `TransactionCreated` | Transaction Engine | Financial transaction was created. |
| `LedgerEntryRecorded` | Ledger Engine | Ledger entry was recorded. |
| `PaymentStarted` | Payment Engine | Payment attempt started. |
| `PaymentCompleted` | Payment Engine | Payment completed successfully. |
| `PaymentFailed` | Payment Engine | Payment failed. |
| `RefundCompleted` | Payment or Refund Engine | Refund completed. |
| `WalletDeposited` | Wallet Engine | Wallet was deposited. |
| `WalletBalanceChanged` | Wallet Engine | Wallet balance changed. |
| `BonusAccrued` | Bonus Engine | Bonus points were accrued. |
| `BonusRedeemed` | Bonus Engine | Bonus points were redeemed. |
| `BonusExpired` | Bonus Engine | Bonus points expired. |

### Machine Events

| Event | Producer | Purpose |
|---|---|---|
| `MachineRegistered` | Machine Platform | Machine was registered in the platform. |
| `MachineStatusChanged` | Machine Platform | Machine status changed. |
| `MachineInventoryChanged` | Machine Platform | Machine ingredient availability changed. |
| `MachinePreparationStarted` | Machine Engine | Product preparation started. |
| `IceCreamDispensed` | Machine Engine | Ice cream portion was dispensed. |
| `SyrupDispensed` | Machine Engine | Syrup was dispensed. |
| `ToppingDispensed` | Machine Engine | Topping was dispensed. |
| `ProductReady` | Machine Engine | Product became ready for pickup. |
| `ProductTaken` | Machine Engine | Customer took the product. |
| `MachineErrorReported` | Machine Platform | Machine reported an error. |

### CRM and Customer Events

| Event | Producer | Purpose |
|---|---|---|
| `CustomerCreated` | Customer Engine | Customer profile was created. |
| `CustomerProfileUpdated` | Customer Engine or CRM | Customer profile changed. |
| `ClubJoined` | Loyalty or CRM | Customer joined Club Timofey. |
| `ConsentGranted` | Consent Engine | Consent was granted. |
| `ConsentRevoked` | Consent Engine | Consent was revoked. |
| `OperatorActionRecorded` | CRM | Operator action was recorded. |
| `SupportCaseCreated` | CRM | Support case was created. |
| `SupportCaseResolved` | CRM | Support case was resolved. |

### Notification Events

| Event | Producer | Purpose |
|---|---|---|
| `NotificationRequested` | Notification Engine | Notification send was requested. |
| `NotificationSent` | Notification Engine | Notification was sent to provider or channel. |
| `NotificationFailed` | Notification Engine | Notification delivery failed. |
| `NotificationDeliveryConfirmed` | Notification Engine | Channel confirmed delivery. |

### AI and Analytics Events

| Event | Producer | Purpose |
|---|---|---|
| `AiRecommendationRequested` | AI Platform | Recommendation was requested. |
| `AiRecommendationGenerated` | AI Platform | Recommendation was generated. |
| `DemandForecastCalculated` | AI Platform | Demand forecast was calculated. |
| `AnalyticsProjectionUpdated` | Analytics Platform | Analytics projection was updated from events. |

## 6. Event Naming Rules

Event names must:

- use stable English PascalCase;
- describe facts in past tense;
- avoid UI labels and route names;
- avoid Russian words and abbreviations;
- remain stable after publication;
- use a new version instead of changing meaning.

Preferred format:

```text
DomainObjectActionPast
```

Examples:

```text
OrderConfirmed
PaymentCompleted
MachineErrorReported
NotificationSent
```

Invalid examples:

```text
ClickPayButton
UserGoToScreen
OplataUspeshna
PaymentDoneAgain
```

## 7. Required Future Tasks

Future tasks should be created after architecture approval:

| Task | Goal |
|---|---|
| `EVENT-001` | Create event contract registry documentation. |
| `EVENT-002` | Design Event Bus interface and adapter boundaries. |
| `EVENT-003` | Design Event Store and transactional outbox. |
| `EVENT-004` | Define idempotent consumer and retry standards. |
| `EVENT-005` | Add Product Platform event contracts. |
| `EVENT-006` | Add Finance Platform event contracts. |
| `EVENT-007` | Add Machine Platform event contracts and telemetry mapping. |
| `EVENT-008` | Add CRM projections from events. |
| `EVENT-009` | Add Notification Engine event consumers and delivery events. |
| `EVENT-010` | Add AI and Analytics event pipeline design. |
| `EVENT-011` | Add event security, retention and audit policy. |
| `EVENT-012` | Add cloud event bus migration plan. |

## 8. Acceptance Criteria

This epic is accepted when:

- `docs/architecture/EVENT_PLATFORM.md` describes the Event Platform architecture;
- this epic document defines scope, catalog, rules, future tasks and roadmap;
- events are clearly separated from commands, UI actions and analytics-only events;
- event names are stable English names;
- event payloads are documented as contracts;
- Event Platform supports future Product, Finance, Machine, CRM, AI, Analytics and Notification modules;
- direct dependencies between domains are explicitly forbidden;
- no JavaScript source code is changed;
- no frontend files, routes, styles, assets or analytics implementation are changed;
- no package or dependency changes are made;
- no build is required because the task changes documentation only.

## 9. Explicitly Out of Scope

Out of scope for EPIC-210:

- implementing Event Bus;
- implementing Event Store;
- implementing event schemas in code;
- changing Mini App source code;
- changing `App.jsx`;
- changing pages;
- changing routes;
- changing styles;
- changing assets;
- changing analytics implementation;
- adding npm packages;
- changing package lock files;
- creating backend APIs;
- creating database migrations;
- provisioning cloud queues, topics or brokers;
- changing business rules in Product, Finance, Machine, CRM or Notification modules.

## 10. Future Implementation Roadmap

### Phase 1 - Architecture Baseline

- Fill Event Platform documentation.
- Register the architecture decision.
- Add EPIC-210 to task tracking.
- Define initial event categories and naming rules.

### Phase 2 - Contract Registry

- Create a central event contract registry.
- Define event envelope schema.
- Define payload schema for Product, Finance, Machine, CRM and Notification events.
- Define version compatibility rules.

### Phase 3 - Local Event Bus

- Introduce Event Bus interface.
- Add local adapter for MVP development.
- Add idempotency rules for consumers.
- Add test fixtures for event contracts.

### Phase 4 - Durable Event Storage

- Add Event Store or append-only event table design.
- Add transactional outbox per producing domain.
- Add replay support for CRM, Analytics and AI projections.
- Add retention rules.

### Phase 5 - Domain Integration

- Connect Product Platform events.
- Connect Finance Platform events.
- Connect Machine Platform events.
- Connect Notification Engine consumers.
- Connect CRM projections.

### Phase 6 - Cloud Event Bus

- Select cloud or broker transport.
- Add adapter without changing domain contracts.
- Add dead-letter queues.
- Add monitoring and alerting.
- Add production replay and recovery procedures.

### Phase 7 - AI and Analytics Pipelines

- Feed structured event streams into analytics models.
- Support AI recommendation and demand forecast events.
- Track model version and event lineage.
- Keep AI outputs traceable and reversible.
