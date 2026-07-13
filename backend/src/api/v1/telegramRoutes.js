const express = require('express');

const { toClubAccountDto } = require('../../modules/club_account/clubAccountDto');
const { toCustomerProfileDto } = require('../../modules/customer/customerDto');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');

function createTelegramRouter({ authCoreService, customerRuntime, clubAccountRuntime }) {
  const router = express.Router();
  const authenticateCustomer = createCustomerAuthenticator(authCoreService);

  router.get(
    '/mini-app/bootstrap',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const customer = await customerRuntime.getOwnProfile(req.securityContext.subject_id);
      const clubAccount = await clubAccountRuntime.getOwnAccount(customer.id);

      sendData(res, req, {
        type: 'telegram_mini_app_bootstrap',
        id: customer.id,
        attributes: {
          customer: toCustomerProfileDto(customer, clubAccount).attributes,
          club_account: toClubAccountDto(clubAccount).attributes,
          catalog_entrypoint: '/api/v1/catalog',
          feature_flags: {
            payments_enabled: false,
            machine_dispatch_enabled: false,
          },
        },
      });
    }),
  );

  return router;
}

module.exports = {
  createTelegramRouter,
};
