# Platform Data Model

Document code: DATA-PLATFORM-001
Task: EPIC-350 / DATA-001
Version: 0.1
Status: Draft
Project: Soft ICE Platform / Utimoshi
Owner: Product Owner Alexander Ilyin
Created: 2026-07-07
Last updated: 2026-07-07
Scope: Documentation only

Related documents:

- `AGENTS.md`
- `PROJECT_MEMORY.md`
- `docs/architecture/ARCHITECTURE_PRINCIPLES.md`
- `docs/architecture/PROJECT_DECISIONS.md`
- `docs/architecture/DDD_LITE_ARCHITECTURE.md`
- `docs/architecture/PLATFORM_KERNEL.md`
- `docs/architecture/EVENT_PLATFORM.md`
- `docs/architecture/ORDER_PLATFORM.md`
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/architecture/LEDGER.md`
- `docs/architecture/WALLET.md`
- `docs/domain/CUSTOMER_DOMAIN.md`
- `docs/domain/CLUB_ACCOUNT.md`
- `docs/domain/BONUS_DOMAIN.md`
- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/domain/PAYMENT_OPERATIONS_REGISTRY.md`
- `docs/domain/CONSENT_MODEL.md`
- `docs/domain/PRODUCT_CATALOG.md`
- `docs/domain/SYRUP_CATALOG.md`
- `docs/domain/TOPPING_CATALOG.md`
- `docs/domain/PRODUCT_IMAGE_MODEL.md`
- `docs/domain/MEDIA_LIBRARY_STRUCTURE.md`
- `docs/domain/RECIPE_MODEL.md`
- `docs/finance/PAYMENT_REGISTRY.md`
- `docs/api/REST_API.md`
- `docs/api/EVENT_API.md`
- `docs/tasks/TASK_INDEX.md`

---

# 1. Purpose

This document defines the logical data model for Soft ICE Platform.

The model describes platform entities, key attributes, relationships, cardinality, aggregate boundaries, data ownership, storage rules, immutable records, audit requirements, retention direction and future expansion.

Core rule:

```text
Logical model first.
Physical schema second.
Application UI never owns business data.
Source-of-truth ownership belongs to domains and runtimes.
```

This document is not a database migration, not an ORM schema and not application code. It is the platform data contract direction that future backend, PostgreSQL, API, event, CRM, analytics and runtime tasks must use.

---

# 2. Scope

Included:

- customer identity, contacts, consent and relationship data;
- product catalog, configuration, recipe, pricing, media and discount data;
- order, checkout, fulfillment and machine data;
- payment, Club Account, Bonus, Wallet, Ledger, refund, reconciliation and accounting data;
- notification, CRM, support, audit and analytics data;
- event, idempotency, configuration and operational records;
- data ownership, aggregate boundaries, retention and expansion rules.

Out of scope:

- JavaScript implementation;
- React components;
- backend route implementation;
- database migrations;
- final PostgreSQL DDL;
- final legal retention policy;
- final commercial values for promotions, bonuses, discounts or referral rewards;
- provider-specific raw schemas as platform business models.

The current `backend/prisma/schema.prisma` is an implementation snapshot. It may contain useful early entities, but it is not the full logical source of truth for future platform data design.

---

# 3. Model Principles

1. Every business entity has a stable platform identity.
2. Catalog and rules are versioned.
3. Historical orders store snapshots, not live catalog references as historical truth.
4. Financial facts are append-only.
5. Ledger is the source of truth for monetary history.
6. Bonus is a non-monetary discount right.
7. Club Account prepaid balance and Bonus Account are separate.
8. Payment model is provider agnostic.
9. Provider IDs are correlation references, not platform IDs.
10. Events are immutable facts.
11. Consent evidence is auditable and must not be overwritten.
12. Audit records are not user-facing notes.
13. UI state is never source-of-truth data.
14. Raw secrets, credentials, card data and webhook signatures are never business data.
15. Personal data is minimized and purpose-bound.
16. Corrections use new compensating records.
17. Storage implementation can change without rewriting UI contracts.
18. Every order and payment references `sales_channel_id`.
19. Machine dispatch requires a fully paid order.
20. External provider reports are imported into internal registries.
21. Provider cabinets are not the only source of financial history.

---

# 4. Identifier Standard

Platform IDs should be stable and semantic where the entity is catalog-like.

Examples:

```text
product_soft_ice_vanilla_cup
flavor_vanilla
syrup_strawberry
topping_oreo
recipe_soft_ice_vanilla_strawberry_oreo
media_soft_ice_vanilla_strawberry_oreo
```

Operational records may use generated IDs:

```text
customer_01JZ...
order_01JZ...
payment_01JZ...
ledger_entry_01JZ...
event_01JZ...
```

Rules:

- catalog IDs must not be renamed after external consumers depend on them;
- generated IDs must be globally unique inside the platform;
- external IDs such as Telegram ID, YooKassa payment ID or machine vendor ID are aliases or provider references;
- every external alias resolves to a platform ID before it reaches business logic;
- event, audit and ledger IDs are immutable.

Canonical entity identifier names:

| Entity | Primary platform identifier | External or secondary identifiers |
|---|---|---|
| `Customer` | `customer_id` | Telegram ID, phone, email and OAuth IDs are `CustomerIdentity` aliases only. |
| `CustomerIdentity` | `customer_identity_id` | External subject ID, username, phone hash or email hash. |
| `CustomerConsent` | `customer_consent_id` | Consent document version and evidence reference. |
| `ClubAccount` | `club_account_id` | Customer ID and membership reference. |
| `BonusAccount` | `bonus_account_id` | Customer ID and bonus program reference. |
| `Order` | `order_id` | Order number for display/support. |
| `Payment` | `payment_id` | Provider payment reference for correlation only. |
| `Machine` | `machine_id` | Vendor machine ID or controller ID as aliases. |
| `SalesChannel` | `sales_channel_id` | Channel-specific route, bot, app or partner reference. |
| `PaymentRegistry` | `payment_registry_id` | Provider report reference and import batch ID. |
| `FinancialRegistry` | `financial_registry_id` | Ledger range, accounting export reference and reconciliation run ID. |
| `AuditEvent` | `audit_event_id` | Correlation ID, causation ID and actor reference. |

---

# 5. Required Entity Contract Matrix

This section lists the required DATA-001 entities with their logical identifiers, required fields and optional fields. It is not a physical database schema; exact column types, indexes and normalization belong to future storage design.

