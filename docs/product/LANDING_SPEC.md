# Landing Specification

Document code: PRODUCT-LANDING-SPEC-001
Task: EPIC-201 / UX-003
Status: Draft
Version: 0.1
Project: Soft ICE Platform / Utimoshi
Created: 2026-07-10
Scope: Documentation only. No application code changes.

Related documents:

- `docs/product/MINI_APP_AUDIT.md`
- `docs/product/MINI_APP_MVP_SPEC.md`
- `docs/domain/CUSTOMER_DOMAIN.md`
- `docs/domain/CLUB_ACCOUNT.md`
- `docs/domain/BONUS_DOMAIN.md`
- `docs/domain/PAYMENT_DOMAIN.md`
- `docs/architecture/PROJECT_DECISIONS.md`
- `docs/brandbook_v1.md`
- `docs/design/DESIGN_SYSTEM.md`
- `docs/design/DESIGN_TOKENS.md`
- `docs/design/RESPONSIVE_UI_STANDARD.md`
- `docs/design/PHOTO_STANDARD.md`

---

# 1. Purpose of landing page

The landing page is the public customer-facing website for the "У Тимоши" brand. It introduces the brand, explains the soft ice cream vending concept and sends interested visitors into the Telegram ecosystem where the customer can continue through the Bot and Mini App.

Primary purposes:

- present "У Тимоши" as a friendly, modern dessert vending brand;
- acquire new customers from search, QR codes, social media, local ads and shared links;
- explain that the customer can buy soft ice cream from a vending machine without a traditional counter;
- connect the visitor to the Telegram Bot and Mini App for purchase, Club Account, bonuses and notifications;
- convert casual visitors into Club customers through a clear "Join Club Timofey" path.

The landing page is not a replacement for the Mini App. It must not own product configuration, final price calculation, payment confirmation, customer account logic, bonus redemption or machine execution. These responsibilities remain in the existing platform domains and runtimes.

# 2. Target audience

The landing page addresses several customer groups:

- children and parents who need a simple, safe and cheerful dessert purchase scenario;
- teenagers who want quick customization and an easy Telegram-based interaction;
- students who value convenience, speed, mobile payment and repeat offers;
- casual buyers who notice the machine, scan a QR code or search for nearby soft ice cream;
- repeat customers who want the nearest machine, familiar flavors, bonuses and purchase history;
- Club members who already know the brand and need quick access to Club Account, bonuses and special offers.

Communication should be friendly, respectful and simple. The page should avoid pressure, aggressive sales language and heavy technical explanations.

# 3. Main customer journey

The landing supports this customer path:

```text
Visitor
->
Landing page
->
Find nearest machine
->
Telegram Bot / Mini App
->
Club Account registration or activation
->
Purchase
->
Bonus and return visit
```

Journey explanation:

1. Visitor discovers the brand through search, social media, a QR code, local signage, referral link or direct URL.
2. Landing page explains the brand promise, product, vending flow, Club benefits and Telegram connection.
3. Visitor finds or chooses the nearest vending machine. MVP may use a simple location/contact block; future versions can use an interactive map.
4. Visitor opens the Telegram Bot or Mini App to continue the purchase and customer identity flow.
5. Customer joins Club Timofey and activates or registers the Club Account when they choose loyalty benefits.
6. Customer selects a dessert, pays through the approved payment flow and receives the product from a vending machine.
7. Bonus rights, Club offers and Telegram notifications encourage a return visit.

# 4. Landing page structure

## Hero section

Purpose: make the brand and purchase path clear in the first viewport.

Main message:

```text
У Тимоши - мягкое мороженое в автоматах рядом с вами.
```

Value proposition:

- friendly dessert brand for families, students and everyday treats;
- soft ice cream in a cup with syrup and topping customization;
- quick purchase through Telegram and modern vending machines;
- Club Timofey gives discounts, bonuses and special offers.

Primary CTA buttons:

- `Find nearest machine`;
- `Open Telegram Bot`;
- `Join Club Timofey`.

CTA rules:

