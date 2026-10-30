const express = require('express');

const {
  toClubAccountDto,
  toClubAccountTopUpDto,
  toClubAccountTransactionDto,
} = require('../../modules/club_account/clubAccountDto');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');

function createClubAccountRouter({ authCoreService, clubAccountRuntime, customerAutoTopupService }) {
  const router = express.Router();
  const authenticateCustomer = createCustomerAuthenticator(authCoreService);

  router.get(
    '/me',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const clubAccount = await clubAccountRuntime.getOwnAccount(
        req.securityContext.subject_id,
      );

      sendData(res, req, toClubAccountDto(clubAccount));
    }),
  );

  router.get(
    '/history',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const transactions = await clubAccountRuntime.getOwnHistory(
        req.securityContext.subject_id,
      );

      sendData(res, req, transactions.map(toClubAccountTransactionDto));
    }),
  );

  router.get(
    '/me/transactions',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const transactions = await clubAccountRuntime.getOwnHistory(
        req.securityContext.subject_id,
      );

      sendData(res, req, transactions.map(toClubAccountTransactionDto));
    }),
  );

  router.post(
    '/top-up',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const result = await clubAccountRuntime.topUpOwnAccount(
        req.securityContext.subject_id,
        normalizeTopUpRequest(req.body),
        {
          correlationId: req.correlationId,
          idempotencyKey: req.get('Idempotency-Key') || null,
          authMethod: req.securityContext.auth_method,
          sourceChannel: 'api_v1',
        },
      );

      sendData(res, req, toClubAccountTopUpDto(result), result.created ? 201 : 200);
    }),
  );

  router.post(
    '/me/top-ups',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const result = await clubAccountRuntime.topUpOwnAccount(
        req.securityContext.subject_id,
        normalizeTopUpRequest(req.body),
        {
          correlationId: req.correlationId,
          idempotencyKey: req.get('Idempotency-Key') || null,
          authMethod: req.securityContext.auth_method,
          sourceChannel: 'api_v1',
        },
      );

      sendData(res, req, toClubAccountTopUpDto(result), result.created ? 201 : 200);
    }),
  );

  router.get(
    '/me/auto-topup',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      sendData(res, req, await customerAutoTopupService.get(req.securityContext.subject_id));
    }),
  );

  router.post(
    '/me/auto-topup',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const result = await customerAutoTopupService.setup(
        req.securityContext.subject_id,
        {
          amountRub: req.body?.amountRub ?? req.body?.amount,
          billingDay: req.body?.billingDay ?? 1,
          offerVersion: req.body?.offerVersion,
        },
        { idempotencyKey: req.get('Idempotency-Key') || null, correlationId: req.correlationId },
      );
      sendData(res, req, result, result.setupPayment ? 201 : 200);
    }),
  );

  router.post(
    '/me/auto-topup/disable',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      sendData(res, req, await customerAutoTopupService.disable(req.securityContext.subject_id));
    }),
  );

  return router;
}

function normalizeTopUpRequest(body) {
  const referenceEntity =
    body && typeof body.reference_entity === 'object' ? body.reference_entity : {};

  return {
    amount: body ? body.amount : undefined,
    currency: body && body.currency ? body.currency : 'RUB',
    reason: body && body.reason ? body.reason : 'initial_club_deposit',
    referenceEntityType:
      (body && (body.reference_entity_type || body.referenceEntityType)) ||
      referenceEntity.type ||
      'mvp_vertical_slice',
    referenceEntityId:
      (body && (body.reference_entity_id || body.referenceEntityId)) ||
      referenceEntity.id ||
      (body && (body.client_request_id || body.clientRequestId)) ||
      null,
    clientRequestId: body && (body.client_request_id || body.clientRequestId),
    sourceId: body && (body.source_id || body.sourceId),
  };
}

module.exports = {
  createClubAccountRouter,
  normalizeTopUpRequest,
};
