const express = require('express');

const { ApiError } = require('../../platform/errors/ApiError');
const { attachCorrelationId, sendError } = require('../../platform/http/apiResponse');
const { createAuthRouter } = require('./authRoutes');
const { createClubAccountRouter } = require('./clubAccountRoutes');
const { createCustomerRouter } = require('./customerRoutes');
const { createCustomerOrdersRouter, createOrderRouter } = require('./orderRoutes');
const { createTelegramRouter } = require('./telegramRoutes');

function createApiV1Router(dependencies) {
  const router = express.Router();

  router.use(attachCorrelationId);

  router.get('/', (req, res) => {
    res.json({
      data: {
        type: 'api_version',
        id: 'v1',
        attributes: {
          status: 'online',
        },
      },
      meta: {
        api_version: 'v1',
        correlation_id: req.correlationId,
      },
    });
  });

  router.use('/auth', createAuthRouter(dependencies));
  router.use('/customers', createCustomerRouter(dependencies));
  router.use('/customer/orders', createCustomerOrdersRouter(dependencies));
  router.use('/club-account', createClubAccountRouter(dependencies));
  router.use('/club-accounts', createClubAccountRouter(dependencies));
  router.use('/orders', createOrderRouter(dependencies));
  router.use('/telegram', createTelegramRouter(dependencies));

  router.use((req, res, next) => {
    next(
      new ApiError({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'API route was not found.',
      }),
    );
  });

  router.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    sendError(res, req, error);
  });

  return router;
}

module.exports = {
  createApiV1Router,
};
