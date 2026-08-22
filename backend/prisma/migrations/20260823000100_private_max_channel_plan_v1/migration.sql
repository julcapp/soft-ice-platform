INSERT INTO "PrivateChannelPlan" ("id","code","name","description","priceRub","billingPeriodDays","isActive","createdAt","updatedAt")
VALUES (
  'private-max-monthly-v1',
  'PRIVATE_MAX_MONTHLY',
  'Приватный канал MAX',
  'Платный доступ к закрытому каналу в MAX. Тариф создаётся выключенным до отдельного production-решения.',
  99,
  30,
  FALSE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;
