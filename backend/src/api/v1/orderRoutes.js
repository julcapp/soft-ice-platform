const express = require('express');

const { toDispenseRequestDto } = require('../../modules/machine/machineDto');
const { toOrderCreationDto, toOrderDto } = require('../../modules/order/orderDto');
const { QuotedOrderService } = require('../../modules/order/QuotedOrderService');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');
const { resolvePricingService } = require('./pricingRoutes');

function createOrderRouter({ authCoreService, machineRuntime, orderRuntime, ...dependencies }) {
  const router = express.Router();
  const authenticateCustomer = createCustomerAuthenticator(authCoreService);

  const getQuotedOrderService = () => {
    if (!orderRuntime) {
      const error = new Error('Order runtime is not configured.');
      error.code = 'ORDER_RUNTIME_UNAVAILABLE';
      error.statusCode = 503;
      error.source = 'order';
      throw error;
    }
    return new QuotedOrderService({
      orderRuntime,
      pricingEngineService: resolvePricingService({ authCoreService, machineRuntime, orderRuntime, ...dependencies }),
    });
  };

  router.post(
    '/',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const request = normalizeCreateOrderRequest(req.body);
      const context = {
        correlationId: req.correlationId,
        idempotencyKey: req.get('Idempotency-Key') || null,
        authMethod: req.securityContext.auth_method,
        sourceChannel: 'api_v1',
        actorType: 'customer',
        actorId: req.securityContext.subject_id,
      };
      let result;
      if (request.quoteId) {
        result = await getQuotedOrderService().createOrder(
          req.securityContext.subject_id,
          { quoteId: request.quoteId },
          context,
        );
      } else {
        if (!orderRuntime) {
          const error = new Error('Order runtime is not configured.');
          error.code = 'ORDER_RUNTIME_UNAVAILABLE';
          error.statusCode = 503;
          error.source = 'order';
          throw error;
        }
        result = await orderRuntime.createOrder(req.securityContext.subject_id, request, context);
      }

      const dto = toOrderCreationDto(result);
      if (result.pricing) dto.pricing = result.pricing;
      if (result.paymentBypassed) dto.payment_bypassed = true;
      sendData(res, req, dto, 201);
    }),
  );

  router.get(
    '/:id',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      if (!orderRuntime) {
        const error = new Error('Order runtime is not configured.');
        error.code = 'ORDER_RUNTIME_UNAVAILABLE';
        error.statusCode = 503;
        error.source = 'order';
        throw error;
      }
      const order = await orderRuntime.getOwnOrder(req.securityContext.subject_id, req.params.id);
      sendData(res, req, toOrderDto(order));
    }),
  );

  router.get(
    '/:id/dispense',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      if (!machineRuntime) {
        const error = new Error('Machine runtime is not configured.');
        error.code = 'MACHINE_RUNTIME_UNAVAILABLE';
        error.statusCode = 503;
        error.source = 'machine';
        throw error;
      }
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
      if (!orderRuntime) {
        const error = new Error('Order runtime is not configured.');
        error.code = 'ORDER_RUNTIME_UNAVAILABLE';
        error.statusCode = 503;
        error.source = 'order';
        throw error;
      }
      const orders = await orderRuntime.listOwnOrders(req.securityContext.subject_id);
      sendData(res, req, orders.map(toOrderDto));
    }),
  );

  return router;
}

function normalizeCreateOrderRequest(body) {
  return {
    quoteId: body && (body.quoteId ?? body.quote_id),
    amount: body && (body.amount ?? body.amount_rub ?? body.amountRub),
    currency: (body && body.currency) || 'RUB',
  };
}

module.exports = {
  createCustomerOrdersRouter,
  createOrderRouter,
  normalizeCreateOrderRequest,
};
