const crypto = require('crypto');
const express = require('express');
const { ApiError } = require('../../platform/errors/ApiError');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');

function createTerminalCustomerRouter({ customerRuntime }) {
  const router = express.Router();

  router.use((req, res, next) => {
    try {
      verifyTerminalToken(req);
      next();
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/customers/by-phone',
    asyncHandler(async (req, res) => {
      const projection = await customerRuntime.lookupTerminalCustomerByVerifiedPhone(req.body);
      sendData(res, req, {
        type: 'terminal_customer_lookup',
        attributes: {
          found: projection.found,
          customer: projection.customer && {
            customer_id: projection.customer.customerId,
            display_name: projection.customer.displayName,
            bonus_balance: projection.customer.bonusBalance,
            status: projection.customer.status,
          },
        },
      });
    }),
  );

  return router;
}

function verifyTerminalToken(req) {
  const expected = process.env.TERMINAL_API_TOKEN || '';
  const provided = req.get('X-Terminal-Token') || '';
  if (!expected || !safeEqual(expected, provided)) {
    throw new ApiError({
      statusCode: 401,
      code: 'TERMINAL_AUTHENTICATION_REQUIRED',
      message: 'Terminal authentication failed.',
      source: 'security',
    });
  }
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { createTerminalCustomerRouter };
