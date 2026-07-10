# Mini App Architecture Audit

Document code: PRODUCT-MINI-APP-AUDIT-001
Task: EPIC-200 / UX-001
Status: Draft
Version: 0.1
Project: Soft ICE Platform / Utimoshi
Created: 2026-07-10
Scope: Documentation only. No application code changes.

## Audit Principle

This audit reviews implementation readiness for the current Telegram Mini App and preserves existing architecture decisions. It does not redesign the platform, replace bounded contexts or move business ownership into UI screens.

The Mini App must remain a customer-facing client. Product, media, pricing, customer, bonus, club account, payment, order and machine rules belong to their documented services, runtimes, engines or adapters.

## Reviewed Sources

- `frontend/miniapp`
- `telegram-bot`
- `backend`
- `docs/api/API_OVERVIEW.md`
- `docs/api/AUTHENTICATION.md`
- `docs/api/AUTHORIZATION.md`
- `docs/api/REST_API.md`
- `docs/api/EVENT_API.md`
- `docs/api/WEBHOOKS.md`
- `docs/api/IDEMPOTENCY.md`
- `docs/api/ERROR_CODES.md`
- `docs/api/API_VERSIONING.md`
- `docs/domain/CUSTOMER_DOMAIN.md`
- `docs/domain/CLUB_ACCOUNT.md`
- `docs/domain/BONUS_DOMAIN.md`
- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/architecture/CHECKOUT.md`
- `docs/architecture/ORDER_PLATFORM.md`
- `docs/architecture/PAYMENT_ENGINE.md`
- `docs/integrations/YOOKASSA.md`
- `docs/crm_architecture.md`
- `docs/data/PLATFORM_DATA_MODEL.md`

## 1. Current Mini App Status

The current Telegram Mini App is a React + Vite customer interface shell with a home screen, product screen, local consent panel, local settings storage and local analytics logging. It is useful as a first purchase flow prototype, but it is not ready for a paid vending MVP.

| Area | Current status | Readiness |
|---|---|---|
| Mini App shell | `App.jsx` routes between home and product screen with local state. | Partial |
| Home screen | `MiniAppHomePage.jsx` presents purchase, club, bonus and location entry cards. | Partial |
| Product screen | `ProductScreen.jsx` lets the customer choose syrup and topping. Continue action logs an event only. | Partial |
| Design foundation | Shared design rules, global styles and documented tokens exist. | Partial |
| Catalog engine | Newer DDD Lite catalog, configuration, recipe and pricing service foundations exist under `frontend/miniapp/src/domain`. | Partial |
| Active UI integration | Product screen still reads the older `frontend/miniapp/src/domain/catalog.js` static module instead of the newer service layer. | Not ready |
| Media engine | `MediaService` wrapper exists, but the repository is not implemented. | Not ready |
| Customer identity | Customer Domain is documented; Mini App runtime identity resolution is not implemented. | Not ready |
| Telegram WebApp authentication | Authentication documentation exists; Mini App does not yet read or exchange Telegram `initData`. | Not ready |
| Order and checkout | Checkout and Order architecture are documented; Mini App has no order creation or checkout intent flow. | Not ready |
| Payment | Payment Domain and YooKassa direction are documented; Mini App has no payment session or payment status UI. | Not ready |
| Machine fulfillment | Machine and Order dispatch architecture are documented; Mini App has no fulfillment status UI. | Not ready |
| CRM integration | CRM architecture exists; Mini App is not connected to CRM projections or customer support flows. | Not ready |

Current verdict: the Mini App is a product-selection prototype and platform shell. The MVP requirement, "A customer can select a dessert, pay for it and receive it from a vending machine", is not yet met.

## 2. Existing Components

### Frontend Structure

| Path | Existing role |
|---|---|
| `frontend/miniapp/src/app/App.jsx` | Mini App shell and local screen switching. |
| `frontend/miniapp/src/pages/MiniAppHomePage.jsx` | Customer home screen and entry actions. |
| `frontend/miniapp/src/screens/02_PRODUCT/ProductScreen.jsx` | Product configuration prototype for syrup and topping choice. |
| `frontend/miniapp/src/components/ActionCard.jsx` | Reusable action card for home actions. |
| `frontend/miniapp/src/components/AppHeader.jsx` | Header component. |
| `frontend/miniapp/src/components/BottomNavigation.jsx` | Bottom navigation component. |
| `frontend/miniapp/src/consent/ConsentPanel.jsx` | Local consent UI and local storage integration. |
| `frontend/miniapp/src/storage/userSettingsStorage.js` | Versioned local user settings storage. |
| `frontend/miniapp/src/analytics/trackEvent.js` | Local analytics event logging placeholder. |
| `frontend/miniapp/src/analytics/source.js` | URL source and entry point parsing. |
| `frontend/miniapp/src/shared/design/designRules.js` | Shared Mini App design rules and microcopy. |
| `frontend/miniapp/src/styles/global.css` | Active CSS variables and responsive UI styling. |

### Domain And Service Foundations

| Domain slice | Existing implementation |
|---|---|
| Catalog | Product, flavor, syrup and topping entities, repository and service exist with stable semantic IDs. |
| Configuration | Configuration entity, repository and service exist for product option validation. |
| Recipe | Recipe entity, repository and service exist for recipe validation and ingredient composition. |
| Pricing | Pricing entity, repository and service exist for MVP price calculation and bonus allowance output. |
| Media | Service and repository structure exists, but repository methods are not implemented. |
| Order | Service and repository structure exists, but repository methods are not implemented. |
| Payment | Service and repository structure exists, but repository methods are not implemented. |
| Customer | Service and repository structure exists, but repository methods are not implemented. |
| Loyalty | Service and repository structure exists, but repository methods are not implemented. |
| Machine | Service and repository structure exists, but repository methods are not implemented. |

### Supporting Systems

- The Telegram bot opens the Mini App through a WebApp button and already frames purchase, club, certificate and support entry points.
- The backend contains an Express placeholder and payment stub endpoints, but not the documented `/api/v1` runtime contracts.
- YooKassa verification documentation exists for screenshot and provider review work.
- API, Authentication, Authorization, Customer, Club Account, Bonus, Payment, Order, Machine and CRM documentation provide architecture direction, but runtime integration is incomplete.

## 3. Missing Components

| Area | Missing component |
|---|---|
| Telegram WebApp bridge | Mini App wrapper for `window.Telegram.WebApp`, `ready`, viewport data, theme data and `initData` collection. |
| Authentication exchange | Backend endpoint that verifies Telegram Mini App `initData`, applies freshness checks and returns platform tokens/session. |
| Customer resolution | Runtime path from authenticated Telegram alias to canonical `customer_id`. |
| API client | Mini App API client with token attachment, refresh handling, error mapping, retry policy and idempotency support where needed. |
| Product service integration | Product screen integration with Catalog, Configuration, Recipe, Pricing and Media services instead of the older static catalog module. |
| Media selection | Implemented Media repository and fallback rules outside the UI. |
| Preview screen | Order preview with immutable configuration, media, price quote, selected machine/location and clear payment action. |
| Checkout intent | Server-backed checkout or order creation flow that freezes product, configuration, price and discount snapshots. |
| Payment session | Payment method screen, payment session creation, QR/link/redirect handoff and expiration handling. |
| Payment status | Pending, success, failure, cancellation and retry states based on backend payment status, not client assumptions. |
| Order status | Fulfillment and machine preparation status screen after confirmed payment. |
| Club Account UI | Club balance, top-up, consent and history views backed by the Club Account domain. |
| Bonus UI | Bonus balance, available discount rights, reservation result and expiry messaging backed by Bonus/Discount domains. |
| CRM projection | Customer support and CRM-facing projections for customer, order, payment and machine incident context. |
| API reference completion | Webhooks, Idempotency, Error Codes and API Versioning files exist but still need production-grade content. |

## 4. User Journey Analysis

### Current Journey

1. Customer opens the Telegram bot.
2. Bot presents a WebApp button for the Mini App.
3. Mini App opens the home screen.
4. Customer selects the purchase action.
5. Product screen opens with one product and local syrup/topping choices.
6. Customer taps continue.
7. The app logs an analytics event and stops.

Current gaps:

- No Telegram `initData` verification.
- No platform `customer_id` resolution.
- No product service integration in the active product screen.
- No media engine image selection.
- No pricing quote from the runtime/API.
- No preview or checkout intent.
- No order creation.
- No payment session.
- No payment confirmation.
- No machine dispatch.
- No fulfillment or receipt state.

### Required MVP Journey

1. Customer launches the Mini App from Telegram.
2. Mini App sends Telegram WebApp `initData` to the authentication endpoint.
3. Authentication verifies Telegram data and creates a secure platform session.
4. Customer Domain resolves or creates the canonical `customer_id`.
5. Mini App loads catalog, available options, media and price quote through runtime-backed APIs.
6. Customer configures dessert using allowed flavor, syrup and topping options.
7. Mini App shows preview and checkout summary.
8. Server creates an order or checkout intent with immutable configuration and pricing snapshots.
9. Payment Runtime creates a YooKassa-backed payment session.
10. Customer completes payment through the provider flow.
11. Platform confirms payment through webhook and/or status polling.
12. Order becomes paid only after confirmed payment.
13. Machine Runtime receives a paid-order dispatch command.
14. Mini App shows preparation, dispense, success, failure or recovery status.

This path matches the existing architecture: selection, checkout, pricing, discount, order, payment and machine dispatch remain separate responsibilities.

## 5. Required Screens

| Screen | Purpose | Current status |
|---|---|---|
| Launch / authentication state | Handle WebApp readiness, session restore, Telegram auth exchange, loading and auth errors. | Missing |
| Home | Entry point for purchase, club, bonus and location actions. | Exists, partial |
| Product catalog or product selection | List available products and start configuration. | Partial; single product prototype |
| Product configurator | Select flavor, syrup, topping and size using allowed product options. | Partial; active screen uses old static data |
| Product preview / order summary | Show selected dessert, media, final quote, discounts, machine/location and checkout action. | Missing |
| Machine/location availability | Confirm vending point and machine availability before or during checkout. | Missing |
| Payment method / confirmation | Create payment session and send customer to provider, QR, link or Telegram-compatible payment flow. | Missing |
| Payment pending | Show waiting state while provider/webhook/polling confirmation is incomplete. | Missing |
| Payment result | Show success, failure, cancellation or expired session with allowed recovery actions. | Missing |
| Order progress | Show paid order queue, preparation, dispensing and completion status. | Missing |
| Receipt / completion | Show final order result, receipt reference and support entry. | Missing |
| Club Account | Show prepaid club balance, top-up entry, consent and transaction history. | Missing |
| Bonus | Show available non-monetary discount rights, expiration and applied/reserved bonus state. | Missing |
| Profile / consent | Show customer profile, Telegram link, consent status and privacy controls. | Partial local consent only |
| Support / CRM handoff | Create or open support context for failed payment, failed dispensing or customer questions. | Missing |

For MVP, Club Account, Bonus and full Profile screens can be minimal read-only or deferred if they do not block the first paid vending purchase. Payment, order status and machine fulfillment screens cannot be deferred for the MVP goal.

## 6. API Dependencies

| Capability | API dependency | Current documentation state |
|---|---|---|
| Telegram Mini App auth | Endpoint for Telegram `initData` verification, session creation and token response. | Authentication flow documented; REST endpoint contract not yet explicit. |
| Session handling | Access token, refresh token, expiration, restore and logout rules. | Authentication documented; implementation absent. |
| Customer identity | Customer resolution by verified Telegram alias into `customer_id`. | Customer Domain documented; API/runtime implementation absent. |
| Catalog | Product and option reads such as `GET /api/v1/products`, `GET /api/v1/products/{product_id}`, `GET /api/v1/products/{product_id}/options`. | REST candidates documented; active Mini App uses local data. |
| Configuration validation | Server/runtime validation for selected flavor, syrup, topping and size. | REST candidate documented. |
| Pricing quote | Price quote endpoint such as `POST /api/v1/pricing/quotes`. | REST candidate documented; runtime/UI integration absent. |
| Product media | Media lookup for selected product configuration. | Domain model documented; REST candidate and implementation need completion. |
| Order creation | Create order or checkout intent with immutable product, configuration, price and discount snapshots. | Order architecture documented; REST candidate documented. |
| Payment session | Create and read payment session/payment intent status. | Payment architecture documented; REST candidate documented; backend has only stub endpoints. |
| Payment webhook | Provider callback for confirmed, failed, expired and refunded payment facts. | Webhook file exists but is empty. |
| Idempotency | Idempotency keys for order and payment operations. | REST/API overview mention idempotency; dedicated file exists but is empty. |
| Error handling | Stable error response shape and customer-safe error mapping. | REST mentions error format; dedicated error code file exists but is empty. |
| API versioning | `/api/v1` compatibility and breaking-change rules. | REST mentions versioning; dedicated versioning file exists but is empty. |
| Bonus | Bonus balance, reservation, release, redemption and discount effect APIs. | Bonus Domain documented; REST bonus candidates documented. |
| Club Account | Club balance, top-up, reserve/spend and transaction history APIs. | Club Account domain documented; explicit REST resource group needs alignment. |
| Machine fulfillment | Machine availability and paid-order fulfillment status APIs/events. | Machine and Order docs exist; runtime/API implementation absent. |
| CRM | Customer, order, payment and incident projections for support operations. | CRM architecture exists; API/projection contracts need alignment with newer domain boundaries. |

The API documentation is directionally strong, but the Mini App cannot become purchase-ready until auth, checkout, order, payment status, webhooks, idempotency, error codes and versioning are implemented as concrete contracts.

## 7. Authentication Readiness

Authentication documentation is strong enough to guide implementation. It correctly separates authentication from authorization and business logic, treats `customer_id` as the platform identity and treats Telegram ID as an external alias.

Readiness gaps:

- Mini App does not yet read `window.Telegram.WebApp.initData`.
- Mini App does not send Telegram Mini App init data to a backend authentication endpoint.
- Backend does not yet expose the documented Telegram Mini App authentication exchange.
- Backend does not verify Telegram signature with the bot secret.
- Backend does not enforce `auth_date` freshness for Mini App login.
- Customer Domain resolution from verified Telegram alias to `customer_id` is not implemented.
- Token storage, refresh, session restoration and logout are not implemented in the Mini App.
- Authorization scopes/permissions are documented but not integrated into runtime APIs.

Telegram Login / WebApp flow note:

- The current product path is a Telegram WebApp launch from the bot, not a standalone Telegram Login widget flow.
- For this path, the critical credential is Telegram WebApp `initData`, verified server-side.
- Mini App screens must not trust URL parameters, local storage or client-calculated identity as proof of customer identity.

Authentication readiness verdict: documented, but not implementation-ready in the Mini App or backend yet.

## 8. Payment Integration Readiness

Payment architecture is documented with the correct boundaries: Payment Domain is provider-agnostic, YooKassa is a provider adapter, payment links and QR sessions expire, payment confirmation must come from provider facts, and machine preparation starts only after confirmed payment.

Current payment implementation gaps:

- Mini App has no payment screen, payment session creation, provider handoff, QR/link handling or payment status state.
- Backend payment endpoints are stubs and do not match the documented `/api/v1` contract direction.
- YooKassa provider adapter is not implemented.
- YooKassa webhook handling and verification are not implemented.
- Payment operation registry is not implemented.
- Idempotent payment creation is not implemented.
- Payment expiration, cancellation, failure, refund and reconciliation flows are not implemented.
- Order paid state is not connected to `Payments.Completed` or equivalent confirmed payment event.
- Machine dispatch is not gated by confirmed payment in executable code.

YooKassa verification documentation exists and should remain the payment-provider onboarding reference. The Mini App is not yet ready for a real payment integration until the backend Payment Runtime and order/payment API contracts exist.

Payment readiness verdict: architecture-ready, implementation not ready.

## 9. CRM Integration Readiness

CRM documentation exists and establishes CRM as an operational system for customers, purchases, bonuses, loyalty, machines and support work. The newer domain documents clarify that Customer, Club Account, Bonus, Payment, Order and Machine remain separate owners of business facts.

Current CRM integration gaps:

- Mini App does not send authenticated customer events to a CRM projection.
- Mini App has no support handoff with order/payment/machine context.
- Backend does not expose CRM-ready customer or order projections.
- CRM terminology should be aligned with newer domain decisions, especially Bonus as non-monetary discount rights and Club Account as a separate prepaid customer balance.
- Prisma schema is an early physical snapshot and should not be treated as the full source of truth for CRM behavior.

CRM should consume platform facts and projections. It should not become the owner of payment confirmation, bonus redemption, product pricing or machine dispatch decisions.

CRM readiness verdict: architecture direction exists, integration not ready.

## 10. MVP Roadmap

### Phase 1 - Stabilize Mini App Product Flow

- Connect the active product UI to the current Catalog, Configuration, Recipe and Pricing service foundations.
- Complete Media Engine repository behavior and use it through `MediaService`.
- Keep product names, prices, option lists and media paths out of React screens.
- Keep the visible flow close to the existing home and product screens.

### Phase 2 - Add Telegram Authentication And Customer Identity

- Add Mini App WebApp bridge for readiness, theme, viewport and `initData`.
- Add backend Telegram Mini App authentication endpoint.
- Verify Telegram init data server-side and resolve `customer_id` through Customer Domain.
- Add Mini App session/token lifecycle.

### Phase 3 - Add Preview And Checkout Intent

- Add preview/order summary screen.
- Validate configuration before checkout.
- Request server-side price quote.
- Create checkout intent or order draft with immutable snapshots.
- Add basic machine/location availability dependency without moving machine logic into the UI.

### Phase 4 - Add Payment MVP

- Implement Payment Runtime API for payment session creation and status read.
- Implement YooKassa adapter behind the provider-agnostic payment model.
- Implement webhook confirmation, polling fallback, expiration and idempotency.
- Add Mini App payment pending, success, failure and expired states.
- Publish or expose confirmed payment facts for Order.

### Phase 5 - Add Paid Order Fulfillment

- Transition order to paid only after confirmed payment.
- Dispatch only paid orders to Machine Runtime.
- Add Mini App order progress and dispensing result screen.
- Add failure recovery and support handoff.

### Phase 6 - Add Customer Value Screens

- Add minimal Profile and consent screen backed by Customer Domain.
- Add Bonus screen backed by Bonus Domain and Discount/Pricing result.
- Add Club Account screen backed by Club Account and Payment domains.
- Add CRM support projection for customer, order, payment and machine incident context.

## Summary

The Mini App has a useful UI shell and early product-selection prototype. The domain and architecture documentation is ahead of runtime integration, which is a good position for a controlled MVP build.

The next engineering increment should not redesign the Mini App. It should connect the current screens to the already documented service boundaries, then add Telegram authentication, customer identity, checkout/order creation, YooKassa-backed payment and paid machine fulfillment in that order.
