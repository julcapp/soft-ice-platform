const express = require('express');

const {
  toCustomerIdentityDto,
  toCustomerProfileDto,
} = require('../../modules/customer/customerDto');
const { toConsentDto } = require('../../modules/consent/consentDto');
const { toCustomerSegmentDto } = require('../../modules/segmentation/segmentationDto');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');

function createCustomerRouter({ authCoreService, customerRuntime, consentRuntime, clubAccountRuntime, segmentationRuntime }) {
  const router = express.Router();
  const authenticateCustomer = createCustomerAuthenticator(authCoreService);

  router.get(
    '/me/segments',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const assignments = await segmentationRuntime.listCustomerSegments(req.securityContext.subject_id);
      sendData(res, req, assignments.map(toCustomerSegmentDto));
    }),
  );

  router.get(
    '/me/segment-history',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const assignments = await segmentationRuntime.listCustomerSegmentHistory(req.securityContext.subject_id);
      sendData(res, req, assignments.map(toCustomerSegmentDto));
    }),
  );

  router.get(
    '/me',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const customer = await customerRuntime.getOwnProfile(req.securityContext.subject_id);
      const clubAccount = await clubAccountRuntime.getOwnAccount(customer.id);

      sendData(res, req, toCustomerProfileDto(customer, clubAccount));
    }),
  );

  router.post(
    '/me/phone-verifications',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const customer = await customerRuntime.verifyOwnPhone(
        req.securityContext.subject_id,
        req.body,
        identityContext(req),
      );
      const clubAccount = await clubAccountRuntime.getOwnAccount(customer.id);
      sendData(res, req, toCustomerProfileDto(customer, clubAccount));
    }),
  );

  router.get(
    '/me/identities',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const identities = await customerRuntime.listOwnIdentities(req.securityContext.subject_id);
      sendData(res, req, identities.map(toCustomerIdentityDto));
    }),
  );

  router.post(
    '/me/consent-decisions',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const result = await consentRuntime.recordOwnConsent(
        req.securityContext.subject_id,
        req.body,
        identityContext(req),
      );
      sendData(res, req, toConsentDto(result.consent), result.created ? 201 : 200);
    }),
  );

  router.get(
    '/me/consent-decisions',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const consents = await consentRuntime.listOwnConsents(req.securityContext.subject_id);
      sendData(res, req, consents.map(toConsentDto));
    }),
  );

  router.post(
    '/me/consents',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const result = await consentRuntime.recordOwnConsent(
        req.securityContext.subject_id, req.body, identityContext(req),
      );
      sendData(res, req, toConsentDto(result.consent), result.created ? 201 : 200);
    }),
  );

  router.get(
    '/me/consents',
    authenticateCustomer,
    asyncHandler(async (req, res) => {
      const consents = await consentRuntime.listOwnConsents(req.securityContext.subject_id);
      sendData(res, req, consents.map(toConsentDto));
    }),
  );

  return router;
}

function identityContext(req) {
  return {
    correlationId: req.correlationId,
    authMethod: req.securityContext.auth_method,
    sourceChannel: 'api_v1',
  };
}

module.exports = {
  createCustomerRouter,
};
