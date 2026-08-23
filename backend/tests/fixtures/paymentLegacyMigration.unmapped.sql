INSERT INTO "Customer" (id,"updatedAt") VALUES ('payment-unmapped-customer',CURRENT_TIMESTAMP);
INSERT INTO "Order" (id,"customerId",amount,"updatedAt") VALUES ('payment-unmapped-order','payment-unmapped-customer',150,CURRENT_TIMESTAMP);
INSERT INTO "Payment" (id,"customerId","amountRub",provider,"providerPaymentId",status,metadata,"updatedAt")
VALUES ('payment-unmapped-row','payment-unmapped-customer',150,'yookassa','payment-unmapped-provider','pending','{}'::jsonb,CURRENT_TIMESTAMP);
