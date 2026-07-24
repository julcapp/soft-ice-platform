# API внешних каналов клиента

Все маршруты начинаются с `/api/v1/admin/customers/:customerId`, требуют `PLATFORM_OWNER` или `ADMIN`.

- `GET /external-channels`, `GET /external-channels/:channelType`
- `GET /subscriptions`, `GET /engagement`
- `POST|PATCH /external-channels/manual[/:id]`
- `POST|PATCH /subscriptions/manual[/:id]`

Mutation допускает только `MANUAL`; обязательны `auditReason`, серверные `actorId`, `createdAt`, `updatedAt`. Подделка `OFFICIAL_API` запрещена.
