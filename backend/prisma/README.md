# Backend Database

The MVP backend uses PostgreSQL through Prisma.

This directory owns the current migration structure:

```text
backend/prisma/
  schema.prisma
  migrations/
```

Foundation rules:

- `DATABASE_URL` is loaded from backend runtime environment.
- PostgreSQL is the only configured backend datasource.
- Migrations are committed as source-controlled infrastructure changes.
- Business logic is not implemented in migrations.
- Provider secrets, Telegram secrets and real payment credentials are not stored here.

The current foundation does not add new domain tables. Future schema changes must follow
module ownership from `docs/architecture/MVP_BACKEND_ARCHITECTURE.md`.
