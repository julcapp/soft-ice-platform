# Mini App MVP Specification

Document code: PRODUCT-MINI-APP-MVP-001
Task: EPIC-200 / UX-002
Status: Draft
Version: 0.1
Project: Soft ICE Platform / Utimoshi
Created: 2026-07-10
Scope: Documentation only. No application code changes.

Related documents:

- `docs/product/MINI_APP_AUDIT.md`
- `docs/domain/CUSTOMER_DOMAIN.md`
- `docs/domain/CLUB_ACCOUNT.md`
- `docs/domain/BONUS_DOMAIN.md`
- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/data/PLATFORM_DATA_MODEL.md`
- `docs/architecture/PROJECT_DECISIONS.md`
- `docs/api/REST_API.md`
- `docs/api/EVENT_API.md`

---

# 1. Purpose

This document defines the first practical MVP version of the Telegram Mini App for Soft ICE Platform.

The Mini App is the customer-facing self-service surface inside Telegram. It gives the customer a simple way to enter the platform, identify themselves, view their account state, pay for purchases or top-ups, see purchase history and return to loyalty actions without using CRM, admin tools or machine operator interfaces.

Mini App is:

- customer self-service interface;
- personal account;
- loyalty interface;
- payment entry point.

Mini App is not:

- CRM;
- admin panel;
- machine control interface.

The MVP Mini App must preserve the platform boundaries already documented in Customer, Club Account, Bonus, Payment, Order, REST API and Event API documentation. It may show state and submit customer commands, but it must not own business rules, calculate final prices, mutate balances, confirm payments, execute orders or control machines directly.

# 2. MVP User Journey

The MVP journey connects Telegram discovery, customer identity, payment and loyalty return loops.

```text
Discovery
->
Telegram Bot
->
Mini App launch
->
Authentication
->
Customer profile creation
->
Club Account
->
Payment
->
Purchase history
->
Bonuses
->
Return visit
```

1. Discovery: customer finds the business through Telegram, a QR code, social media, vending location material, referral link or direct bot entry.
2. Telegram Bot: bot presents a customer-safe entry point to open the Mini App and may provide purchase, club, bonus or support entry actions.
3. Mini App launch: Telegram opens the Mini App WebView and the app initializes Telegram WebApp readiness, theme, viewport and launch context.
4. Authentication: Mini App sends Telegram WebApp `initData` to the backend authentication flow. The backend verifies Telegram data server-side before any platform identity is trusted.
5. Customer profile creation: Customer Runtime resolves or creates the canonical `customer_id`, links the verified Telegram identity as an external alias and exposes a minimal customer profile.
6. Club Account: customer can view Club Account status, prepaid balance, recommended top-up action and account transaction history when the account exists or activation is available.
7. Payment: customer can start a YooKassa-backed payment flow for a purchase or top-up, including SBP, QR or provider payment flow where available, and must see pending, successful, failed, cancelled and expired states.
8. Purchase history: customer can see their own paid and historical purchases with date, machine, amount, discounts and bonus effects.
9. Bonuses: customer can see Bonus Account balance, earned bonuses, spent bonuses and referral bonuses as non-monetary discount rights.
10. Return visit: customer reopens the Mini App from Telegram with a restored authenticated session, sees current account and loyalty state, and can repeat payment or purchase flows without re-entering unnecessary data.

# 3. MVP Screens

The MVP screen set is the customer account, loyalty and payment shell around the purchase flow. Product selection and configuration remain governed by Product, Configuration, Pricing, Media, Checkout and Order contracts and are not redefined in this document.

## Home

Purpose: customer dashboard and entry point for the most common actions.

Contains:

- customer name;
- club status;
- club account balance;
- bonus balance;
- current offers;
- main actions.

Main actions:

- start or continue a purchase;
- open Club Account;
- top up Club Account;
- open payments or active payment status;
- view purchases;
- view bonuses;
- open profile.

Home must use read models from Customer, Club Account, Bonus, Payment, Order and Notification APIs. It must not calculate balances, bonuses, discounts, payment state or offer eligibility locally.

## Club Account

Purpose: customer-facing prepaid Club Account view.

Contains:

- balance;
- top-up action;
- transaction history;
- payment status.

Required states:

- no account or activation available;
- active account;
- suspended account;
- low balance;
- top-up pending;
- top-up credited;
- top-up failed or expired.

The Club Account screen must label prepaid money balance separately from bonus balance. It must not describe Club Account as a bank account or as bonus cash.

## Payments

Purpose: payment entry and status surface for purchases and Club Account top-ups.

Contains:

- YooKassa payment flow;
- SBP payment flow;
- QR payment flow;
- payment status.

Required states:

- method selection available;
- confirmation required;
- QR or link active with expiration;
- pending provider confirmation;
- completed;
- failed;
- cancelled;
- expired;
- manual review or reconciliation required.

Payment UI must treat QR codes, payment links and provider redirects as confirmation surfaces only. Payment success is shown only after Payment Runtime reports confirmed platform payment state.

## Purchases

Purpose: customer-visible purchase history.

Contains:

- purchase history;
- date;
- machine;
- amount;
- discounts;
- bonuses.

Required states:

- empty history;
- loaded history;
- loading more;
- failed history load;
- purchase detail available.

Purchase rows should show customer-safe order information only. Product configuration, pricing, discount and bonus details come from Order, Pricing, Discount and Bonus snapshots or projections, not from UI reconstruction.

## Bonus Account

Purpose: customer-visible bonus rights view.

Contains:

- bonus balance;
- earned bonuses;
- spent bonuses;
- referral bonuses.

Required states:

- no Bonus Account or no active bonuses;
- active bonus balance;
- pending or earned bonuses;
- spent or redeemed bonuses;
- referral bonus pending or issued;
- bonus expiration messaging where provided by Bonus Runtime.

Bonus Account must describe bonuses as discount rights. Bonus balance never replaces money balance and cannot be shown as cash, wallet funds, Club Account funds or a payment method.

## Profile

Purpose: customer profile, contact and consent view.

Contains:

- name;
- phone;
- email;
- birthday;
- consent status.

Required states:

- Telegram profile only;
- editable allowed profile fields;
- contact missing;
- contact pending verification;
- contact verified;
- consent granted;
- consent revoked or missing.

Profile must avoid forced registration language. It should use customer-friendly language such as "Continue", "Join Club Timofey", "Get bonuses" and "Update profile" while preserving consent and privacy requirements.

# 4. Authentication

MVP authentication uses Telegram Login / Telegram WebApp authentication through the Telegram Mini App launch context.

Telegram WebApp authentication flow:

1. Mini App reads Telegram WebApp launch data from `window.Telegram.WebApp`.
2. Mini App sends Telegram WebApp `initData` to the backend authentication endpoint.
3. Backend verifies Telegram signature with the bot secret and checks `auth_date` freshness.
4. Authentication creates a normalized identity context.
5. Customer Runtime resolves or creates the canonical `customer_id`.
6. Customer Runtime links Telegram ID as an external alias, not as the platform customer identity.
7. API returns a secure platform session or token set for Mini App calls.

User identification rules:

- `customer_id` is the primary platform identity;
- Telegram user ID is an external alias;
- Telegram username is mutable display metadata;
- URL parameters, local storage and client-side state are not trusted identity proof;
- customer self-service requests are scoped to the authenticated customer's own `customer_id`.

Session management rules:

- Mini App restores session when a valid platform session exists;
- expired or missing session triggers a fresh Telegram WebApp authentication exchange;
- access tokens must be short-lived;
- refresh or restore behavior must be controlled by Authentication contracts;
- raw Telegram `initData`, bot tokens and provider secrets must not be logged, stored in general domain records or exposed to frontend-readable persistent storage.

Customer binding rules:

- verified Telegram identity is bound to exactly one active customer unless conflict review is required;
- identity link creation and conflict resolution are auditable Customer Domain operations;
- customer profile creation is minimal and purpose-bound;
- Club Account, Bonus Account, Payment and Order data are accessed only after customer binding succeeds.

# 5. API Dependencies

Mini App depends on REST APIs for synchronous reads and commands, and Event API facts for projections, notifications and status updates. Endpoint names below are contract dependencies or candidates aligned with `docs/api/REST_API.md`; final route schemas belong to future API implementation tasks.

| Screen | Customer API | Club Account API | Bonus API | Payment API | Order API | Notification API |
|---|---|---|---|---|---|---|
| Home | Read `customers/me` for name, profile and consent summary. | Read own Club Account balance and status. | Read own bonus projection. | Read active or recent payment status when relevant. | Read recent own orders or active order summary. | Read visible offers and notification preference summary. |
| Club Account | Confirm customer scope and club status. | Read balance, top-up options, transaction history and account state; create top-up intent. | Read bonus summary only for separate display if needed. | Create or read payment for top-up. | Read order references for spending transactions. | Request or suppress low-balance and top-up notifications through Notification Runtime policy. |
| Payments | Confirm authenticated customer context. | Read settlement line when payment uses Club Account top-up or balance. | Read bonus reservation or redemption reference only when tied to checkout. | Create payment, create or replace payment session, read status, cancel pending payment where allowed. | Read order payable state and fulfillment gating after payment completion. | Send payment status, failure or receipt-related notifications when policy allows. |
| Purchases | Confirm own customer access. | Read Club Account transaction reference when purchase used prepaid balance. | Read bonus accrual/redemption references. | Read payment reference and safe status. | List own orders, read order detail and fulfillment status. | Request receipt or support notification where available. |
| Bonus Account | Confirm customer and club context. | Read only separate balance label if shown nearby. | Read bonus projection, history, earned, spent, referral and expiration data. | No direct dependency except payment-qualified reward facts. | Read qualifying purchase references. | Request bonus accrual, referral or expiration notifications through Notification Runtime policy. |
| Profile | Read and update allowed own profile fields; read consent summary. | Read Club Account existence/status only for account links. | Read Bonus Account existence/status only for loyalty links. | No direct dependency except saved payment method consent references when future flows require them. | Read no order data by default. | Read and update notification preferences where supported. |

Recommended endpoint dependency examples:

- Customer API: `GET /api/v1/customers/me`, `PATCH /api/v1/customers/me`.
- Club Account API: `GET /api/v1/club-accounts/me`, `GET /api/v1/club-accounts/me/transactions`, `POST /api/v1/club-account-top-ups`.
- Bonus API: `GET /api/v1/bonuses/me`, `GET /api/v1/bonuses/me/events`.
- Payment API: `POST /api/v1/payments`, `GET /api/v1/payments/{payment_id}`, `POST /api/v1/payments/{payment_id}/cancellation-requests`.
- Order API: `GET /api/v1/orders`, `GET /api/v1/orders/{order_id}`, `GET /api/v1/orders/{order_id}/fulfillment`.
- Notification API: `PATCH /api/v1/customers/me/notification-preferences`, notification requests and events owned by Notification Runtime.

Event dependencies:

- `Customers.Created`, `Customers.IdentityLinked`, `Customers.ProfileUpdated`, `Customers.ConsentGranted`, `Customers.ConsentRevoked`;
- `ClubAccounts.Activated`, `ClubAccounts.TopUpCredited`, `ClubAccounts.BalanceChanged`, `ClubAccounts.BalanceDroppedBelowMinimum`;
- `Bonus.Accrued`, `Bonus.Reserved`, `Bonus.Redeemed`, `Bonus.Expired`, `Bonus.ProjectionChanged`;
- `Payments.SessionCreated`, `Payments.ConfirmationRequired`, `Payments.Completed`, `Payments.Failed`, `Payments.Expired`, `Payments.Cancelled`;
- `Orders.Created`, `Orders.PaymentConfirmed`, `Orders.Completed`, `Orders.Cancelled`, `Orders.Expired`;
- `Notifications.Requested`, `Notifications.Sent`, `Notifications.Failed`, `Notifications.Suppressed`.

# 6. MVP Business Rules

MVP business rules:

1. Club Account and Bonus Account are separate.
2. Bonus balance never replaces money balance.
3. Payment confirmation is required before order execution.
4. Discounts and bonuses follow existing rules.
5. User permissions are limited to own data.
6. Mini App never calculates final price, discount stacking, bonus redemption, payment outcome or machine fulfillment state locally.
7. Payment success is shown only from Payment Runtime status or approved payment projection.
8. Machine preparation starts only after full confirmed payment and Order policy acceptance.
9. Customer identity is `customer_id`; Telegram ID is an external alias.
10. Club Account top-up and purchase payment operations require idempotency.
11. QR and payment links have explicit expiration; expired sessions cannot start preparation.
12. Purchase history uses Order and Payment records and snapshots, not reconstructed UI state.
13. Profile and consent data must be minimal, purpose-bound and customer-safe.
14. Customer support links may open support context, but the Mini App does not become CRM.

# 7. MVP Out of Scope

The MVP Mini App specification explicitly excludes:

- admin functions;
- machine control;
- analytics dashboards;
- complex gamification;
- marketplace features.

Also out of scope for this document:

- CRM operator workflows;
- vending machine command screens;
- payment provider adapter implementation;
- final legal text;
- final commercial bonus, referral or promotion amounts;
- advanced campaign management;
- multi-product marketplace browsing beyond approved product flow contracts;
- runtime code, frontend code, backend code, database migrations and deployment configuration.

# 8. UI/UX Principles

MVP UI/UX principles:

- simple minimal design;
- mobile-first;
- fast interaction;
- Russian language;
- clear payment states.

Detailed principles:

- The interface should show the next natural customer action without requiring instruction.
- The app should avoid forced "registration" language in customer journeys.
- Screens should be optimized for Telegram Mini App mobile use first, with responsive behavior ready for tablet, desktop, vending terminal and large touch layouts.
- Payment states must be explicit: pending, confirmation required, successful, failed, cancelled, expired and manual review where applicable.
- Money balance, bonus rights, discounts and payment state must be visually and textually distinct.
- Main actions should remain reachable quickly from Home.
- Loading states longer than two seconds should show clear Russian customer-facing status text.
- Error states should be recoverable where possible and safe to show without exposing internal provider, payment, identity or policy details.
- Product, account, payment and bonus images must come through Media or approved asset contracts, not screen-local hardcoded paths.

# 9. Future Extensions

Possible future Mini App additions:

- challenges;
- photo contests;
- advanced loyalty;
- subscriptions;
- multiple products.

Additional extension directions:

- referral invite and referral progress screen;
- birthday bonus and seasonal offers;
- saved payment method consent and one-click top-up;
- auto top-up settings after legal and provider approval;
- support case view linked to order, payment or machine incident;
- receipt and fiscal document access;
- favorite product configuration;
- multi-machine and location-aware availability;
- richer Club Timofey branded experience with approved Timofey media;
- future Promotion Runtime campaign participation surfaces.

---

# Documentation Scope

This specification is documentation-only.

It does not introduce application code, frontend code, backend code, Telegram bot code, runtime configuration, database migrations, generated build output or new architecture decisions.
