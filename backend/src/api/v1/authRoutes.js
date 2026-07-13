const express = require('express');

const { asyncHandler, sendData } = require('../../platform/http/apiResponse');

function createAuthRouter({ authCoreService }) {
  const router = express.Router();

  router.post(
    '/telegram-mini-app/sessions',
    asyncHandler(async (req, res) => {
      const result = await authCoreService.createTelegramMiniAppSession(req.body, {
        correlationId: req.correlationId,
        idempotencyKey: req.get('Idempotency-Key') || null,
      });

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

  return router;
}

module.exports = {
  createAuthRouter,
};