| Entity | Identifier | Required fields | Optional fields |
|---|---|---|---|
| `Customer` | `customer_id` | `status`, `source_channel`, `created_at`, `updated_at` | profile summary, language, timezone, closure reason |
| `CustomerIdentity` | `customer_identity_id` | `customer_id`, `provider`, `external_subject_id`, `status`, `linked_at`, `verification_method` | username/display alias, `last_seen_at`, `unlinked_at`, conflict reference |
| `CustomerConsent` | `customer_consent_id` | `customer_id` or `anonymous_user_id`, `consent_type`, `status`, `document_version_id`, `source`, `recorded_at` | `granted_at`, `revoked_at`, evidence reference, expiration policy |
| `ClubAccount` | `club_account_id` | `customer_id`, `status`, `currency`, `available_balance`, `reserved_balance`, `created_at`, `updated_at` | membership reference, low-balance state, saved method policy, auto top-up policy |
| `ClubAccountTransaction` | `club_account_transaction_id` | `club_account_id`, `customer_id`, `transaction_type`, `amount`, `currency`, balance deltas, actor, source, `created_at` | ledger entry ID, order ID, payment ID, reason, idempotency key |
| `BonusAccount` | `bonus_account_id` | `customer_id`, `status`, `bonus_unit`, active/reserved/pending counters, projection version | program ID, expiring-soon amount, last transaction ID |
| `BonusTransaction` | `bonus_transaction_id` | `bonus_account_id`, `customer_id`, `transaction_type`, `amount`, `bonus_unit`, source, rule ID/version, `created_at` | batch ID, reservation ID, related transaction ID, reason, actor, idempotency key |
| `Order` | `order_id` | `customer_id`, `sales_channel_id`, `status`, `currency`, `created_at`, state version | machine ID, order number, support flags, cancellation/refund references |
| `OrderItem` | `order_item_id` | `order_id`, `line_number`, `product_id`, `quantity`, configuration snapshot, fulfillment status | notes, item-level refund state, future modifiers |
| `Product` | `product_id` | `type`, `status`, `name`, `version`, catalog availability | default flavor, container, media reference, recipe reference, sort order |
| `Recipe` | `recipe_id` | `product_id`, option IDs, `machine_profile`, `status`, `version` | machine capability overrides, calibration metadata, future add-ons |
| `Machine` | `machine_id` | `location_id`, `status`, capabilities, controller/vendor alias, created/updated timestamps | `machine_group_id`, firmware version, maintenance schedule |
| `MachineGroup` | `machine_group_id` | `name`, `status`, group type, owner/runtime scope | location reference, routing priority, maintenance policy |
| `Location` | `location_id` | display name, status, address or geo reference | opening policy, region, partner/site owner, service notes |
| `SalesChannel` | `sales_channel_id` | channel type, name, status, owner runtime, created_at | Telegram bot/app reference, web app reference, terminal reference, partner reference |
| `Payment` | `payment_id` | `payment_intent_id`, `customer_id`, `sales_channel_id`, amount, currency, status, purpose | order ID, provider, provider payment reference, saved method reference |
| `PaymentSession` | `payment_session_id` | `payment_id`, confirmation type, status, `issued_at`, `expires_at` | QR/link reference, replacement session ID, provider session reference |
| `PaymentOperation` | `payment_operation_id` | `payment_id`, operation type, status, amount, currency, actor, source, `created_at` | provider reference, webhook record ID, ledger entry ID, manual review ID |
| `RefundOperation` | `refund_operation_id` | `payment_id`, refund amount, currency, reason, status, actor, `created_at` | order ID, provider refund reference, ledger entry ID, related payment operation ID |
| `PaymentRegistry` | `payment_registry_id` | provider, registry type, period/import scope, status, imported_at, source reference | provider report checksum, reconciliation run ID, mismatch count |
| `FinancialRegistry` | `financial_registry_id` | registry type, ledger scope, period, status, created_at | accounting export reference, settlement reference, reconciliation result reference |
| `Promotion` | `promotion_id` | promotion type, status, rule version, starts_at, ends_at, owner | campaign budget, target segment, bonus rule ID, notification trigger |
| `Referral` | `referral_id` | inviter customer ID, invited customer ID, program ID, status, source channel | referral code ID, qualifying event ID, reward reference, fraud review status |
| `Notification` | `notification_id` | customer ID or target reference, channel, purpose, status, template version, created_at | scheduled time, trigger event ID, delivery attempt summary, suppression reason |
| `AuditEvent` | `audit_event_id` | actor, action, target type/id, source, reason or reason code, occurred_at, correlation ID | before/after references, idempotency key, manual review ID, metadata |

Required field rules:

- required fields must be present before the entity is accepted by its owning Runtime;
- optional fields may be absent, null or added by later workflow stages;
- optional fields must not become hidden business requirements in UI code;
- future physical schemas may split these logical fields across tables, documents or projections while preserving the logical contract.

---

# 6. Data Ownership Map

| Data area | Owner | Source of truth | Main consumers |
|---|---|---|---|
| Product catalog | Product Runtime / Catalog Service | Catalog records and versions | Mini App, Web, Telegram Bot, CRM, Machine, Analytics |
| Configuration | Configuration Engine | Configuration rules and accepted configuration results | Pricing, Recipe, Media, Order, Machine |
| Recipe | Recipe Engine | Recipe records and machine profiles | Machine, Order, CRM, Analytics |
| Media | Media Runtime / Media Service | Media metadata and renditions | UI channels, CRM, Marketing, Product |
| Pricing | Pricing Engine | Pricing rules and pricing result records | Checkout, Order, Discount, Analytics |
| Discount | Discount Engine | Discount rules and discount result records | Checkout, Order, Payment |
| Sales Channel | Platform / Channel Runtime | Channel catalog and channel policy | Order, Payment, Analytics, CRM, Notification |
| Customer | Customer Runtime | Customer aggregate and identity links | Order, Payment, Bonus, Club Account, CRM, Analytics |
| Consent | Consent Runtime / legal data boundary | Consent records and document versions | Customer, Notification, CRM, Analytics, Promotion |
| Club Account | Club Account Runtime | Club account transactions and Ledger-backed projection | Checkout, Payment, CRM, Notification |
| Bonus | Bonus Runtime | Bonus transactions, batches and projection | Checkout, Discount, CRM, Notification, Analytics |
| Wallet | Wallet Runtime | Ledger-backed wallet projection | Checkout, Payment, CRM |
| Payment | Payment Runtime | Payment aggregate and payment operations registry | Order, Ledger, CRM, Notification, Reconciliation |
| Ledger | Ledger Runtime | Append-only ledger entries | Wallet, Accounting, Finance, Reporting |
| Order | Order Runtime | Order aggregate and immutable snapshots | Payment, Machine, CRM, Notification, Analytics |
| Machine | Machine Runtime | Machine state, operations and telemetry | Order, CRM, Analytics, Maintenance |
| Notification | Notification Runtime | Notification requests and delivery attempts | Customer, CRM, Analytics |
| Event Platform | Event Runtime | Event envelope and event storage | All projections, CRM, Analytics, AI |
| CRM / Support | CRM Runtime | Support cases, operator actions and projections | Operators, Customer, Finance, Product Owner |
| Analytics | Analytics Runtime | Minimized events and derived projections | Product Owner, CRM, AI |
| Platform Kernel | Platform Kernel | Runtime/service manifests and operational config | Runtimes, DevOps, Monitoring |

Ownership rule:

```text
Only the owning Runtime writes source-of-truth records.
Other domains store references, snapshots or projections.
```

---

# 7. Identity and Customer Entities

