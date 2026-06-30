# PROJECT_MEMORY.md

Status: Active
Version: 1.0
Project: Soft ICE Platform / «У Тимоши»

## Purpose

This document is the long-term memory of the project. It explains why the project exists, which decisions were made, and what context AI agents and developers must preserve.

## Product identity

Soft ICE Platform is a digital ecosystem for a soft ice cream vending business under the brand «У Тимоши».

The brand is connected to Timofey, the founder's son. Timofey is planned as the emotional brand character for the project, especially for Club Timofey, loyalty mechanics, congratulations, bonuses and customer engagement.

## Business concept

The initial product is soft ice cream in a cup.

Current MVP product assumptions:

```text
Product: vanilla soft ice cream in a cup
Base price: 130 RUB
Customer selects: 1 syrup + 1 topping
Initial syrups: strawberry, chocolate, caramel
Initial toppings: Oreo, sprinkles, chocolate chips
```

The long-term platform may support other product categories, such as milkshakes, coffee, lemonade, hot chocolate, frozen yogurt and other desserts.

## Current strategic goal

The first commercial MVP goal:

```text
A customer can select a dessert, pay for it and receive it from a vending machine.
```

## Key architectural decisions

### GitHub as source of truth

All project files, infrastructure configuration, documentation and source code must be stored in GitHub.

### Product Engine first

The strongest part of the platform is Product Engine: catalog, configuration, pricing, media, recipes and future vending integration.

This is more important than isolated screens because the same product model must work across Mini App, CRM, Telegram bot, web app and vending machine.

### Data separated from UI

React components must not store business data. Product names, prices, images, syrups, toppings and rules must come from data files and services.

### JSON now, API later

JSON files are used for fast MVP development. The architecture must allow replacing JSON with backend API and PostgreSQL later without rewriting UI components.

### Price is separate from product

Prices should not be stored directly as the final source of truth inside products. Price Engine must support future regional pricing, franchise pricing, discounts, loyalty and promotions.

### Media is separate from product

Product images, ingredient images, composed dessert images and Timofey brand images are managed as media assets with metadata.

### Product configuration is central

The customer does not just buy a static product. The customer creates a product configuration:

```text
base product + flavor + syrup + topping + size + future add-ons
```

This configuration will later be used by order history, payment, CRM, analytics and the vending machine.

### Recipe is required for machine integration

A visible product configuration must eventually map to a machine recipe: ingredient quantities, syrup dose, topping dose and machine commands.

Recipe Engine is required before full vending integration.

## Development process

The project is moving from consulting mode to engineering increment mode.

Each increment should include:

- architecture if needed;
- working code;
- documentation update if needed;
- test scenario update if behavior changed;
- CHANGELOG update;
- build check;
- GitHub synchronization;
- version tag for completed releases.

## Current focus

Current implementation focus:

```text
Sprint 1.1 — Product Engine Core
```

Expected result:

- data layer;
- CatalogService;
- MediaService;
- PriceEngine;
- ProductConfigurator;
- Mini App uses services instead of hardcoded business data.

## Codex role

Codex Desktop is planned as an engineering team member.

Role distribution:

```text
Product Owner: Alexander Ilyin
Architecture and review: ChatGPT
Code implementation assistant: Codex Desktop
Source of truth: GitHub
```

Codex must follow `AGENTS.md` and project documentation.

## Brand direction

Club Timofey should not be just a button. It should become a branded loyalty experience with Timofey as a friendly guide.

Future Timofey media pack:

```text
welcome
club
bonus
gift
celebration
profile
```

Stock photos of children should not define the final brand identity. The preferred direction is a controlled media kit based on approved photos of Timofey.

## Important constraints

Do not break the existing working Mini App.

Do not remove existing documentation without explicit approval.

Do not replace architectural decisions casually.

Do not hardcode data that belongs to Product Engine.

Do not commit build output or local environment files.

## Next planned steps

1. Finalize AI-agent documentation.
2. Configure Codex Desktop to work with the local repository.
3. Give Codex the first task: Sprint 1.1 — Product Engine Core.
4. Review Codex changes before merge.
5. Build and deploy Mini App.
