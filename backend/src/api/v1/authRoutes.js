const express = require('express');

const { asyncHandler, sendData, createCorrelationId } = require('../../platform/http/apiResponse');

function createAuthRouter({ authCoreService, displayCustomerRecognitionService }) {
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

  if (displayCustomerRecognitionService) {
    router.use('/display-phone', (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      // Never reflect arbitrary caller correlation values into recognition responses.
      req.correlationId = createCorrelationId();
      res.set('X-Correlation-ID', req.correlationId);
      next();
    });
    router.post(
      '/display-phone/recognition',
      asyncHandler(async (req, res) => {
        const result = await displayCustomerRecognitionService.recognize(req.body, { correlationId: req.correlationId });
        sendData(res, req, recognitionDto(result));
      }),
    );
    router.post(
      '/display-phone/verification-challenges/:challengeId/verify',
      asyncHandler(async (req, res) => {
        const result = await displayCustomerRecognitionService.verify(req.params.challengeId, req.body, { correlationId: req.correlationId });
        sendData(res, req, verificationDto(result));
      }),
    );
    router.post(
      '/display-phone/verification-challenges/:challengeId/resend',
      asyncHandler(async (req, res) => {
        const result = await displayCustomerRecognitionService.resend(req.params.challengeId, req.body, { correlationId: req.correlationId });
        sendData(res, req, verificationDto(result), 201);
      }),
    );
  }

  return router;
}

function recognitionDto(result) {
  return {
    type: 'display_phone_recognition',
    attributes: {
      state: result.state,
      retryable: Boolean(result.retryable),
      ...(result.state === 'RETURNING' && Number.isFinite(result.bonusBalance) ? { bonus_balance: result.bonusBalance } : {}),
      verification: result.verification ? verificationAttributes(result.verification) : null,
    },
  };
}

function verificationDto(result) {
  return { type: 'display_phone_verification_challenge', id: result.challengeId, attributes: verificationAttributes(result) };
}

function verificationAttributes(result) {
  return {
    challenge_id: result.challengeId,
    status: result.status,
    expires_at: result.expiresAt,
    max_attempts: result.maxAttempts,
    remaining_attempts: result.remainingAttempts,
    resend_creates_new_challenge: result.resendCreatesNewChallenge,
  };
}

module.exports = {
  createAuthRouter,
};