| Entity | Owner | Key attributes | Relationships and cardinality | Storage and audit notes |
|---|---|---|---|---|
| `Customer` | Customer Runtime | `customer_id`, `status`, `source_channel`, profile summary, `created_at`, `updated_at` | Customer 1 -> N identity links, contact points, consents, orders, payments, activity records. Customer 0..1 active Club Account. Customer 0..1 active Bonus Account. Customer 0..N wallets. | Canonical customer identity. External aliases never replace `customer_id`. Closure preserves legal and financial references. |
| `AnonymousUser` | Customer / Analytics | `anonymous_user_id`, session/source metadata, consent references | Anonymous user 0..1 linked customer. Anonymous user 1 -> N analytics sessions. | Can be linked to `customer_id` only with provenance and audit. |
| `CustomerIdentity` | Customer Runtime | `customer_identity_id`, `customer_id`, `provider`, `external_subject_id`, `status`, `verification_method`, `linked_at`, `unlinked_at` | Customer 1 -> N identities. Active external alias 1 -> 1 customer unless conflict review exists. | Also called Identity Link in Customer Domain. Telegram ID, phone, email, VK, MAX and provider customer references are aliases. Raw credentials are forbidden. |
| `ContactPoint` | Customer Runtime | `contact_id`, `customer_id`, `type`, `value_hash`, `display_mask`, `status`, `is_primary`, `verified_at` | Customer 1 -> N contacts. One primary contact per contact type. | Raw phone/email should be protected or hashed. Display masks are allowed for UI/support. |
| `DocumentVersion` | Consent Runtime | `document_version_id`, `document_type`, `version`, `title`, `file_path`, `effective_from`, `created_at` | Document version 1 -> N consent records. | Immutable after effective use. New legal text creates new version. |
| `CustomerConsent` | Consent Runtime | `customer_consent_id`, `customer_id`, `anonymous_user_id`, `consent_type`, `status`, `document_version_id`, `channel`, `source`, `granted_at`, `revoked_at`, `evidence` | Customer 0..N consents. Anonymous user 0..N consents. Consent 1 -> 1 document version. | Also called Consent Record in Consent/Customer docs. Consent history is append-only. Revocation creates a new state/evidence record, not deletion of history. |
| `ClubMembership` | Customer Runtime | `club_membership_id`, `customer_id`, `status`, `joined_at`, `terms_version`, `tier`, `source_channel` | Customer 0..1 active membership. Membership 1 -> 0..1 Club Account. | Club status is not balance, bonus or payment permission. |
| `TrustedCustomerStatus` | Customer Runtime | `trusted_status_id`, `customer_id`, `status`, `rule_id`, `rule_version`, `signals`, `assigned_at`, `assigned_by` | Customer 0..N trust records, 0..1 current status. | Trusted status is not authorization. Every assignment/revocation is audited. |
| `ReferralCode` | Customer / Promotion | `referral_code_id`, `customer_id`, `code`, `status`, `program_id`, `created_at`, `expires_at` | Customer 0..N codes. Code 1 -> N referral opens/relationships. | Code use must be idempotent and protected from client-side forgery. |
| `Referral` | Customer Runtime | `referral_id`, `inviter_customer_id`, `invited_customer_id`, `status`, `source_channel`, `qualified_at`, reward references | Inviter customer 1 -> N referrals. Invited customer 0..1 active inviter per program. | Also called Referral Relationship in Customer Domain. Self-referral is forbidden. Reward execution belongs to Bonus or Promotion. |
| `CustomerActivity` | Customer / CRM projection | `activity_id`, `customer_id`, `event_name`, `source_domain`, `source_id`, `occurred_at`, `summary`, `metadata` | Customer 1 -> N activity facts. Activity references source records. | Projection only. Rebuildable from events and audit; not source of truth. |

Customer data rules:

- `customer_id` is the primary customer identifier in all internal platform contracts;
- Telegram ID, phone, email and external OAuth IDs are external identities represented by `CustomerIdentity`;
- contact values and external aliases must be minimized, masked, hashed or protected according to sensitivity;
- consent evidence is separate from the customer profile and must remain auditable after profile changes.

---

# 8. Product, Catalog and Media Entities

| Entity | Owner | Key attributes | Relationships and cardinality | Storage and audit notes |
|---|---|---|---|---|
| `Product` | Product Runtime | `product_id`, `type`, `name`, `short_name`, `status`, `sort`, `default_flavor_id`, `container_id`, `recipe_reference_id`, `media_reference_id`, `version` | Product 1 -> N configuration rules, pricing rules, recipes and media references. Product 1 -> N order item snapshots. | Shared catalog entity for all channels. UI never hardcodes product data. |
| `Flavor` | Product Runtime | `flavor_id`, `name`, `status`, `sort`, `media_reference_id` | Flavor N <-> N products through rules. Flavor 1 -> N recipes. | Stable semantic ID. |
| `Syrup` | Product Runtime | `syrup_id`, `name`, `status`, `sort`, `media_reference_id`, `price_modifier_reference_id` | Syrup N <-> N products through configuration rules. Syrup 1 -> N recipes and media variants. | New syrup requires catalog, recipe, media, pricing and test updates. |
| `Topping` | Product Runtime | `topping_id`, `name`, `status`, `sort`, `media_reference_id`, `price_modifier_reference_id` | Topping N <-> N products through configuration rules. Topping 1 -> N recipes and media variants. | New topping follows the same lifecycle as syrup. |
| `ProductSize` | Product Runtime | `size_id`, `name`, `portion_policy`, `status`, `sort` | Product N <-> N sizes through rules. Size 1 -> N recipe profiles. | Enables future sizes and products beyond MVP. |
| `ConfigurationRule` | Configuration Engine | `configuration_rule_id`, `product_id`, allowed flavor/syrup/topping/size IDs, constraints, `rule_version`, `status` | Product 1 -> N rule versions. Rule version 1 -> N configuration results. | Rule edits create new versions. |
| `ConfigurationResult` | Configuration Engine | `configuration_result_id`, `product_id`, `flavor_id`, `size_id`, `syrup_id`, `topping_id`, `extras`, `recipe_id`, `media_id`, `rule_version` | Result 1 -> 0..N order snapshots. Result references product/catalog entities. | Accepted result may be snapshotted by Order. |
| `Recipe` | Recipe Engine | `recipe_id`, `product_id`, `flavor_id`, `syrup_id`, `topping_id`, `machine_profile`, `status`, `version` | Recipe N -> 1 product. Recipe 1 -> N order configuration snapshots and machine operations. | Recipe changes are versioned. Historical orders retain recipe snapshot/reference. |
| `MediaAsset` | Media Runtime | `media_id`, `type`, `path`, `alt`, `status`, `version`, `owner_domain`, `tags` | Media asset 1 -> N renditions. Product/configuration/recipe may reference media. | Media selection logic belongs in Media Service, not screens. |
| `MediaRendition` | Media Runtime | `rendition_id`, `media_id`, `variant`, `format`, `width`, `height`, `path`, `checksum` | Media asset 1 -> N renditions. | Supports mobile, tablet, desktop, terminal and large terminal variants. |
| `PricingRule` | Pricing Engine | `pricing_rule_id`, `scope`, `product_id`, `option_id`, `currency`, `amount`, `rule_version`, `effective_from`, `effective_to`, `status` | Product/option 1 -> N price rule versions. Rule 1 -> N pricing results. | Price edits create new effective versions. Product cards do not own prices. |
| `PricingResult` | Pricing Engine | `pricing_result_id`, `configuration_result_id`, `gross_amount`, `currency`, `line_items`, `bonus_allowed`, `bonus_limit`, `rule_versions`, `calculated_at` | Pricing result 1 -> 0..N order pricing snapshots. | Result is immutable after accepted by Order. |
| `DiscountRule` | Discount Engine | `discount_rule_id`, `type`, eligibility, stacking policy, caps, `rule_version`, `status` | Rule 1 -> N discount results. May reference Customer, Club, Bonus, Promotion context. | Discount is price reduction, not money. |
| `DiscountResult` | Discount Engine | `discount_result_id`, `pricing_result_id`, `discount_lines`, `bonus_discount_amount`, `total_discount_amount`, `payable_amount`, `currency` | Discount result 1 -> 0..N order discount snapshots and payment intents. | Payment consumes payable amount; Payment does not recalculate it. |
| `Promotion` | Promotion Runtime | `promotion_id`, `type`, `status`, `starts_at`, `ends_at`, rules, budget references, owner | Promotion 1 -> N promotion rules, bonus rules, notification triggers. | Also called Promotion Campaign in Promotion documentation. Future runtime. Campaign execution must be configured, versioned and auditable. |

---

# 9. Sales Channel, Order and Checkout Entities

