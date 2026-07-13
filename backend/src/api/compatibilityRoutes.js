const express = require('express');

const { toCustomerProfileDto } = require('../modules/customer/customerDto');
const { ApiError } = require('../platform/errors/ApiError');
const {
  attachCorrelationId,
  asyncHandler,
  sendData,
  sendError,
} = require('../platform/http/apiResponse');
const { createCustomerAuthenticator } = require('../platform/security/authenticateCustomer');

function createApiCompatibilityRouter({
  authCoreService,
  customerRuntime,
  clubAccountRuntime,
}) {
  const router = express.Router();
  const authenticateCustomer = createCustomerAuthenticator(authCoreService);

  router.use(attachCorrelationId);

  router.post(
    '/auth/telegram',
    asyncHandler(async (req, res) => {
      const result = await authCoreService.createTelegramMiniAppSession(
        normalizeTelegramAuthPayload(req.body),
        {
          correlationId: req.correlationId,
          idempotencyKey: req.get('Idempotency-Key') || null,
        },
      );

      sendData(
        res,
        req,
        {
          type: 'auth_session',
          id: result.session.id,
          attributes: {
            identity_type: 'customer',
            customer_id: result.customer.id,
            access_token: result.accessToken,
            token_type: 'Bearer',
            expires_at: result.expiresAt.toISOString(),
          },
        },
        201,
      );
    }),
  );

  router.get(
    '/customer/me',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const customer = await customerRuntime.getOwnProfile(req.securityContext.subject_id);
      const clubAccount = await clubAccountRuntime.getOwnAccount(customer.id);

      sendData(res, req, toCustomerProfileDto(customer, clubAccount));
    }),
  );

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

function normalizeTelegramAuthPayload(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }

  return {
    telegram_init_data: body.telegram_init_data || body.init_data || body.initData,
    source_channel: body.source_channel || 'telegram_mini_app',
    client_request_id: body.client_request_id || body.clientRequestId || null,
  };
}

module.exports = {
  createApiCompatibilityRouter,
  normalizeTelegramAuthPayload,
};
