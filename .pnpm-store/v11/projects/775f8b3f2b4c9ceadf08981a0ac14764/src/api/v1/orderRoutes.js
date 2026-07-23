const express = require('express');

const { toDispenseRequestDto } = require('../../modules/machine/machineDto');
const { toOrderCreationDto, toOrderDto } = require('../../modules/order/orderDto');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');

function createOrderRouter({ authCoreService, machineRuntime, orderRuntime }) {
  const router = express.Router();
  const authenticateCustomer = createCustomerAuthenticator(authCoreService);

  router.post(
    '/',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const result = await orderRuntime.createOrder(
        req.securityContext.subject_id,
        normalizeCreateOrderRequest(req.body),
        {
          correlationId: req.correlationId,
          idempotencyKey: req.get('Idempotency-Key') || null,
          authMethod: req.securityContext.auth_method,
          sourceChannel: 'api_v1',
          actorType: 'customer',
          actorId: req.securityContext.subject_id,
        },
      );

      sendData(res, req, toOrderCreationDto(result), 201);
    }),
  );

  router.get(
    '/:id',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const order = await orderRuntime.getOwnOrder(
        req.securityContext.subject_id,
        req.params.id,
      );

      sendData(res, req, toOrderDto(order));
    }),
  );

  router.get(
    '/:id/dispense',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const dispenseRequest = await machineRuntime.getOwnOrderDispense(
        req.securityContext.subject_id,
        req.params.id,
      );

      sendData(res, req, toDispenseRequestDto(dispenseRequest));
    }),
  );

  return router;
}

function createCustomerOrdersRouter({ authCoreService, orderRuntime }) {
  const router = express.Router();
  const authenticateCustomer = createCustomerAuthenticator(authCoreService);

  router.get(
    '/',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const orders = await orderRuntime.listOwnOrders(req.securityContext.subject_id);

      sendData(res, req, orders.map(toOrderDto));
    }),
  );

  return router;
}

function normalizeCreateOrderRequest(body) {
  return {
    amount: body && (body.amount ?? body.amount_rub ?? body.amountRub),
    currency: (body && body.currency) || 'RUB',
  };
}

module.exports = {
  createCustomerOrdersRouter,
  createOrderRouter,
  normalizeCreateOrderRequest,
};
