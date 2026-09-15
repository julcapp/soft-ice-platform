const express = require('express');

const { ApiError } = require('../../platform/errors/ApiError');
const { asyncHandler } = require('../../platform/http/apiResponse');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');
const { CurrencyError } = require('../../modules/currency');

function toApiError(error) {
  if (!(error instanceof CurrencyError)) return error;

  const statusByCode = {
    UNSUPPORTED_CURRENCY: 400,
    INVALID_RATE_DATE: 400,
    RATE_NOT_FOUND: 404,
    SOURCE_UNAVAILABLE: 503,
    INVALID_PROVIDER_RESPONSE: 502,
  };

  return new ApiError({
    statusCode: statusByCode[error.code] || 500,
    code: error.code,
    message: error.message,
    details: error.details ? [error.details] : [],
    source: 'currency',
    retryable: error.code === 'SOURCE_UNAVAILABLE',
  });
}

function createCurrencyRateRouter({ currencyRateService, adminAuth = {} }) {
  if (!currencyRateService) throw new TypeError('createCurrencyRateRouter requires currencyRateService.');

  const router = express.Router();
  const authenticate = createAdminAuthenticator(adminAuth);

  router.get('/', authenticate, asyncHandler(async (req, res) => {
    try {
      const rate = await currencyRateService.getRate({
        currencyCode: req.query.currency,
        requestedDate: req.query.date,
      });

      res.json({
        data: {
          type: 'currency_rate',
          id: `${rate.currencyCode}:${rate.requestedDate}:${rate.source}`,
          attributes: rate,
        },
        meta: {
          api_version: 'v1',
          correlation_id: req.correlationId,
        },
      });
    } catch (error) {
      throw toApiError(error);
    }
  }));

  return router;
}

module.exports = {
  createCurrencyRateRouter,
  toApiError,
};
