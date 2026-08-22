const express = require('express');

const { ApiError } = require('../../platform/errors/ApiError');
const { attachCorrelationId, sendError } = require('../../platform/http/apiResponse');
const { getPrismaClient } = require('../../common/database');
const { BusinessDashboardService } = require('../../modules/admin_dashboard');
const { ReferralEngagementService } = require('../../modules/referral_engagement/ReferralEngagementService');
const { PrivateChannelBillingService } = require('../../modules/private_channel/PrivateChannelBillingService');
const { YooKassaPrivateChannelPaymentAdapter } = require('../../modules/private_channel/YooKassaPrivateChannelPaymentAdapter');
const { TelegramPrivateChannelAccessAdapter } = require('../../modules/private_channel/TelegramPrivateChannelAccessAdapter');
const { MaxPrivateChannelAccessAdapter } = require('../../modules/private_channel/MaxPrivateChannelAccessAdapter');
const { PrivateChannelAccessService } = require('../../modules/private_channel/PrivateChannelAccessService');
const { PrivateChannelRenewalService } = require('../../modules/private_channel/PrivateChannelRenewalService');
const { CustomerProfileCommunicationService } = require('../../modules/customer_profile/CustomerProfileCommunicationService');
const { createAuthRouter } = require('./authRoutes');
const { createClubAccountRouter } = require('./clubAccountRoutes');
const { createCustomerRouter } = require('./customerRoutes');
const { createMachineRouter } = require('./machineRoutes');
const { createMachineOperationsRouter } = require('./machineOperationsRoutes');
const { createMachineGatewayRouter } = require('./machineGatewayRoutes');
const { createCustomerOrdersRouter, createOrderRouter } = require('./orderRoutes');
const { createTelegramRouter } = require('./telegramRoutes');
const { createAdminDashboardRouter } = require('./adminDashboardRoutes');
const { createMachineTwinRouter } = require('./machineTwinRoutes');
const { createMachineRuntimeRouter } = require('./machineRuntimeRoutes');
const { createPlatformEventRouter } = require('./platformEventRoutes');
const { createInventoryRouter } = require('./inventoryRoutes');
const { createMaintenanceRouter } = require('./maintenanceRoutes');
const { createOperatorWorkspaceRouter } = require('./operatorWorkspaceRoutes');
const { createCRMRouter } = require('./crmRoutes');
const { createCustomer360Router, createAdminCustomer360Router } = require('./customer360Routes');
const { createExternalChannelRouter } = require('./externalChannelRoutes');
const { createMachineConnectivityRouter } = require('./machineConnectivityRoutes');
const { createVideoSurveillanceRouter } = require('./videoSurveillanceRoutes');
const { createEventCenterRouter } = require('./eventCenterRoutes');
const { createGiftTransferRouter, createAdminGiftTransferRouter } = require('./giftTransferRoutes');
const { createOrganizationRouter } = require('./organizationRoutes');
const { createSaleFlowRouter } = require('./saleFlowRoutes');
const { createTransactionalOutboxRouter } = require('./transactionalOutboxRoutes');
const { createPhotoVerificationRouter, createAdminPhotoVerificationRouter } = require('./photoVerificationRoutes');
const { createPrivateChannelRouter } = require('./privateChannelRoutes');

