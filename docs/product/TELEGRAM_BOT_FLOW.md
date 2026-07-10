# Telegram Bot User Flow Specification

Document code: PRODUCT-TELEGRAM-BOT-FLOW-001
Task: EPIC-202 / BOT-001
Status: Draft
Version: 0.1
Project: Soft ICE Platform / Utimoshi
Created: 2026-07-10
Scope: Documentation only. No application code changes.

Related documents:

- `docs/product/MINI_APP_AUDIT.md`
- `docs/product/MINI_APP_MVP_SPEC.md`
- `docs/product/LANDING_SPEC.md`
- `docs/domain/CUSTOMER_DOMAIN.md`
- `docs/domain/CLUB_ACCOUNT.md`
- `docs/domain/BONUS_DOMAIN.md`
- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/domain/CONSENT_MODEL.md`
- `docs/api/REST_API.md`
- `docs/api/EVENT_API.md`
- `docs/api/AUTHENTICATION.md`
- `docs/api/AUTHORIZATION.md`
- `docs/telegram_bot.md`

---

# 1. Bot purpose

Telegram Bot is the customer communication entry point for Soft ICE Platform.

The bot role:

- entry point for customers from Telegram, QR codes, landing page, social links, referral links and support links;
- notification channel for transactional and consented marketing messages;
- Mini App launcher for purchase, Club Account, bonuses, purchases, profile and payment flows;
- customer communication channel for short prompts, recovery links, payment status, purchase status and support handoff.

The bot is:

- a communication layer;
- a Telegram channel adapter;
- a customer-safe navigation and notification surface;
- a launcher for Mini App flows;
- a channel for identity binding prompts and consent prompts.

The bot is not:

- Mini App UI;
- CRM;
- admin panel;
- payment provider adapter;
- pricing engine;
- bonus engine;
- Club Account ledger;
- order state machine;
- machine control interface.

Core boundary:

```text
Telegram Bot communicates with the customer.
Mini App provides the interactive customer UI.
Backend Runtimes own identity, consent, account, bonus, order, payment and notification logic.
```

The bot must not calculate final price, mutate Club Account balance, reserve or redeem bonuses, confirm payment, change order lifecycle, send machine commands or infer fulfillment status from timers.

# 2. First launch scenario

First launch flow:

```text
User opens bot
->
Welcome message
->
Consent
->
Registration / profile completion
->
Telegram identity binding
->
Open Mini App
```

## 2.1 User opens bot

Entry sources may include:

- direct bot search;
- `/start`;
- landing page CTA;
- machine QR code;
- referral link;
- support link;
- payment or order recovery link.

The bot may receive a Telegram `start` parameter, campaign code, referral code, machine/location hint or payment/order recovery context. These values are launch context only. They must not be trusted as identity proof, payment proof, discount eligibility or order state.

## 2.2 Welcome message

The welcome message should:

- greet the customer;
- explain that the bot opens the Mini App;
- show the main menu;
- make support reachable;
- avoid forced registration language in customer-facing copy.

Recommended customer-facing intent:

```text
Welcome to Utimoshi.
Open the Mini App to buy ice cream, view Club Account, check bonuses or get help.
```

The bot may show a short privacy notice before collecting personal data.

## 2.3 Consent

Consent is required before restricted processing.

Consent types relevant to bot launch:

- `personal_data_processing` for profile/contact data collection;
- `transactional_communications` for payment, purchase and account service messages;
- `marketing_communications` for promotions and campaigns;
- `loyalty_terms_acceptance` for Club Timofey participation;
- `referral_program_terms` when referral scenarios are active.

Consent rules:

- consent is explicit and versioned;
- consent evidence is stored by backend Consent/Customer contracts;
- marketing consent is optional and separate from transactional communications;
- consent revocation must be available through Profile or support flow;
- bot messages must respect current consent and notification preferences.

## 2.4 Registration / profile completion

Registration is the internal flow name. Customer-facing copy should use softer actions such as:

- `Continue`;
- `Join Club Timofey`;
- `Update profile`;
- `Get bonuses`;
- `Open Mini App`.

Profile completion may collect:

- name or display name;
- phone;
- email;
- consent choices.

The bot should collect only the minimum data needed for the selected scenario. Basic purchase flow should not require Club participation unless a future Product Owner-approved policy requires it.

## 2.5 Telegram identity binding

Telegram identity binding connects Telegram user context to canonical `customer_id`.

Expected binding flow:

```text
Bot receives authenticated Telegram update
->
Bot sends safe Telegram alias context to backend
->
Authentication / channel boundary verifies bot request
->
Customer Runtime resolves or creates customer_id
->
Customer Runtime links Telegram user ID as external alias
->
Customer session and notification route become available
```

Binding rules:

- `customer_id` is the primary platform identity;
- Telegram user ID is an external alias;
- Telegram username is mutable display metadata;
- Telegram chat ID is a notification/contact route, not a customer identity;
- raw Telegram bot tokens, webhook secrets, init data, access tokens and provider secrets must not be stored in Customer records or events;
- identity conflicts must go to backend review instead of silent relinking.

Mini App authentication still uses Telegram WebApp `initData` verification when the Mini App is opened.

## 2.6 Open Mini App

After welcome, consent and identity binding, the bot shows an `Open Mini App` button.

The Mini App launch may include safe launch context, such as:

- entry source;
- referral code reference;
- machine/location hint;
- return path to Club Account, Bonuses, Purchases, Profile or Payment screen.

Launch context must be signed, scoped or treated as untrusted until backend verification. The Mini App must authenticate through Telegram WebApp `initData` and backend session contracts before showing protected customer data.

# 3. Main menu

The main menu contains these buttons:

```text
Open Mini App
Club Account
Bonuses
Purchases
Profile
Help
```

Recommended behavior:

| Button | Purpose | Bot behavior | Runtime owner |
|---|---|---|---|
| `Open Mini App` | Start or resume the customer self-service UI. | Opens Mini App with optional safe launch context. | Mini App and backend Authentication / Customer contracts. |
| `Club Account` | Show prepaid account entry point. | Shows safe balance/status summary when available, then opens Mini App Club Account view or top-up flow. | Club Account Runtime and Payment Runtime. |
| `Bonuses` | Show bonus rights entry point. | Shows safe bonus summary when available, then opens Mini App Bonus view. | Bonus Runtime. |
| `Purchases` | Show purchase history entry point. | Shows recent safe order summary or opens Mini App Purchases view. | Order Runtime and Payment Runtime. |
| `Profile` | Manage profile and consent. | Opens profile completion, contact update or consent management path. | Customer Runtime and Consent contracts. |
| `Help` | Customer support and recovery. | Shows support options and may create support context with safe references. | CRM/support contracts and Notification Runtime. |

Menu rules:

- menu labels must be customer-safe and stable;
- menu actions must not expose internal state names or provider errors;
- protected data requires resolved `customer_id`;
- bot must not reconstruct balances, bonuses, purchase history or payment status locally;
- unavailable services should show a recovery message and support path.

# 4. Registration flow

Registration flow collects minimal customer data needed for customer identity, communication and Club participation.

## 4.1 Flow triggers

Registration/profile completion may start when:

- first launch has no linked customer;
- the customer chooses `Profile`;
- the customer chooses `Club Account` and Club terms/contact data are missing;
- payment, receipt, support or delivery policy requires contact data;
- consent version changed and re-acceptance is required.

## 4.2 Name

Name rules:

- Telegram first name may be suggested as `display_name`;
- customer may edit name in bot or Mini App;
- full legal name is not required for MVP unless a future legal/payment policy requires it;
- name is personal data and must be stored through Customer Runtime, not bot-local state.

## 4.3 Phone

Phone rules:

- phone may be requested through Telegram contact sharing or typed input;
- phone should be normalized and verified by backend policy before being marked verified;
- bot may show a masked phone after collection;
- raw phone must not be placed in analytics events, public logs or general event payloads;
- phone collection requires `personal_data_processing` and may require `transactional_communications` depending on use.

## 4.4 Email

Email rules:

- email is optional for MVP unless receipt, support or future legal policy requires it;
- email verification state must be explicit;
- bot may show masked email after collection;
- raw email must not be placed in analytics events, public logs or general event payloads;
- email may support receipts, support follow-up and future account recovery only through approved contracts.

## 4.5 Consent management

Consent management must support:

- grant;
- deny;
- revoke;
- re-accept after version change;
- view current consent summary.

Required consent handling:

- `personal_data_processing` before storing profile/contact data;
- `transactional_communications` for service notifications;
- `marketing_communications` before promotions;
- `loyalty_terms_acceptance` before Club Timofey membership/Club Account activation;
- `referral_program_terms` before active referral reward participation.

Consent evidence must include:

- consent type;
- status;
- policy version;
- channel `telegram_bot`;
- source screen or prompt;
- customer or anonymous reference;
- timestamp;
- correlation ID where available.

# 5. Payment scenarios

Payment flows shown in the bot are communication and handoff flows. Payment Runtime owns payment lifecycle and provider integration.

Payment states must come from backend Payment Runtime, not from button clicks, link opens, QR scans or client timers.

## 5.1 Club Account top-up

Top-up flow:

```text
Customer chooses Club Account
->
Bot shows current status or opens Mini App Club Account
->
Customer chooses top-up
->
Backend creates Club Account top-up intent
->
Payment Runtime creates payment intent/session
->
Customer confirms through YooKassa / SBP / link / QR
->
Payment Runtime confirms payment
->
Club Account credits balance
->
Bot sends payment success / top-up credited notification
```

Rules:

- Club Account balance is prepaid RUB value, separate from bonuses;
- recommended top-up may use the Club Account policy, including 100 RUB recommendation when applicable;
- low balance threshold and top-up recommendations are backend policy;
- bot must not credit balance after customer opens a link or scans QR;
- `Payments.Completed` and Club Account credit fact are required before showing top-up credited as final.

## 5.2 YooKassa

YooKassa is the primary payment provider behind Payment Runtime.

YooKassa flow:

```text
Payment request accepted by backend
->
Payment Runtime creates provider-agnostic payment
->
YooKassa adapter creates provider confirmation session
->
Bot or Mini App presents safe confirmation link / QR / redirect
->
Webhook or polling confirms provider outcome
->
Payment Runtime maps provider state to platform payment state
```

Rules:

- YooKassa-specific fields stay inside provider adapter/protected records;
- provider payment ID is a correlation reference, not `payment_id`;
- provider raw errors are normalized before customer display;
- bot never stores or exposes YooKassa secret keys, authorization headers or raw webhook payloads.

## 5.3 SBP link

SBP may be presented as:

- provider-hosted payment link;
- deep link to bank app;
- QR/deep-link pair;
- Mini App payment screen with SBP option.

Rules:

- SBP session has explicit expiration;
- bank confirmation is asynchronous;
- bot can show "waiting for payment confirmation";
- final success requires Payment Runtime `completed` state;
- delayed success after local expiration enters reconciliation, not automatic preparation.

## 5.4 QR payment

QR payment is a presentation of a payment session.

QR payment flow:

```text
Payment session created
->
QR payload generated by approved payment contract
->
Bot or Mini App shows QR and expiration
->
Customer scans QR and pays
->
Payment Runtime receives webhook or polling result
->
Bot updates customer only after backend status changes
```

Rules:

- QR payload must not contain secrets, raw personal data or business rules;
- QR has `issued_at` and `expires_at`;
- expired QR cannot start preparation;
- replacement QR creates or references a new session operation;
- QR scan is not payment confirmation.

## 5.5 Payment confirmation

Payment confirmation rules:

- bot shows payment success only after Payment Runtime reports `completed`;
- payment pending remains pending while webhook/polling is incomplete;
- failed, cancelled and expired payments show recovery actions;
- order preparation starts only after confirmed payment and Order policy acceptance;
- bot notification references safe payment/order IDs or short customer-facing references only;
- all mutating payment actions require idempotency through backend/API contracts.

Payment-related events that may drive bot messages:

- `Payments.SessionCreated`;
- `Payments.ConfirmationRequired`;
- `Payments.Completed`;
- `Payments.Failed`;
- `Payments.Expired`;
- `Payments.Cancelled`;
- `ClubAccounts.TopUpCredited`;
- `Orders.PaymentConfirmed`;
- `Orders.Completed`.

# 6. Notifications

Telegram Bot is a delivery channel for notifications. Notification Runtime owns delivery policy, templates, throttling, suppression and delivery records.

Notification rules:

- transactional and marketing notifications are separate;
- marketing notifications require `marketing_communications`;
- transactional notifications require approved transactional communication basis/consent policy;
- failed notification delivery must not rollback source domain state;
- duplicate notifications must be suppressed by policy;
- messages must include safe recovery actions where useful.

Recommended notifications:

| Notification | Trigger | Consent / policy | Bot action |
|---|---|---|---|
| Balance low | `ClubAccounts.BalanceDroppedBelowMinimum` or equivalent projection. | Transactional/account policy; respect preferences and throttling. | Recommend top-up and open Club Account top-up flow. |
| Payment success | `Payments.Completed`; for top-up also Club Account credit fact. | Transactional. | Confirm payment or top-up success and offer next action. |
| Purchase completed | `Orders.Completed` or fulfillment completion projection. | Transactional. | Confirm dessert completion, show receipt/support entry and bonuses if available. |
| Bonus received | `Bonus.Accrued` or `Bonus.ProjectionChanged`. | Transactional/loyalty policy; marketing if promotional campaign copy is used. | Show bonus amount as discount rights and open Bonuses view. |
| Promotions | Promotion or marketing campaign notification candidate. | Requires `marketing_communications`. | Send promotion CTA, open Mini App or landing path. |

Customer-facing messages must clearly separate:

- Club Account balance as prepaid money;
- bonuses as discount rights;
- payment state as backend-confirmed status;
- promotions as optional marketing communication.

# 7. Error scenarios

Error handling must be safe, recoverable where possible and free of internal provider details.

## 7.1 Payment failed

Trigger examples:

- `Payments.Failed`;
- provider decline;
- confirmation failure;
- amount/currency mismatch rejected by Payment Runtime;
- payment enters manual review.

Bot behavior:

- show a simple payment failed message;
- offer retry, another method or Mini App payment screen;
- offer Help for repeated failure;
- do not expose raw provider error payload;
- do not mark order paid or top-up credited.

## 7.2 User not registered / customer not resolved

Trigger examples:

- missing customer binding;
- no active `customer_id`;
- Telegram identity conflict;
- required consent missing;
- profile/contact requirement missing for selected scenario.

Bot behavior:

- start profile completion or consent flow;
- explain the next customer action without technical identity terms;
- route identity conflicts to support;
- do not show protected account, bonus, payment or purchase data.

## 7.3 Expired payment

Trigger examples:

- payment session expired;
- QR expired;
- payment link expired;
- order/top-up intent expired.

Bot behavior:

- show that the payment link or QR expired;
- offer to create a new payment session if backend policy allows;
- route uncertain late payment outcomes to support or pending/reconciliation state;
- do not reuse expired payment links or QR payloads.

## 7.4 Unavailable service

Trigger examples:

- backend API unavailable;
- Payment Runtime unavailable;
- YooKassa unavailable;
- Mini App unavailable;
- Notification Runtime unavailable;
- rate limit or maintenance window.

Bot behavior:

- show a short service unavailable message;
- offer retry later or Help;
- keep the latest known state clearly marked if shown;
- do not fabricate balances, payment status, purchase status or bonus state;
- log safe correlation metadata for support.

# 8. Security

## 8.1 User identification

Identification rules:

- `customer_id` is the canonical platform customer identity;
- Telegram user ID is an external alias;
- Telegram chat ID is a notification route;
- Telegram username is mutable display metadata;
- Mini App requests use Telegram WebApp `initData` verification through backend authentication;
- bot webhook/update handling must authenticate Telegram channel boundary before backend state changes;
- customer-facing links must use signed, scoped or opaque references where they access protected context.

The bot must not treat Telegram user ID, phone, email, referral code, URL parameter, `start` parameter, link open or QR scan as proof of payment or complete platform identity.

## 8.2 Permissions

Permission rules:

- customers can access only their own data;
- customer self-service actions are scoped to resolved `customer_id`;
- bot credentials do not grant admin, CRM, machine or payment-provider privileges;
- support actions require CRM/operator authorization, not customer bot permissions;
- bot may submit communication commands and customer self-service requests only through approved API contracts;
- backend Runtime decides whether business actions are valid.

## 8.3 Personal data

Personal data rules:

- collect only scenario-required data;
- store personal data through Customer/Consent backend contracts;
- mask phone and email in bot messages where possible;
- do not log raw phone, raw email, tokens, bot tokens, Telegram init data, payment credentials, provider secrets or raw webhook payloads;
- keep transactional and marketing communications separate;
- make consent status visible and revocable through Profile/Help path;
- preserve audit and consent evidence with source channel `telegram_bot`.

# 9. Integration boundaries

## 9.1 Bot

Bot owns communication behavior:

- welcome and menu presentation;
- customer prompts;
- Mini App launch buttons;
- safe status summaries returned by backend;
- transactional and marketing message delivery through Notification Runtime;
- support handoff links;
- customer-safe recovery actions.

Bot does not own:

- customer identity source of truth;
- consent source of truth;
- profile storage;
- Club Account balance;
- bonus lifecycle;
- payment lifecycle;
- order lifecycle;
- product configuration;
- pricing;
- machine execution.

## 9.2 Mini App

Mini App owns customer interface behavior:

- interactive purchase flow;
- account, bonus, purchases and profile screens;
- payment method selection and status screens;
- product configuration UI;
- Telegram WebApp initialization and backend authentication exchange.

Mini App submits commands and reads projections. It does not own business rules, payment confirmation, bonus redemption, Club Account balance mutation or machine execution.

## 9.3 Backend

Backend/Runtimes own business logic:

- Authentication verifies Telegram Mini App `initData` and channel credentials;
- Customer Runtime resolves `customer_id` and identity links;
- Consent contracts store consent evidence and status;
- Club Account Runtime owns prepaid balance, top-up and history;
- Bonus Runtime owns bonus rights and projection;
- Payment Runtime owns payment intents, sessions, provider adapter, confirmation, expiration and refunds;
- Order Runtime owns purchase lifecycle and fulfillment gating;
- Machine Runtime owns machine dispatch and equipment facts;
- Notification Runtime owns notification policy, templates, suppression and delivery records.

Integration rule:

```text
Bot and Mini App call backend contracts.
Backend emits facts and projections.
Bot and Mini App display approved customer-facing results.
```

# 10. Validation

This specification is valid when:

- bot purpose is documented;
- first launch scenario is documented;
- main menu buttons are documented;
- registration/profile completion flow is documented;
- payment scenarios are documented for Club Account top-up, YooKassa, SBP link, QR payment and payment confirmation;
- notifications are documented for balance low, payment success, purchase completed, bonus received and promotions;
- error scenarios are documented for payment failed, user not registered, expired payment and unavailable service;
- security is documented for user identification, permissions and personal data;
- integration boundaries are documented for Bot, Mini App and Backend;
- documentation remains documentation-only;
- no application source code, frontend code, backend code, Telegram bot code, runtime configuration, database migration or generated build output is modified.

---

# Documentation Scope

This specification is documentation-only.

It does not introduce application code, frontend code, backend code, Telegram bot code, runtime configuration, database migrations, payment provider integration, notification templates, CRM screens, generated build output or executable behavior changes.