- the primary CTA should lead to the fastest available next step;
- if machine map is not ready, `Find nearest machine` may scroll to a simple locations/contact section;
- Telegram CTA must clearly open the Bot or Mini App entry point;
- Club CTA should use customer-friendly wording and avoid forced "registration" language where possible.

## About "У Тимоши"

Purpose: explain brand meaning and emotional position.

Content requirements:

- describe "У Тимоши" as a modern automated dessert service;
- connect the brand with Timofey as the friendly face of the dessert club, according to the brandbook;
- emphasize accessibility, honesty, friendliness, technology and continuous service improvement;
- show that technology makes the purchase simpler, not colder;
- build trust through clear explanation, simple language and real product/machine imagery.

Tone:

- warm;
- family-oriented;
- optimistic;
- calm and trustworthy;
- never aggressive or manipulative.

## How it works

Purpose: explain the vending purchase in five simple steps.

Required steps:

1. Find machine.
2. Choose ice cream.
3. Pay.
4. Receive product.
5. Get bonuses.

Rules:

- steps must be short and understandable without technical details;
- payment success must be described as confirmed by the platform, not assumed by the website;
- machine preparation starts only after confirmed payment through the existing Payment and Order boundaries;
- the landing page should not describe hardware details that are not confirmed in the machine documentation.

## Product section

Purpose: show the product offer without turning the landing into a complex catalog.

Content requirements:

- present soft ice cream in a cup as the MVP product;
- mention flavor, syrup and topping customization;
- show examples of syrup and topping choices only as customer-facing examples;
- use approved Product Catalog and Media Library concepts;
- avoid hardcoding final commercial logic into the website specification.

MVP product message:

- soft ice cream in a cup;
- vanilla base for the first MVP flow;
- customer can choose one syrup and one topping where available;
- future catalog expansion may include more desserts, drinks and seasonal items.

## Club section

Purpose: convert visitors into repeat customers.

Content requirements:

- introduce Club Timofey as the loyalty layer;
- explain Club Account as the customer-facing prepaid account when active;
- keep Club Account balance separate from bonuses;
- describe bonuses as discount rights, not cash;
- mention permanent discount, bonuses and special offers only as approved brand promises and not as final implementation mechanics;
- direct the visitor to Telegram Bot / Mini App for Club actions.

Required messages:

- Club Account supports repeat purchases and top-ups through approved payment flows;
- bonuses encourage return visits and can reduce future payable amount through platform rules;
- special offers and campaigns are future-friendly and should be managed through platform/promotion rules, not hardcoded landing content.

## Machine section

Purpose: make the vending concept concrete and trustworthy.

Content requirements:

- explain that modern vending machines make dessert available without a counter;
- highlight convenience, predictable process and quick access;
- show machine availability as a customer-facing concept;
- explain that the customer can find a machine, choose a dessert, pay and receive it there.

MVP constraints:

- if live machine availability is not implemented, do not imply real-time stock or readiness;
- use wording such as "nearest available location" or "current vending points" only when the underlying data exists;
- future live availability must come from Machine Domain / Machine Runtime projections.

## Telegram section

Purpose: make Telegram the conversion bridge.

Content requirements:

- explain that Telegram Bot is the main entry point for opening the Mini App;
- explain that Mini App is used for purchase, Club Account, payments, purchase history and bonuses according to the Mini App MVP specification;
- mention notifications for transactional status, bonuses and offers only within consent and Notification Runtime rules;
- include a clear CTA to open Telegram.

Required Telegram links:

- Bot entry point;
- Mini App entry point when available;
- Telegram channel or community link where approved by the brandbook.

## Trust section

Purpose: answer safety, quality and legitimacy concerns.

Content requirements:

- product quality and freshness statement;
- simple safety and hygiene statement;
- customer support contact;
- legal information links;
- privacy and consent references;
- payment safety note that payments are processed through approved platform/payment provider flows;
- no real provider secrets, internal identifiers or unapproved legal claims.

Required trust links for MVP:

- contacts;
- privacy policy or personal data processing terms when approved;
- public offer or legal information when approved;
- Telegram support or Bot support action.

