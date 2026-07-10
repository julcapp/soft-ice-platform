# Backend Foundation

Status: Draft
Version: 0.1
Date: 2026-07-10
Project: Soft ICE Platform / Utimoshi
Related architecture: `docs/architecture/MVP_BACKEND_ARCHITECTURE.md`

## Purpose

This document records the first technical backend foundation for the MVP modular monolith.

The goal of the foundation is to prepare repository structure, runtime entrypoint,
PostgreSQL configuration, database connection layer and migration location without
implementing business logic.

## Created Structure

```text
backend/
  docker-compose.yml
  .env.example
  prisma/
    README.md
    migrations/
      README.md
  src/
    main.js
    index.js
    modules/
      customer/
      club_account/
      bonus/
      payment/
      order/
      machine/
    common/
      database/
      http/
    config/
```

## Created Files

- `backend/docker-compose.yml`
- `backend/prisma/README.md`
- `backend/prisma/migrations/README.md`
- `backend/src/main.js`
- `backend/src/config/databaseConfig.js`
- `backend/src/config/index.js`
- `backend/src/common/database/prismaClient.js`
- `backend/src/common/database/connection.js`
- `backend/src/common/database/index.js`
- `backend/src/common/http/healthRouter.js`
- `backend/src/modules/customer/index.js`
- `backend/src/modules/club_account/index.js`
- `backend/src/modules/bonus/index.js`
- `backend/src/modules/payment/index.js`
- `backend/src/modules/order/index.js`
- `backend/src/modules/machine/index.js`
- `backend/src/modules/index.js`

## Updated Files

- `backend/src/index.js`
- `backend/package.json`
- `backend/.env.example`
- `CHANGELOG.md`
- `ENGINEERING_JOURNAL.md`
- `docs/tasks/TASK_INDEX.md`
- `docs/testing/TEST_SCENARIOS.md`

## Decisions

1. The backend foundation follows the MVP modular monolith direction from `MVP_BACKEND_ARCHITECTURE.md`.
2. The active backend entrypoint is `backend/src/main.js`; `backend/src/index.js` is a compatibility wrapper.
3. PostgreSQL is the configured backend database provider.
4. Docker Compose is limited to local PostgreSQL infrastructure and does not define a production deployment.
5. Prisma remains the database access and migration tool already present in the backend package.
6. Module folders expose only boundary manifests. They do not expose commands, queries, repositories or business workflows yet.
7. Health endpoints are infrastructure-only:
   - `GET /health` returns process liveness;
   - `GET /health/ready` checks PostgreSQL connectivity through Prisma.
8. Existing historical Prisma schema and migrations were not rewritten in this task.

## Explicitly Not Implemented

This foundation does not implement:

- customer registration;
- Club Account balance changes;
- bonus accrual, reservation or redemption;
- order creation or checkout;
- payment intent creation;
- payment operation creation;
- YooKassa API calls;
- YooKassa webhook handling;
- SBP, QR or payment link flow;
- Telegram Bot or Telegram Mini App authentication;
- machine dispatch commands;
- machine telemetry ingestion;
- Notification Module runtime;
- API authorization policy;
- event outbox tables or event workers;
- production deployment automation.

## Migration Direction

The migration structure remains under:

```text
backend/prisma/migrations/
```

Future migrations must be added as separate engineering tasks and reviewed against:

- module ownership from `MVP_BACKEND_ARCHITECTURE.md`;
- logical data model ownership from `docs/data/PLATFORM_DATA_MODEL.md`;
- immutable financial record requirements;
- audit and idempotency requirements.

## Validation

Required validation for this foundation:

```bash
git diff --check
```

Recommended backend smoke checks:

```bash
cd backend
npm run prisma:generate
node --check src/main.js
```
