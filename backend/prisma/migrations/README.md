# Migration Structure

Prisma migrations for the backend live in this directory.

Migration rules for the MVP backend:

- migrations are append-only;
- generated database output is not committed;
- financial and audit history must not be silently rewritten;
- provider-specific payload details must stay behind integration boundaries;
- new domain tables require documentation updates when they change ownership,
  pricing, payment, order, machine, media or loyalty behavior.

This foundation task prepares the migration location and PostgreSQL runtime
configuration only. It does not add payment operations, Telegram integration,
YooKassa API calls or machine dispatch logic.
