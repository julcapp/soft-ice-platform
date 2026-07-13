const express = require('express');

const { toCustomerProfileDto } = require('../../modules/customer/customerDto');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');

function createCustomerRouter({ authCoreService, customerRuntime, clubAccountRuntime }) {
  const router = express.Router();
  const authenticateCustomer = createCustomerAuthenticator(authCoreService);

  router.get(
    '/me',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const customer = await customerRuntime.getOwnProfile(req.securityContext.subject_id);
      const clubAccount = await clubAccountRuntime.getOwnAccount(customer.id);

      sendData(res, req, toCustomerProfileDto(customer, clubAccount));
    }),
  );

  return router;
}

module.exports = {
  createCustomerRouter,
};
