INSERT INTO "Customer" (id,"updatedAt") VALUES ('payment-legacy-customer',CURRENT_TIMESTAMP);
INSERT INTO "Order" (id,"customerId",amount,"updatedAt") VALUES ('payment-legacy-order','payment-legacy-customer',150,CURRENT_TIMESTAMP);
INSERT INTO "SaleFlow" (id,"flowId","orderId","customerId","machineId","organizationId","locationId","correlationId","updatedAt")
VALUES ('payment-legacy-flow-row','payment-legacy-flow','payment-legacy-order','payment-legacy-customer','payment-legacy-machine','payment-legacy-org','payment-legacy-location','payment-legacy-correlation',CURRENT_TIMESTAMP);
INSERT INTO "Payment" (id,"customerId","amountRub",provider,"providerPaymentId",status,metadata,"updatedAt")
VALUES ('payment-legacy-row','payment-legacy-customer',150,'yookassa','payment-legacy-provider','succeeded',
  '{"paymentLifecycleMigration":{"organizationId":"payment-legacy-org","orderId":"payment-legacy-order","idempotencyKey":"payment-legacy-create"}}'::jsonb,CURRENT_TIMESTAMP);