| Entity | Owner | Key attributes | Relationships and cardinality | Storage and audit notes |
|---|---|---|---|---|
| `SalesChannel` | Platform / Channel Runtime | `sales_channel_id`, `channel_type`, `name`, `status`, owner runtime, policy references, `created_at` | Sales Channel 1 -> N checkout intents, orders, payments and notifications. | Represents Mini App, web app, Telegram bot, vending terminal, CRM, partner and future channels. Every order and payment references it. |
| `CheckoutIntent` | Checkout / Order boundary | `checkout_intent_id`, `customer_id`, `sales_channel_id`, `machine_id`, selected configuration, `status`, `expires_at`, idempotency key | Checkout intent 0..1 -> Order. Customer 1 -> N checkout intents. Sales Channel 1 -> N checkout intents. | Temporary orchestration record. It is not a paid order. |
| `Order` | Order Runtime | `order_id`, `order_number`, `customer_id`, `sales_channel_id`, `machine_id`, `status`, `currency`, `created_at`, `updated_at`, state version | Customer 0..N orders. Sales Channel 1 -> N orders. Machine 1 -> N orders. Order 1 -> N items. Order 0..N payments/refunds through references. | Business aggregate. Terminal states are immutable. |
| `OrderItem` | Order Runtime | `order_item_id`, `order_id`, `line_number`, `product_id`, `quantity`, `product_snapshot`, `fulfillment_status` | Order 1 -> N items. Item 1 -> 1 configuration snapshot. | Stores accepted product facts, not mutable live catalog as historical truth. |
| `ConfigurationSnapshot` | Order Runtime | `configuration_snapshot_id`, `order_item_id`, product/flavor/size/syrup/topping IDs, `recipe_id`, `media_id`, `configuration_version`, `captured_at` | Order item 1 -> 1 snapshot. Snapshot references source versions. | Immutable after payment flow starts. |
| `PricingSnapshot` | Order Runtime | `pricing_snapshot_id`, `order_id`, `pricing_result_id`, `gross_amount`, `currency`, line items, rule versions, `captured_at` | Order 1 -> 1 accepted pricing snapshot. | Historical price is never recalculated. |
| `DiscountSnapshot` | Order Runtime | `discount_snapshot_id`, `order_id`, `discount_result_id`, discounts, `payable_amount`, `currency`, `captured_at` | Order 0..1 accepted discount snapshot. | Final payable amount used by Payment. |
| `OrderBonusReservationRef` | Order Runtime / Bonus reference | `bonus_reservation_id`, `order_id`, `customer_id`, `reserved_bonus_amount`, `discount_amount`, `status`, `expires_at` | Order 0..1 active bonus reservation in MVP; future 0..N. | Bonus Runtime owns reservation lifecycle. Order stores reference and snapshot. |
| `PaymentBinding` | Order Runtime / Payment reference | `payment_id`, `payment_status`, `payable_amount`, `currency`, method line summary, ledger references | Order 0..N payment bindings. Payment 1 -> 0..1 primary order purpose. | Order does not store card data or raw provider payloads. |
| `Fulfillment` | Order Runtime | `fulfillment_id`, `order_id`, `status`, `fulfillment_type`, `machine_id`, `queue_entry_id`, `operation_id`, timestamps, attempts | Order 0..1 fulfillment in MVP. Future order 1 -> N fulfillment units. | Fulfillment starts only after paid state. |
| `OrderStateTransition` | Order Runtime / audit | `transition_id`, `order_id`, `from_state`, `to_state`, `reason`, `actor`, `occurred_at`, `correlation_id` | Order 1 -> N transitions. | Append-only audit of accepted lifecycle changes. |

Order aggregate invariant:

```text
Order owns purchase lifecycle and accepted snapshots.
Order does not own mutable Product, Pricing, Discount, Bonus, Payment, Ledger or Machine state.
Order references SalesChannel.
Order can be dispatched to Machine only after fully paid state is accepted.
```

---

# 10. Payment, Finance and Value Entities

| Entity | Owner | Key attributes | Relationships and cardinality | Storage and audit notes |
|---|---|---|---|---|
| `PaymentIntent` | Payment Runtime | `payment_intent_id`, `customer_id`, `sales_channel_id`, `order_id`, `club_account_id`, `purpose`, `amount`, `currency`, `status`, `expires_at` | Intent 1 -> N payment sessions. Intent 1 -> 0..N payments or attempts by policy. Sales Channel 1 -> N intents. | Created from accepted payable amount. |
| `Payment` | Payment Runtime | `payment_id`, `payment_intent_id`, `customer_id`, `sales_channel_id`, `order_id`, `status`, `amount`, `currency`, `provider`, provider reference, timestamps | Payment 1 -> N method lines, sessions and operations. Customer 0..N payments. Sales Channel 1 -> N payments. | Platform payment identity. Provider ID is correlation only. |
| `PaymentMethodLine` | Payment Runtime | `method_line_id`, `payment_id`, `method_type`, `amount`, `currency`, `status`, provider, provider reference | Payment 1 -> N lines. Method lines sum to accepted payable amount. | Supports card, SBP, QR/link, Club Account, Wallet and mixed payments. |
| `PaymentSession` | Payment Runtime | `payment_session_id`, `payment_id`, `confirmation_type`, `status`, `issued_at`, `expires_at`, safe confirmation reference | Payment 1 -> N sessions. Active session 0..1 by confirmation policy. | QR/link data is limited-lifetime operational data. |
| `SavedPaymentMethod` | Payment / Club Account boundary | `saved_payment_method_id`, `customer_id`, `provider`, masked reference, `status`, `consent_id`, `created_at`, `revoked_at` | Customer 0..N saved method references. Club Account 0..1 preferred saved method policy. | Provider-safe reference only. Raw card data is forbidden. |
| `PaymentOperation` | Payment Runtime | `payment_operation_id`, `payment_id`, operation type, status, amount, currency, provider reference, actor, idempotency key, correlation IDs | Payment 1 -> N operations. Refund operation 1 -> N related payment operations. | Append-only internal operations registry. |
| `ProviderWebhookRecord` | Payment adapter boundary | `webhook_record_id`, provider, event reference, signature status, payload hash, status, received_at, processed_at | Provider webhook 0..1 -> PaymentOperation after verification. | Raw payload retention requires protected storage and masking policy. |
| `RefundOperation` | Payment / Order / Finance | `refund_operation_id`, `payment_id`, `order_id`, `customer_id`, amount, currency, scope, reason, status, provider reference | Payment 0..N refund operations. Order 0..N refund operations. Refund Operation 1 -> N payment operations and ledger entries. | Append-only compensating operation, not edit of payment. |
| `Transaction` | Finance Runtime | `transaction_id`, `type`, `status`, `amount`, `currency`, `source_domain`, `source_id`, `actor`, idempotency key | Transaction 1 -> N ledger entries. | Financial intent or operation record. Does not replace Ledger. |
| `LedgerEntry` | Ledger Runtime | `ledger_entry_id`, `transaction_id`, account/wallet references, operation type, debit, credit, balance before/after, reference IDs, status, timestamp | Transaction 1 -> N entries. Wallet 1 -> N entries. Payment/refund/order 0..N entries. | Immutable financial source of truth. Never edited or deleted. |
| `Wallet` | Wallet Runtime | `wallet_id`, `owner_type`, `owner_id`, `wallet_type`, `currency`, balances, `projection_version`, `source_ledger_position`, `status` | Customer 0..N wallets. Wallet 1 -> N reservations and ledger entries. | Projection over Ledger. Rebuildable. |
| `WalletReservation` | Wallet Runtime | `wallet_reservation_id`, `wallet_id`, `amount`, `currency`, `status`, `source_domain`, `source_id`, `expires_at` | Wallet 1 -> N reservations. Order/payment 0..N reservations. | Reserve/release/capture through Ledger-backed operations. |
| `ClubAccount` | Club Account Runtime | `club_account_id`, `customer_id`, membership reference, `status`, currency, available/reserved balances, low-balance state, policy fields | Customer 0..1 active Club Account per currency. Club Account 1 -> N transactions/top-ups/reservations. | Customer-facing prepaid account, not bank account. |
| `ClubAccountTransaction` | Club Account Runtime | `club_account_transaction_id`, `club_account_id`, transaction type, amount, deltas, balances after, source, ledger reference, actor | Club Account 1 -> N transactions. | Append-only history. Corrections are compensating transactions. |
| `BonusAccount` | Bonus Runtime | `bonus_account_id`, `customer_id`, `status`, active/reserved/pending/lifetime counters, projection version | Customer 0..1 active Bonus Account per program. Bonus Account 1 -> N transactions/batches/reservations. | Bonus unit is not currency. |
| `BonusTransaction` | Bonus Runtime | `bonus_transaction_id`, `bonus_account_id`, `customer_id`, type, amount, source, rule ID/version, batch, reservation, actor, idempotency | Bonus Account 1 -> N transactions. Order/referral/campaign 0..N related transactions. | Append-only non-monetary journal. |
| `BonusBatch` | Bonus Runtime | `bonus_batch_id`, source, rule ID/version, initial/active/reserved/redeemed/expired amounts, activation/expiration timestamps | Bonus Account 1 -> N batches. Batch 1 -> N transactions. | Expiration is evaluated by batch. |
| `BonusReservation` | Bonus Runtime | `bonus_reservation_id`, `bonus_account_id`, `order_id`, amount, status, `expires_at`, idempotency key | Bonus Account 1 -> N reservations. Order 0..N reservations. | Reserved bonus cannot be reused in another checkout. |
| `PaymentRegistry` | Payment Runtime | `payment_registry_id`, provider, registry type, import batch ID, source reference, period, status, imported_at | Provider report import 1 -> N payment registry records. Registry record 0..N reconciliation results. | Internal registry of payment provider reports, statements, webhook history and status snapshots. External provider cabinet is not the platform financial history. |
| `FinancialRegistry` | Finance Runtime | `financial_registry_id`, registry type, ledger scope, period, source references, status, created_at | Financial registry 1 -> N reconciliation results and accounting exports. | Internal finance registry over Ledger-backed facts, payment operations, refunds, settlements and accounting handoff records. |
| `ProviderReportImport` | Payment / Finance adapter boundary | `provider_report_import_id`, provider, report type, period, checksum, imported_at, status | Import 1 -> N Payment Registry records and reconciliation inputs. | Provider reports are imported into internal registry before reconciliation. |
| `ReconciliationRun` | Finance / Payment Runtime | `reconciliation_run_id`, scope, provider, period, status, started_at, completed_at, actor | Reconciliation run 1 -> N reconciliation results. | Compares Payment, Ledger, provider reports, accounting and orders. |
| `ReconciliationResult` | Finance / Payment Runtime | `reconciliation_result_id`, run ID, source references, status, mismatch type, resolution status | Run 1 -> N results. Result 0..N manual review actions. | Does not rewrite facts. Creates correction tasks/records. |
| `AccountingExport` | Accounting Adapter | `accounting_export_id`, period, ledger entry range, target system, status, exported_at, acknowledgement reference | Export 1 -> N ledger entries by range/reference. | Accounting adapter translates Ledger facts; it does not mutate Ledger. |

