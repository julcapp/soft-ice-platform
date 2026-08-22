INSERT INTO "PrivateChannelPlan" (
  "id", "code", "name", "channelType", "targetExternalId", "priceRub", "billingPeriodDays", "isActive", "createdAt", "updatedAt"
)
VALUES (
  'private-max-monthly-v1',
  'PRIVATE_MAX_MONTHLY',
  'Приватный канал MAX — 30 дней',
  'MAX',
  NULL,
  99.00,
  30,
  FALSE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;
