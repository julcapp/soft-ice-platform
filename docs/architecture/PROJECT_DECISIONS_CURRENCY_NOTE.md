# Currency Core v0.1 implementation note

This branch introduces the first Business Core increment: historical FX rates for procurement/economics.

Key implementation constraints:

- Currency Core is read-only with respect to existing Order, Payment, Loyalty and Inventory domains.
- RUB is the internal base currency; CNY/USD/EUR use the Bank of Russia provider.
- Historical records preserve both requested date and actual quotation date.
- Persistent rate data uses DECIMAL and immutable cache semantics.
- No alternate or guessed rates are used when the official source is unavailable.
- The admin API is read-only and authenticated.
- Merge is blocked until Prisma schema is aligned with the `CurrencyRate` migration and production runtime wiring is reviewed.