Financial record rules:

- financial records are immutable after acceptance;
- `PaymentOperation`, `RefundOperation`, `ClubAccountTransaction` and `BonusTransaction` are append-only;
- existing financial records are never edited to correct history;
- corrections are represented as new compensating records;
- provider reports are reconciliation inputs and must be imported into `PaymentRegistry` or `FinancialRegistry`;
- external provider cabinet views are not the only source of financial history.

---

# 11. Machine and Fulfillment Entities

| Entity | Owner | Key attributes | Relationships and cardinality | Storage and audit notes |
|---|---|---|---|---|
| `MachineGroup` | Machine Runtime | `machine_group_id`, `name`, group type, status, routing policy, owner scope | Machine Group 1 -> N machines. Location 0..N -> N groups by future routing policy. | Groups support routing, maintenance, reporting, franchise or partner boundaries. |
| `Machine` | Machine Runtime | `machine_id`, `machine_group_id`, `name`, `location_id`, `status`, capabilities, current flavor, firmware/controller metadata | Machine Group 1 -> N machines. Machine 1 -> N inventory records, operations, telemetry and orders. | Machine identity is stable. Vendor IDs are aliases. |
| `Location` | Operations / Machine | `location_id`, address/display name, geo reference, status, opening policy | Location 1 -> N machines. Location 0..N -> N machine groups by future routing policy. | Enables maps, routing and operations. |
| `MachineInventory` | Machine Runtime | `inventory_id`, `machine_id`, item type, item ID/name, capacity, quantity left, threshold, updated_at | Machine 1 -> N inventory items. Inventory item 0..N machine events. | Inventory affects availability projections, not Product Catalog truth. |
| `MachineCapability` | Machine Runtime | `capability_id`, `machine_id`, supported recipes/options, constraints, status | Machine 1 -> N capabilities. Recipe N <-> N machines through capability mapping. | Needed before dispatch. |
| `DispatchQueueEntry` | Machine Runtime | `queue_entry_id`, `order_id`, `order_item_id`, `machine_id`, `recipe_id`, status, priority, timestamps | Fully paid order item 0..1 active queue entry. Machine 1 -> N queue entries. | Only paid orders can enter queue. |
| `MachineOperation` | Machine Runtime | `machine_operation_id`, queue entry, order, machine, recipe, command status, attempt count, result, timestamps | Queue entry 1 -> N operations/attempts. | Hardware execution record. Does not change finance. |
| `MachineCommand` | Machine adapter boundary | `machine_command_id`, operation ID, command type, payload reference, status, sent_at, acknowledged_at | Operation 1 -> N commands. | Command payloads are adapter contracts, not Order state. |
| `MachineTelemetryEvent` | Machine Runtime / Analytics | `telemetry_event_id`, `machine_id`, event type, severity, occurred_at, payload, correlation ID | Machine 1 -> N telemetry events. | Raw telemetry can be retained shorter than incidents and business operations. |
| `MachineIncident` | Operations / Machine | `incident_id`, `machine_id`, severity, status, source event, opened_at, resolved_at, operator references | Machine 0..N incidents. Incident 1 -> N audit actions. | Used for support, maintenance and fulfillment recovery. |

---

# 12. Notification, CRM and Operations Entities

| Entity | Owner | Key attributes | Relationships and cardinality | Storage and audit notes |
|---|---|---|---|---|
| `NotificationTemplate` | Notification Runtime | `template_id`, channel, purpose, version, status, locale, content reference | Template 1 -> N notification requests. | Template changes are versioned. Templates are not domain events. |
| `Notification` | Notification Runtime | `notification_id`, trigger event ID, customer ID or target reference, `sales_channel_id`, channel, purpose, template ID/version, status, scheduled_at | Event/customer 0..N notifications. Notification 1 -> N delivery attempts. | Created after consent and throttling policy checks. Notification is a side effect, not source-domain state. |
| `NotificationDeliveryAttempt` | Notification Runtime | `delivery_attempt_id`, notification ID, provider/channel, status, provider reference, sent_at, delivered_at, error code | Notification 1 -> N attempts. | Delivery failure does not rollback source domain state. |
| `SupportCase` | CRM Runtime | `support_case_id`, customer/order/payment/machine references, type, status, priority, assigned operator, opened_at, closed_at | Customer/order/payment/machine 0..N support cases. | Support case is operational data, not source-of-truth for domain state. |
| `OperatorAction` | CRM / Audit | `operator_action_id`, actor, role, target entity, action, reason, result, occurred_at, correlation ID | Operator 1 -> N actions. Target entity 0..N operator actions. | Sensitive operator actions require reason and audit. |
| `ManualReviewCase` | Payment / Bonus / Machine / CRM | `manual_review_case_id`, source domain, source ID, status, reason, decision, actor, timestamps | Source entity 0..N review cases. | Review decisions create domain commands or compensating records. |
| `AuditEvent` | Platform Audit | `audit_event_id`, actor, action, target type/id, before/after references, reason, source, correlation ID, occurred_at | Any sensitive entity 0..N audit events. | Also called Audit Record in some documents. Append-only. Does not store secrets or excessive personal data. |
| `IdempotencyRecord` | Platform Services | `idempotency_key`, scope, request hash, result reference, status, expires_at, created_at | Command/operation 0..1 idempotency record per scope. | Required for payment, order, bonus, wallet, machine and webhook side effects. |

