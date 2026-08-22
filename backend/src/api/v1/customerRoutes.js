const express = require('express');

const { toCustomerIdentityDto, toCustomerProfileDto } = require('../../modules/customer/customerDto');
const { toConsentDto } = require('../../modules/consent/consentDto');
const { toCustomerSegmentDto } = require('../../modules/segmentation/segmentationDto');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');

function createCustomerRouter({ authCoreService, customerRuntime, consentRuntime, clubAccountRuntime, segmentationRuntime, referralEngagementService, customerProfileCommunicationService, crmRuntime }) {
  const router = express.Router();
  const authenticateCustomer = createCustomerAuthenticator(authCoreService);

  router.post('/email-verifications/confirm', asyncHandler(async (req, res) => {
    if (!customerProfileCommunicationService) return sendData(res, req, { status: 'UNAVAILABLE' }, 503);
    sendData(res, req, await customerProfileCommunicationService.confirmEmailVerification(req.body?.token));
  }));

  router.get('/me/segments', authenticateCustomer, asyncHandler(async (req, res) => {
    sendData(res, req, (await segmentationRuntime.listCustomerSegments(req.securityContext.subject_id)).map(toCustomerSegmentDto));
  }));
  router.get('/me/segment-history', authenticateCustomer, asyncHandler(async (req, res) => {
    sendData(res, req, (await segmentationRuntime.listCustomerSegmentHistory(req.securityContext.subject_id)).map(toCustomerSegmentDto));
  }));
  router.get('/me', authenticateCustomer, asyncHandler(async (req, res) => {
    const customer = await customerRuntime.getOwnProfile(req.securityContext.subject_id);
    sendData(res, req, toCustomerProfileDto(customer, await clubAccountRuntime.getOwnAccount(customer.id)));
  }));
  router.get('/me/profile-state', authenticateCustomer, asyncHandler(async (req, res) => {
    sendData(res, req, await customerProfileCommunicationService.ensureProfilePrompts(req.securityContext.subject_id));
  }));
  router.patch('/me/profile', authenticateCustomer, asyncHandler(async (req, res) => {
    sendData(res, req, await customerProfileCommunicationService.updateProfile(req.securityContext.subject_id, req.body));
  }));

  router.post('/me/email-verifications', authenticateCustomer, asyncHandler(async (req, res) => {
    const customerId = req.securityContext.subject_id;
    const result = await customerProfileCommunicationService.requestEmailVerification(customerId, req.body?.email);
    const baseUrl = String(process.env.PUBLIC_APP_BASE_URL || 'https://app.utimoshi.ru').replace(/\/$/, '');
    const verificationUrl = `${baseUrl}/?mode=verify-email&token=${encodeURIComponent(result.token)}`;
    let deliveryStatus = 'NOT_WIRED';
    if (crmRuntime?.queueNotification) {
      await crmRuntime.queueNotification(customerId, {
        channel: 'EMAIL',
        subject: 'Подтвердите электронную почту — Клуб Тимоши',
        body: `Для подтверждения электронной почты откройте ссылку: ${verificationUrl}\nСсылка действует 24 часа.`,
      }, {
        actorId: customerId,
        authMethod: req.securityContext.auth_method,
        correlationId: req.correlationId,
        idempotencyKey: `email-verification:${customerId}:${result.expiresAt.toISOString()}`,
      });
      deliveryStatus = 'QUEUED';
    }
    sendData(res, req, { email: result.email, expiresAt: result.expiresAt, deliveryStatus }, 202);
  }));

  router.post('/me/marketing-email-consent', authenticateCustomer, asyncHandler(async (req, res) => {
    sendData(res, req, await customerProfileCommunicationService.recordMarketingConsent(req.securityContext.subject_id, req.body, identityContext(req)), 201);
  }));
  router.get('/me/notifications', authenticateCustomer, asyncHandler(async (req, res) => {
    sendData(res, req, await customerProfileCommunicationService.listNotifications(req.securityContext.subject_id, { limit: req.query.limit }));
  }));
  router.post('/me/notifications/:notificationId/read', authenticateCustomer, asyncHandler(async (req, res) => {
    sendData(res, req, await customerProfileCommunicationService.markNotificationRead(req.securityContext.subject_id, req.params.notificationId));
  }));

  router.get('/me/referral-link', authenticateCustomer, asyncHandler(async (req, res) => {
    if (!referralEngagementService) return sendData(res, req, { status: 'UNAVAILABLE' }, 503);
    sendData(res, req, await referralEngagementService.getOrCreateLink(req.securityContext.subject_id));
  }));
  router.post('/me/referral-link-actions', authenticateCustomer, asyncHandler(async (req, res) => {
    if (!referralEngagementService) return sendData(res, req, { status: 'UNAVAILABLE' }, 503);
    const event = await referralEngagementService.record(req.securityContext.subject_id, req.body, identityContext(req));
    sendData(res, req, { id: event.id, action: event.metadata?.action, destination: event.metadata?.destination, occurredAt: event.occurredAt }, 201);
  }));

  router.post('/me/phone-verifications', authenticateCustomer, asyncHandler(async (req, res) => {
    const customer = await customerRuntime.verifyOwnPhone(req.securityContext.subject_id, req.body, identityContext(req));
    sendData(res, req, toCustomerProfileDto(customer, await clubAccountRuntime.getOwnAccount(customer.id)));
  }));
  router.get('/me/identities', authenticateCustomer, asyncHandler(async (req, res) => {
    sendData(res, req, (await customerRuntime.listOwnIdentities(req.securityContext.subject_id)).map(toCustomerIdentityDto));
  }));
  router.post('/me/consent-decisions', authenticateCustomer, asyncHandler(async (req, res) => {
    const result = await consentRuntime.recordOwnConsent(req.securityContext.subject_id, req.body, identityContext(req));
    sendData(res, req, toConsentDto(result.consent), result.created ? 201 : 200);
  }));
  router.get('/me/consent-decisions', authenticateCustomer, asyncHandler(async (req, res) => {
    sendData(res, req, (await consentRuntime.listOwnConsents(req.securityContext.subject_id)).map(toConsentDto));
  }));
  router.post('/me/consents', authenticateCustomer, asyncHandler(async (req, res) => {
    const result = await consentRuntime.recordOwnConsent(req.securityContext.subject_id, req.body, identityContext(req));
    sendData(res, req, toConsentDto(result.consent), result.created ? 201 : 200);
  }));
  router.get('/me/consents', authenticateCustomer, asyncHandler(async (req, res) => {
    sendData(res, req, (await consentRuntime.listOwnConsents(req.securityContext.subject_id)).map(toConsentDto));
  }));
  return router;
}

function identityContext(req) {
  return { correlationId: req.correlationId, authMethod: req.securityContext.auth_method, sourceChannel: 'MINI_APP' };
}

module.exports = { createCustomerRouter };