# 5. SEO requirements

SEO should help customers find the brand and nearby dessert vending option without keyword stuffing.

Recommended page title:

```text
У Тимоши - мягкое мороженое в автоматах
```

Recommended description:

```text
У Тимоши - современный сервис мягкого мороженого в вендинговых автоматах. Найдите ближайший автомат, откройте Telegram Bot, вступите в Club Timofey и получайте бонусы.
```

Recommended keyword themes:

- У Тимоши;
- мягкое мороженое;
- мороженое в автомате;
- вендинговое мороженое;
- десертный автомат;
- Club Timofey;
- Telegram Mini App;
- бонусы за мороженое.

Semantic blocks:

- `header` for navigation and primary CTA;
- `main` for customer-facing content;
- `section` for Hero, About, How it works, Product, Club, Machine, Telegram and Trust;
- `footer` for contacts, legal links and social links;
- future structured data may include Organization, LocalBusiness, Product and FAQ only when the content is accurate and approved.

# 6. Design principles

The landing should follow the design system and brandbook direction:

- simple minimalism;
- friendly style;
- family-oriented communication;
- mobile-first layout;
- fast loading;
- clear CTA hierarchy;
- real product, machine and brand imagery where available;
- light, clean visual language with approved brand colors and photo standards;
- accessible text, clear contrast and responsive behavior for mobile, tablet and desktop.

Design constraints:

- do not overload the first launch with complex animation;
- do not use random stock-like dessert images that conflict with the photo standard;
- do not hide the brand behind generic marketing language;
- keep product and Club content readable without requiring account creation;
- landing content should be understandable before the customer opens Telegram.

# 7. MVP version

The first landing launch must include:

- hero;
- product;
- club;
- how it works;
- Telegram CTA;
- contacts.

First-launch content can be static, as long as it is accurate, approved and does not imply unimplemented live behavior.

Not required initially:

- complex catalog;
- personal account inside website;
- marketplace;
- advanced animations;
- live machine availability;
- payment inside website;
- customer purchase history inside website;
- full loyalty campaign management.

MVP acceptance:

- visitor understands what "У Тимоши" is;
- visitor understands how vending ice cream purchase works;
- visitor can move to Telegram Bot / Mini App;
- visitor can find contact or location information;
- Club value is visible without confusing Club Account balance with bonuses.

# 8. Integration points

## Telegram Bot

The landing links to the Telegram Bot as the primary continuation channel. Bot should open the Mini App and can provide purchase, Club, bonus and support entry points.

## Mini App

The landing hands off purchase, Club Account, payment, history and bonus flows to the Mini App. The website must not duplicate authenticated self-service screens during MVP.

## CRM

CRM may receive support context, lead source, campaign source or customer projection data only through approved contracts, consent and privacy rules. CRM must not become the source of payment, bonus, catalog or machine execution truth.

## Analytics

Landing analytics should measure the acquisition funnel while respecting consent and privacy policy.

Recommended event candidates:

- `LandingViewed`;
- `HeroCtaClicked`;
- `FindMachineClicked`;
- `TelegramBotOpened`;
- `MiniAppOpened`;
- `ClubCtaClicked`;
- `ContactClicked`.

Analytics must not store raw Telegram init data, payment credentials, secrets or unnecessary personal data.

# 9. Future extensions

Future landing versions may add:

- map of machines;
- live machine availability;
- product availability by machine;
- promotions;
- customer stories;
- loyalty campaigns;
- referral landing pages;
- seasonal campaign pages;
- FAQ;
- partner or franchise section;
- support knowledge base;
- legal page hub.

Future extensions must continue to preserve existing architecture boundaries. Machine availability comes from Machine projections, product content from Product/Media contracts, loyalty offers from approved loyalty or promotion rules, and customer account actions from Telegram Mini App or future authenticated web app contracts.

---

# Documentation Scope

This specification is documentation-only.

It does not introduce application code, frontend code, backend code, Telegram bot code, runtime configuration, database migrations, generated build output, new architecture decisions or executable behavior changes.
