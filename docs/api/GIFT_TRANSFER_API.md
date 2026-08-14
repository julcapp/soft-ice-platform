# API передачи подарка

Все Customer API требуют Bearer-сессию, проверяют владение ресурсом и поддерживают `Idempotency-Key`.

- `GET /api/v1/me/prepaid-orders/:orderId/gift-options`
- `POST /api/v1/me/prepaid-orders/:orderId/cancel-to-balance`
- `POST /api/v1/me/prepaid-orders/:orderId/gift`
- `GET /api/v1/me/gifts`
- `GET /api/v1/me/gifts/:id`
- `POST /api/v1/me/gifts/:id/accept`
- `POST /api/v1/me/gifts/:id/request-redemption`
- `POST /api/v1/me/gifts/:id/cancel`
- `POST /api/v1/me/gift-invitations/claim`

Admin API: список, карточка, попытки доставки и foundation-статистика доступны по `/api/v1/admin/gift-transfers`. Требуются `gift_transfer.admin_view` и `notification_delivery.view`. Будущая корректировка требует `gift_transfer.admin_correct` и обязательный `auditReason`; mutation v1 намеренно не опубликован.

Ответы Customer/Admin API не содержат полный телефон, hash приглашения или одноразовый invitation token. Для выдачи формируется внутренний `FOUNDATION_ONLY`-контракт Machine Runtime с полями `giftId`, `orderId`, `recipientCustomerId`, `machineId`, `eligible`, `giftExpiresAt`, `authorizationExpiresAt`, `singleUse`, `dispenseResult`. Подтверждение `REDEEMED` допустимо только при `dispenseResult=SUCCESS`.