---

# 13. Event and Analytics Entities

| Entity | Owner | Key attributes | Relationships and cardinality | Storage and audit notes |
|---|---|---|---|---|
| `EventEnvelope` | Event Runtime | `event_id`, `event_name`, `event_version`, `event_type`, `source_domain`, `occurred_at`, aggregate type/id, actor, payload, metadata | Aggregate 1 -> N events. Event 0..N consumers. | Immutable fact. Event storage does not replace source repositories or Ledger. |
| `EventOutboxRecord` | Producing Runtime / Event Runtime | `outbox_id`, event ID, aggregate ID, payload, status, attempts, next retry, created_at | Source state change 1 -> 0..1 outbox event by contract. | Supports reliable state change plus event publish. |
| `EventConsumerOffset` | Event Runtime | `consumer_id`, event stream/category, last event/position, status, updated_at | Consumer 1 -> N offsets. | Enables replay and idempotent projections. |
| `AnalyticsEvent` | Analytics Runtime | `analytics_event_id`, event name, source, actor/customer/anonymous/session IDs, context, payload, occurred_at | Session/customer 0..N analytics events. | Minimized and consent-aware. Not source of business truth. |
| `Session` | Analytics / Channel | `session_id`, anonymous user ID, customer ID, source, device class, started_at, ended_at | Customer/anonymous user 0..N sessions. Session 1 -> N analytics events. | Session data should be short-lived or anonymized by policy. |
| `AnalyticsProjection` | Analytics Runtime | projection ID, projection type, period, source event range, metrics, generated_at | Projection N -> source events by range. | Aggregated projections may outlive raw events when anonymized. |
| `FeatureFlag` | Platform Configuration | `feature_flag_id`, key, status, rollout rule, owner, created_at, updated_at | Flag 1 -> N runtime/config evaluations. | Configuration controls behavior only when model supports it. |
| `RuntimeConfigSnapshot` | Platform Kernel | `config_snapshot_id`, runtime, version, effective_at, checksum, source | Runtime 1 -> N config snapshots. | Secrets are references only, not raw values. |

---

# 14. Aggregate Boundaries

| Aggregate | Root | Internal entities/value objects | External references | Key invariants |
|---|---|---|---|---|
| Customer | `Customer` | profile, contact summary, customer identity state, club/trust/referral summaries | consent IDs, order IDs, payment IDs, bonus/club account IDs | `customer_id` is canonical; aliases are external; consent history is separate and auditable. |
| Sales Channel | `SalesChannel` | channel type, status, policy references, channel metadata | order IDs, payment IDs, notification IDs, partner/channel references | Orders and payments must reference SalesChannel; channel does not own order/payment logic. |
| Product Catalog | `Product` or catalog version | flavors, syrups, toppings, sizes, availability, catalog metadata | media IDs, recipe IDs, pricing rule IDs | Catalog is shared across all channels; UI does not hardcode product data. |
| Configuration | `ConfigurationResult` | selected option IDs, rule version, validation result | product/catalog IDs, recipe ID, media ID | Configuration does not calculate price or start preparation. |
| Recipe | `Recipe` | machine profile, ingredient/dose metadata | product/configuration IDs, machine capability IDs | Recipe maps digital configuration to machine-independent preparation intent. |
| Media | `MediaAsset` | renditions, alt text, status, version | product/configuration IDs | Media selection is centralized in Media Service. |
| Pricing | `PricingResult` | line items, rule versions, bonus cap | configuration result ID | Pricing calculates gross price; no payment or discount side effects. |
| Discount | `DiscountResult` | discount lines, stacking result, payable amount | pricing result, customer context, bonus reservation | Discount produces payable amount before payment. |
| Order | `Order` | order items, snapshots, payment binding, fulfillment state, transitions | customer ID, machine ID, payment ID, ledger IDs, bonus reservation IDs | Order owns lifecycle and snapshots; terminal states are immutable. |
| Payment | `Payment` | method lines, sessions, operations, provider references | order ID, customer ID, sales channel ID, ledger IDs, refund operation IDs | Provider agnostic; operations are append-only; expired sessions do not dispatch machine. |
| Payment Registry | `PaymentRegistry` | provider imports, registry records, operation/report correlation | payment IDs, provider report imports, reconciliation IDs | Internal registry imports provider reports; provider dashboards are not financial source of truth. |
| Financial Registry | `FinancialRegistry` | ledger scopes, settlement/accounting/reconciliation records | ledger entries, payment operations, refund operations, accounting exports | Internal registry preserves financial history and reconciliation evidence. |
| Ledger | `LedgerEntry` | immutable debit/credit facts | transaction ID, wallet/payment/order references | Ledger is financial source of truth; entries are never edited or deleted. |
| Wallet | `Wallet` | reservations and projection state | ledger positions, transaction IDs | Wallet is rebuildable projection over Ledger. |
| Club Account | `ClubAccount` | account transactions, top-up state, low-balance state | customer ID, payment ID, ledger IDs, consent IDs | Prepaid account, not bank account; history is append-only. |
| Bonus Account | `BonusAccount` | bonus transactions, batches, reservations, projection | customer ID, order/referral/campaign IDs | Bonus is not money; transactions are append-only. |
| Machine | `Machine` | inventory, capabilities, queue entries, operations, telemetry | order ID, recipe ID, location ID | Machine owns hardware execution; machine does not own payment or order snapshots. |
| Notification | `Notification` | delivery attempts, template version reference | trigger event ID, customer ID, consent status, sales channel ID | Notification is side effect; failed delivery does not rollback source facts. |
| Event | `EventEnvelope` | payload, metadata, delivery/outbox records | aggregate ID, correlation/causation IDs | Events are immutable facts; consumers are idempotent. |
| CRM / Support | `SupportCase` | comments, operator actions, review decisions | source domain/entity IDs | CRM consumes projections and issues commands; it does not edit source facts directly. |

---

# 15. Relationship and Cardinality Summary