function createApiV1Router(dependencies, { logger } = {}) {
  const router = express.Router();
  const prisma = getPrismaClient();
  const privateChannelBillingService = dependencies.privateChannelBillingService || new PrivateChannelBillingService({ prisma });
  const privateChannelPaymentAdapter = dependencies.privateChannelPaymentAdapter || new YooKassaPrivateChannelPaymentAdapter();
  const telegramPrivateChannelAccessAdapter = dependencies.telegramPrivateChannelAccessAdapter || dependencies.privateChannelAccessAdapter || new TelegramPrivateChannelAccessAdapter();
  const maxPrivateChannelAccessAdapter = dependencies.maxPrivateChannelAccessAdapter || new MaxPrivateChannelAccessAdapter();
  const privateChannelAccessService = dependencies.privateChannelAccessService || new PrivateChannelAccessService({ prisma, adapters: { TELEGRAM: telegramPrivateChannelAccessAdapter, MAX: maxPrivateChannelAccessAdapter } });
  const privateChannelRenewalService = dependencies.privateChannelRenewalService || new PrivateChannelRenewalService({ prisma, paymentAdapter: privateChannelPaymentAdapter });
  const businessDashboardService = dependencies.businessDashboardService || new BusinessDashboardService({ prisma, privateChannelBillingService });
  const referralEngagementService = dependencies.referralEngagementService || new ReferralEngagementService({ prisma });
  const customerProfileCommunicationService = dependencies.customerProfileCommunicationService || new CustomerProfileCommunicationService({ prisma, crmRuntime: dependencies.crmRuntime || null });
  const runtimeDependencies = { ...dependencies, referralEngagementService, privateChannelBillingService, privateChannelPaymentAdapter, privateChannelAccessService, privateChannelRenewalService, customerProfileCommunicationService };

  router.use(attachCorrelationId);
  router.get('/', (req, res) => {
    res.json({ data: { type: 'api_version', id: 'v1', attributes: { status: 'online' } }, meta: { api_version: 'v1', correlation_id: req.correlationId } });
  });

  router.use('/auth', createAuthRouter(runtimeDependencies));
  router.use('/customers', createCustomerRouter(runtimeDependencies));
  router.use('/customer/orders', createCustomerOrdersRouter(runtimeDependencies));
  router.use('/club-account', createClubAccountRouter(runtimeDependencies));
  router.use('/club-accounts', createClubAccountRouter(runtimeDependencies));
  router.use('/private-channel', createPrivateChannelRouter(runtimeDependencies));
  router.use('/machines', createMachineRouter(runtimeDependencies));
  router.use('/machine-operations', createMachineOperationsRouter(runtimeDependencies));
  router.use('/machine', createMachineGatewayRouter(runtimeDependencies));
  router.use('/orders', createOrderRouter(runtimeDependencies));
  if (runtimeDependencies.giftTransferRuntime) {
    router.use('/me', createGiftTransferRouter(runtimeDependencies));
    router.use('/admin/gift-transfers', createAdminGiftTransferRouter(runtimeDependencies));
  }
  router.use('/telegram', createTelegramRouter(runtimeDependencies));
  router.use('/admin/dashboard', createAdminDashboardRouter({ ...runtimeDependencies, businessDashboardService }));
  router.use('/admin/machine-twins', createMachineTwinRouter(runtimeDependencies));
  router.use('/admin/machine-runtime', createMachineRuntimeRouter(runtimeDependencies));
  router.use('/admin/platform-events', createPlatformEventRouter(runtimeDependencies));
  router.use('/inventory', createInventoryRouter(runtimeDependencies));
  router.use('/admin/inventory', createInventoryRouter(runtimeDependencies));
  router.use('/maintenance', createMaintenanceRouter(runtimeDependencies));
  router.use('/admin/maintenance', createMaintenanceRouter(runtimeDependencies));
  router.use('/operator-workspace', createOperatorWorkspaceRouter(runtimeDependencies));
  router.use('/admin/crm', createCRMRouter(runtimeDependencies));
  router.use('/customer-360', createCustomer360Router(runtimeDependencies));
  router.use('/admin/customer-360', createAdminCustomer360Router(runtimeDependencies));
  router.use('/admin/customers', createExternalChannelRouter(runtimeDependencies));
  router.use('/admin/machines', createMachineConnectivityRouter(runtimeDependencies));
  router.use('/admin', createVideoSurveillanceRouter(runtimeDependencies));
  if (runtimeDependencies.photoPublicationReadModel) router.use('/photo-verification', createPhotoVerificationRouter(runtimeDependencies));
  if (runtimeDependencies.photoVerificationAdminService) router.use('/admin/photo-verification', createAdminPhotoVerificationRouter(runtimeDependencies));
  if (runtimeDependencies.eventCenterRuntime) router.use('/admin', createEventCenterRouter(runtimeDependencies));
  if (runtimeDependencies.organizationRuntime) router.use('/organizations', createOrganizationRouter(runtimeDependencies));
  if (runtimeDependencies.saleFlowService) router.use('/admin/sale-flows', createSaleFlowRouter(runtimeDependencies));
  if (runtimeDependencies.outboxAdminService) router.use('/admin/outbox', createTransactionalOutboxRouter(runtimeDependencies));

  router.use((req, res, next) => next(new ApiError({ statusCode: 404, code: 'RESOURCE_NOT_FOUND', message: 'API route was not found.' })));
  router.use((error, req, res, next) => {
    if (res.headersSent) { next(error); return; }
    sendError(res, req, error, logger);
  });
  return router;
}

module.exports = { createApiV1Router };
