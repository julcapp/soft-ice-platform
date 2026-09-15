# Currency Core v0.1

## Purpose

Currency Core provides deterministic historical FX lookup for Soft ICE procurement and economics. It is isolated from Order, Payment, Loyalty and Inventory business state.

## Supported currencies

- RUB — internal base currency, `unitRate = 1`
- CNY — Bank of Russia historical rate
- USD — Bank of Russia historical rate
- EUR — Bank of Russia historical rate

Unsupported currencies fail closed.

## Authoritative source

Foreign rates are obtained only through the Bank of Russia provider. The provider requests the historical daily XML endpoint for the requested date and preserves the actual quotation date returned by the source.

The domain stores both:

- `requestedDate` — date requested by Soft ICE;
- `rateDate` — actual quotation date returned by the official source.

This distinction is mandatory for weekends and holidays.

## Precision

Rates are stored as PostgreSQL `DECIMAL` values:

- `nominal DECIMAL(18,6)`
- `rate DECIMAL(18,8)`
- `unitRate DECIMAL(18,8)`

Currency Core does not use JavaScript floating point arithmetic to derive authoritative per-unit rates.

## Persistence

`CurrencyRate` is an immutable historical cache keyed by:

`currencyCode + requestedDate + source`

Repeated requests for the same official historical rate return the existing stored record instead of mutating history.

The persistence migration includes positive-value CHECK constraints for `nominal`, `rate` and `unitRate`.

## Fail-closed behavior

Currency Core must not silently substitute search-engine, commercial or guessed rates.

Expected failures include:

- `UNSUPPORTED_CURRENCY`
- `INVALID_RATE_DATE`
- `RATE_NOT_FOUND`
- `SOURCE_UNAVAILABLE`
- `INVALID_PROVIDER_RESPONSE`

## API

Admin read endpoint:

`GET /api/v1/admin/currency-rates?currency=CNY&date=YYYY-MM-DD`

The route is administrator-authenticated and delegates all rate calculation and cache logic to `CurrencyRateService`.

## Composition

Runtime composition is provided by `createCurrencyRuntime({ prisma, fetchImpl, clock })`, which wires:

`PostgresCurrencyRateRepository -> CbrCurrencyProvider -> CurrencyRateService`

## Current merge gate

Before Currency Core v0.1 is considered complete, the `CurrencyRate` model must also be represented in `backend/prisma/schema.prisma` so Prisma schema and migration history remain aligned. Production runtime wiring in `runtimeDependencies.js` is performed only after this schema alignment.

## Acceptance path

`CNY + requested date -> CBR provider -> actual rate date -> PostgreSQL CurrencyRate -> repeated request -> persistent cache hit`