| Relationship | Cardinality | Notes |
|---|---|---|
| Customer -> CustomerIdentity | 1 -> N | Each active external alias maps to one customer unless conflict review exists. |
| Customer -> ContactPoint | 1 -> N | One primary contact per contact type. |
| Customer -> CustomerConsent | 0..1/N -> N | Consent may start anonymous and later link to a customer with provenance. |
| Customer -> ClubAccount | 1 -> 0..1 active per currency | Future multi-account requires explicit policy. |
| Customer -> BonusAccount | 1 -> 0..1 active per program | Future multi-program requires explicit policy. |
| Customer -> Wallet | 1 -> 0..N | Wallet type and currency define uniqueness. |
| Customer -> Order | 1 -> N | Anonymous or provisional order support is policy-dependent. |
| Customer -> Payment | 1 -> N | Payment can also exist for support/top-up purpose. |
| Customer -> Referral as inviter | 1 -> N | One inviter may invite many customers. |
| Customer -> Referral as invited | 1 -> 0..1 active per program | Self-referral is forbidden. |
| SalesChannel -> Order | 1 -> N | Every order references one sales channel. |
| SalesChannel -> Payment | 1 -> N | Every payment references one sales channel. |
| Product -> ConfigurationRule | 1 -> N versions | Rule changes create versions. |
| Product -> Recipe | 1 -> N | Recipes vary by option combination and machine profile. |
| Product/Flavor/Syrup/Topping -> MediaAsset | N -> N by reference | Media metadata is separate from catalog. |
| ConfigurationResult -> PricingResult | 1 -> N possible calculations | Order stores one accepted pricing snapshot. |
| PricingResult -> DiscountResult | 1 -> 0..N | Different customer/promotion contexts can produce different discount results. |
| Order -> OrderItem | 1 -> N | MVP may have one item; model supports future multi-item orders. |
| OrderItem -> ConfigurationSnapshot | 1 -> 1 | Snapshot is accepted at order time. |
| Order -> PricingSnapshot | 1 -> 1 before payment | Immutable for historical order. |
| Order -> DiscountSnapshot | 1 -> 0..1 before payment | Present when discount calculation accepted, including zero-discount result if needed. |
| Order -> PaymentBinding | 1 -> 0..N | Retries/replacements are separate references, not mutation of old facts. |
| PaymentIntent -> PaymentSession | 1 -> N | QR/link replacement creates new session or operation. |
| Payment -> PaymentMethodLine | 1 -> N | Method line amounts sum to payable amount. |
| Payment -> PaymentOperation | 1 -> N | Operations registry is append-only. |
| Payment -> RefundOperation | 1 -> 0..N | Partial and full refunds are new compensating operations. |
| Transaction -> LedgerEntry | 1 -> N | Ledger entries are financial truth. |
| Wallet -> LedgerEntry | 1 -> N | Wallet projection rebuilds from ledger position. |
| ClubAccount -> ClubAccountTransaction | 1 -> N | Append-only account history. |
| BonusAccount -> BonusTransaction | 1 -> N | Append-only bonus history. |
| BonusAccount -> BonusBatch | 1 -> N | Expiration and redemption are batch-aware. |
| MachineGroup -> Machine | 1 -> N | Machine groups support operations, routing and reporting. |
| Location -> Machine | 1 -> N | A physical or business location can contain multiple machines. |
| Machine -> MachineInventory | 1 -> N | Inventory drives availability projections. |
| Machine -> MachineOperation | 1 -> N | Operation correlates to paid order and recipe. |
| Order -> DispatchQueueEntry | 1 -> 0..N | Only paid orders can be queued. |
| EventEnvelope -> EventConsumerOffset | N -> N by stream/consumer | Consumers manage idempotency and replay. |
| PaymentRegistry -> ReconciliationResult | 1 -> N | Imported provider records are compared to internal payment and ledger facts. |
| FinancialRegistry -> ReconciliationResult | 1 -> N | Financial registry records support settlement, accounting and correction review. |
| Notification -> DeliveryAttempt | 1 -> N | Multiple attempts for one notification are allowed. |
| SupportCase -> OperatorAction | 1 -> N | Every sensitive operator action is audited. |

---

# 16. Storage Rules

## 16.1 Logical to physical storage

MVP storage may use JSON or in-memory repositories where already accepted by project architecture.

Production direction:

- PostgreSQL for source-of-truth aggregates, financial facts, audit and operational records;
- object storage or static asset storage for media files;
- metadata records for media assets and renditions;
- event outbox and event storage for event-driven projections;
- analytics warehouse or projection tables for reporting;
- protected secret storage for credentials and provider secrets.

Repository and service interfaces must hide storage technology from UI components.

## 16.2 Naming

Recommended database field naming:

```text
snake_case for persisted fields
semantic IDs for catalog
generated IDs for operational records
UTC timestamps
explicit currency
explicit status
explicit version
```

## 16.3 Money representation

MVP documentation and UI examples may show RUB integers.

Future storage and API contracts must standardize money representation before production payment processing. Recommended direction:

- store amounts in integer minor units where provider/accounting compatibility allows;
- always store `currency`;
- never infer currency from locale or UI channel;
- do not mix discount amount, bonus amount and payment amount.

## 16.4 Personal data

Personal data rules:

- collect minimal data for the scenario;
- store raw phone/email only in protected boundaries when required;
- use hashes, masks or protected references where possible;
- keep customer identity separate from analytics identifiers;
- do not place raw personal data in general events;
- consent and legal basis must be available before restricted processing.

## 16.5 Secrets and provider data

Forbidden in source-of-truth domain records unless an explicitly protected adapter record requires it:

- raw card number;
- CVV/PIN;
- payment credentials;
- Telegram init data;
- bot tokens;
- API keys;
- webhook signatures;
- provider secret keys;
- unmasked authorization headers.

Provider payloads are adapter/integration records, not platform business models.

## 16.6 Soft Delete Policy and Status

Business records should prefer explicit lifecycle status over physical deletion.

Soft delete means the record remains present for audit and references, but new business flows treat it as inactive, closed, revoked, expired, archived or deleted according to entity lifecycle policy.

Physical deletion is allowed only for:

- temporary technical records past retention;
- caches and rebuildable projections;
- personal data after approved erasure/anonymization process;
- generated artifacts not required for audit.

Financial, consent, audit, event and order history must not be silently deleted while legal, accounting, dispute or support retention applies.

Soft delete rules:

- source-of-truth business records use lifecycle status before physical deletion;
- catalog records are retired or archived, not removed while referenced by orders;
- customer profile fields may be restricted, anonymized or deleted under approved privacy workflow while preserving `customer_id` references needed for financial, order and audit history;
- payment, refund, ledger, Club Account transaction, Bonus Transaction, audit and event records are never soft-deleted to hide accepted facts;
- rebuildable projections and caches may be deleted and recreated when source records remain available.

---

# 17. Immutable Records

The following entities are immutable after acceptance:

| Entity | Immutability rule | Correction method |
|---|---|---|
| `LedgerEntry` | Never edited or deleted. | New compensating ledger entry. |
| `Transaction` after posting | Historical transaction meaning is preserved. | New correction transaction. |
| `PaymentOperation` | Append-only operation fact. | New operation or manual review resolution. |
| `RefundOperation` after completion | Completed refund is preserved. | New refund/correction workflow. |
| `BonusTransaction` | Never edited after accepted. | Reversal or compensating transaction. |
| `BonusBatch` source metadata | Source and rule version remain historical. | New transaction or derived projection update. |
| `ClubAccountTransaction` | Account history is append-only. | Compensating transaction. |
| `Order` terminal state | `Completed`, `Cancelled`, `Refunded`, `Expired` do not transition. | New support/refund/recovery case referencing order. |
| `Order snapshots` | Product, configuration, pricing and discount snapshots are historical truth. | New order correction/support record, not snapshot rewrite. |
| `ConsentRecord` | Consent evidence is preserved. | New revocation/expiry/superseding record. |
| `DocumentVersion` after use | Legal document version is preserved. | New document version. |
| `EventEnvelope` | Event payload is immutable for published version. | New event version or compensating event. |
| `AuditEvent` | Audit trail is append-only. | New audit event noting correction. |
| `ProviderWebhookRecord` after accepted | Provider fact handling is preserved. | New processing/result record. |
| `MachineOperation` after completion/failure | Operation outcome is preserved. | New retry/recovery operation. |
| `ReconciliationResult` after closure | Result and resolution are preserved. | New reconciliation run/result. |

---

# 18. Audit Policy

Audit is required for:

- customer identity link and merge operations;
- consent grant, denial, revocation and version change;
- Club membership, trust status and referral changes;
- pricing, discount, bonus and promotion rule publication;
- order lifecycle transitions;
- payment, refund, saved payment method and reconciliation operations;
- ledger, wallet and Club Account balance-affecting facts;
- machine dispatch, command, retry, failure and incident resolution;
- CRM operator actions and support decisions;
- configuration and runtime changes;
- data export, restriction, anonymization and deletion requests.

Required `AuditEvent` fields:

| Field | Purpose |
|---|---|
| `audit_event_id` | Stable audit identity. |
| `actor_type` | `customer`, `operator`, `system`, `machine`, `provider`, `migration`, `support`. |
| `actor_id` | Stable actor reference when available. |
| `action` | Accepted action or rejected sensitive attempt. |
| `target_type` | Entity type affected. |
| `target_id` | Entity ID affected. |
| `reason_code` | Business, support, fraud, legal or system reason. |
| `source_channel` | Mini App, CRM, backend, provider, machine, scheduler. |
| `correlation_id` | Business flow correlation. |
| `causation_id` | Command/event/request that caused the action. |
| `idempotency_key` | When side effects are possible. |
| `occurred_at` | UTC occurrence timestamp. |
| `recorded_at` | UTC audit record timestamp. |
| `metadata` | Non-secret operational metadata. |

Audit rules:

- audit records must not contain secrets or raw payment credentials;
- operator actions require role, reason and target reference;
- rejected sensitive commands should be auditable;
- audit must support support investigation without exposing unnecessary personal data;
- audit data must be protected from tampering.

---

# 19. Retention Policy

Final legal retention periods require legal approval before production. The following table defines platform retention direction for architecture and future implementation planning.

| Data category | Default retention direction | Notes |
|---|---|---|
| Product catalog, recipes, media metadata and pricing/discount rules | Keep current and historical versions while referenced by orders, reports or active integrations; archive old versions indefinitely unless legal/data policy allows removal. | Historical orders depend on versioned references and snapshots. |
| Order records and order snapshots | Keep at least 5 years after order closure, longer when accounting, dispute, tax, support or legal policy requires. | Snapshots are historical commercial truth. |
| Payment, refund, payment operations, provider references and reconciliation records | Keep at least 5 years after financial year closure, longer for unresolved disputes, chargebacks, provider reconciliation or accounting policy. | Raw provider payload retention should be shorter and protected. |
| Ledger, transactions, wallet and Club Account financial history | Keep at least 5 years after financial year closure; prefer longer archival retention for financial reconstruction. | Ledger entries are immutable. |
| Bonus transactions and bonus batches | Keep while customer relationship exists and at least as long as related orders, campaigns, disputes or audit needs exist. | Bonus is non-monetary but affects payable amount. |
| Consent records and document versions | Keep while the related personal data is processed and for an additional evidence period after revocation, closure or policy supersession as approved by legal policy. | Consent evidence is audit-critical. |
| Customer profile and contact data | Keep while active purpose/legal basis exists; after closure, restrict, anonymize or delete personal fields while preserving legal references to orders, payments and audit. | `customer_id` may remain as pseudonymous reference. |
| Identity links | Keep active links while relationship exists; keep historical link/unlink audit as long as required for security, fraud, consent and dispute evidence. | Raw external credentials are not stored. |
| CRM support cases and operator actions | Keep at least 3 years after case closure; keep longer when linked to financial, legal or safety incidents. | Operator audit may inherit longer retention from target entity. |
| Machine operations and fulfillment records | Keep at least as long as related order and incident records. | Operation facts support disputes and maintenance. |
| Raw machine telemetry | Keep short-term by default, for example 90 to 180 days, unless tied to incident, order, safety or maintenance audit. | Aggregates may be retained longer. |
| Notification requests and delivery attempts | Keep transactional delivery evidence while needed for support and consent compliance; marketing delivery logs follow consent/privacy policy. | Do not retain message payloads longer than needed. |
| Event envelopes | Keep business/domain events according to source entity retention; technical replay archives may use tiered retention. | Event storage does not replace source repositories. |
| Raw analytics events | Keep short to medium term, for example 13 months, unless legal policy approves another period; anonymize or aggregate for longer retention. | Must respect consent. |
| Aggregated analytics projections | May be retained indefinitely when anonymized and non-identifying. | Should not allow re-identification. |
| Technical logs | Keep short-term, for example 30 to 180 days, unless security incident or audit policy requires longer. | Logs must not include secrets. |
| Idempotency records | Keep through duplicate submission risk window; payment/refund idempotency may need longer provider-aligned retention. | Safe expiry by operation category. |
| Runtime config snapshots | Keep active and recent historical versions; security-sensitive config references follow secrets policy. | Secret values are never stored in docs or snapshots. |

Retention rules:

- unresolved disputes, investigations, chargebacks, fraud review and legal holds pause deletion;
- anonymization must preserve financial and order audit references;
- retention must be implemented through explicit policies, not ad hoc deletion scripts;
- retention jobs must be idempotent and audited;
- backup retention must not silently violate deletion/anonymization policy.

---

# 20. Data Access Rules

| Consumer | Allowed data access | Restrictions |
|---|---|---|
| Mini App / Web App | Customer-safe catalog, configuration, pricing result, own order/payment/bonus/club account views | No raw provider data, no secrets, no other customers' data |
| Telegram Bot | Same customer-safe views and notification flows | Telegram ID resolves to `customer_id` through Authentication/Customer |
| CRM | Authorized projections, support views, audit views by role | Cannot edit source facts directly; sensitive commands require reason |
| Machine Runtime | Paid order fulfillment data, recipe references, machine commands | No payment credentials, no customer profile beyond necessary correlation |
| Payment Provider Adapter | Payment session/provider operation data | No product/business rule ownership |
| Analytics | Minimized event/projection data | Consent-aware, no raw personal data by default |
| AI modules | Approved projections and anonymized/consented features | AI output must be traceable and cannot mutate source data directly |
| Accounting Adapter | Ledger-backed facts and reconciliation references | Does not mutate Ledger or Payment history |

---

# 21. Future Extensions

The logical data model must support these future directions without broad rewrites:

1. Replace JSON/in-memory repositories with PostgreSQL-backed runtimes.
2. Add REST API and Event API contracts over the same model.
3. Introduce durable Event Bus, outbox and replayable projections.
4. Add product categories beyond soft ice cream, including drinks and desserts.
5. Add multiple sizes, add-ons, bundles and multi-item orders.
6. Add multi-machine and location-aware order routing.
7. Add machine inventory forecasting and maintenance records.
8. Add YooKassa adapter implementation and future payment providers.
9. Add SBP, card, payment link, QR, saved payment method and mixed payment flows.
10. Add partial refunds and provider reconciliation reports.
11. Add accounting export/import integrations.
12. Add Wallet, Club Account and Bonus production storage.
13. Add Promotion Runtime for configurable campaigns and rewards.
14. Add Notification Runtime with template versioning and consent-aware delivery.
15. Add CRM support, operator workflows and manual review queues.
16. Add analytics warehouse, funnels, cohort projections and dashboards.
17. Add personal data export, restriction, anonymization and deletion workflows.
18. Add franchise/partner data boundaries and multi-tenant ownership if approved.
19. Add AI recommendation modules over minimized, consent-aware projections.
20. Add data catalog, lineage and quality checks for production data governance.

---

# 22. Readiness Criteria

DATA-001 is complete when:

- logical data model document exists in `docs/data/PLATFORM_DATA_MODEL.md`;
- key entities are documented;
- key attributes are documented;
- relationships and cardinality are documented;
- aggregate boundaries are documented;
- data owners are documented;
- storage rules are documented;
- immutable records are documented;
- audit model is documented;
- retention direction is documented;
- future expansion directions are documented;
- `CHANGELOG.md`, `ENGINEERING_JOURNAL.md`, `docs/tasks/TASK_INDEX.md` and `docs/architecture/PROJECT_DECISIONS.md` are updated;
- no application source code is modified.

---

# 23. Documentation Scope

This document is documentation-only.

It does not introduce application code, frontend code, backend code, Telegram bot code, runtime configuration, database migrations, generated build output, payment provider integration, real credentials, legal text changes or final production retention policy.
