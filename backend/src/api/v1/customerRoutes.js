const express = require('express');

const {
  toCustomerIdentityDto,
  toCustomerProfileDto,
} = require('../../modules/customer/customerDto');
const { toConsentDto } = require('../../modules/consent/consentDto');
const { toCustomerSegmentDto } = require('../../modules/segmentation/segmentationDto');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');

function createCustomerRouter({ authCoreService, customerRuntime, consentRuntime, clubAccountRuntime, segmentationRuntime, referralEngagementService, customerProfileCommunicationService }) {
  const router = express.Router();
  const authenticateCustomer = createCustomerAuthenticator(authCoreService);

  router.post('/email-verifications/confirm', asyncHandler(async (req, res) => {
    if (!customerProfileCommunicationService) return sendData(res, req, { status: 'UNAVAILABLE' }, 503);
    const result = await customerProfileCommunicationService.confirmEmailVerification(req.body?.token);
    sendData(res, req, result);
  }));

  router.get('/me/segments', authenticateCustomer, asyncHandler(async (req, res) => {
    const assignments = await segmentationRuntime.listCustomerSegments(req.securityContext.subject_id);
    sendData(res, req, assignments.map(toCustomerSegmentDto));
  }));

  router.get('/me/segment-history', authenticateCustomer, asyncHandler(async (req, res) => {
    const assignments = await segmentationRuntime.listCustomerSegmentHistory(req.securityContext.subject_id);
    sendData(res, req, assignments.map(toCustomerSegmentDto));
  }));

  router.get('/me', authenticateCustomer, asyncHandler(async (req, res) => {
    const customer = await customerRuntime.getOwnProfile(req.securityContext.subject_id);
    const clubAccount = await clubAccountRuntime.getOwnAccount(customer.id);
    sendData(res, req, toCustomerProfileDto(customer, clubAccount));
  }));

  router.get('/me/profile-state', authenticateCustomer, asyncHandler(async (req, res) => {
    const result = await customerProfileCommunicationService.ensureProfilePrompts(req.securityContext.subject_id);
    sendData(res, req, result);
  }));

  router.patch('/me/profile', authenticateCustomer, asyncHandler(async (req, res) => {
    const result = await customerProfileCommunicationService.updateProfile(req.securityContext.subject_id, req.body);
    sendData(res, req, result);
  }));

  router.post('/me/email-verifications', authenticateCustomer, asyncHandler(async (req, res) => {
    const result = await customerProfileCommunicationService.requestEmailVerification(req.securityContext.subject_id, req.body?.email);
    // Token is returned by the domain service for the delivery adapter. The HTTP API never exposes it to the customer client.
    sendData(res, req, { email: result.email, expiresAt: result.expiresAt, deliveryStatus: 'QUEUED' }, 202);
  }));

  router.post('/me/marketing-email-consent', authenticateCustomer, asyncHandler(async (req, res) => {
    const result = await customerProfileCommunicationService.recordMarketingConsent(req.securityContext.subject_id, req.body, identityContext(req));
    sendData(res, req, result, 201);
  }));

  router.get('/me/notifications', authenticateCustomer, asyncHandler(async (req, res) => {
    const items = await customerProfileCommunicationService.listNotifications(req.securityContext.subject_id, { limit: req.query.limit });
    sendData(res, req, items);
  }));

  router.post('/me/notifications/:notificationId/read', authenticateCustomer, asyncHandler(async (req, res) => {
    const result = await customerProfileCommunicationService.markNotificationRead(req.securityContext.subject_id, req.params.notificationId);
    sendData(res, req, result);
  }));

  router.post('/me/referral-link-actions', authenticateCustomer, asyncHandler(async (req, res) => {
    if (!referralEngagementService) return sendData(res, req, { status: 'UNAVAILABLE' }, 503);
    const event = await referralEngagementService.record(req.securityContext.subject_id, req.body, identityContext(req));
    sendData(res, req, { id: event.id, action: event.metadata?.action, destination: event.metadata?.destination, occurredAt: event.occurredAt }, 201);
  }));

  router.post('/me/phone-verifications', authenticateCustomer, asyncHandler(async (req, res) => {
    const customer = await customerRuntime.verifyOwnPhone(req.securityContext.subject_id, req.body, identityContext(req));
    const clubAccount = await clubAccountRuntime.getOwnAccount(customer.id);
    sendData(res, req, toCustomerProfileDto(customer, clubAccount));
  }));

  router.get('/me/identities', authenticateCustomer, asyncHandler(async (req, res) => {
    const identities = await customerRuntime.listOwnIdentities(req.securityContext.subject_id);
    sendData(res, req, identities.map(toCustomerIdentityDto));
  }));

  router.post('/me/consent-decisions', authenticateCustomer, asyncHandler(async (req, res) => {
    const result = await consentRuntime.recordOwnConsent(req.securityContext.subject_id, req.body, identityContext(req));
    sendData(res, req, toConsentDto(result.consent), result.created ? 201 : 200);
  }));

  router.get('/me/consent-decisions', authenticateCustomer, asyncHandler(async (req, res) => {
    const consents = await consentRuntime.listOwnConsents(req.securityContext.subject_id);
    sendData(res, req, consents.map(toConsentDto));
  }));

  router.post('/me/consents', authenticateCustomer, asyncHandler(async (req, res) => {
    const result = await consentRuntime.recordOwnConsent(req.securityContext.subject_id, req.body, identityContext(req));
    sendData(res, req, toConsentDto(result.consent), result.created ? 201 : 200);
  }));

  router.get('/me/consents', authenticateCustomer, asyncHandler(async (req, res) => {
    const consents = await consentRuntime.listOwnConsents(req.securityContext.subject_id);
    sendData(res, req, consents.map(toConsentDto));
  }));

  return router;
}

function identityContext(req) {
  return {
    correlationId: req.correlationId,
    authMethod: req.securityContext.auth_method,
    sourceChannel: 'MINI_APP',
  };
}

module.exports = { createCustomerRouter };
