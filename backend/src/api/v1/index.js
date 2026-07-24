const express = require('express');

const { ApiError } = require('../../platform/errors/ApiError');
const { attachCorrelationId, sendError } = require('../../platform/http/apiResponse');
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

function createApiV1Router(dependencies, { logger } = {}) {
  const router = express.Router();

  router.use(attachCorrelationId);

  router.get('/', (req, res) => {
    res.json({
      data: {
        type: 'api_version',
        id: 'v1',
        attributes: {
          status: 'online',
        },
      },
      meta: {
        api_version: 'v1',
        correlation_id: req.correlationId,
      },
    });
  });

  router.use('/auth', createAuthRouter(dependencies));
  router.use('/customers', createCustomerRouter(dependencies));
  router.use('/customer/orders', createCustomerOrdersRouter(dependencies));
  router.use('/club-account', createClubAccountRouter(dependencies));
  router.use('/club-accounts', createClubAccountRouter(dependencies));
  router.use('/machines', createMachineRouter(dependencies));
  router.use('/machine-operations', createMachineOperationsRouter(dependencies));
  router.use('/machine', createMachineGatewayRouter(dependencies));
  router.use('/orders', createOrderRouter(dependencies));
  router.use('/telegram', createTelegramRouter(dependencies));
  router.use('/admin/dashboard', createAdminDashboardRouter(dependencies));
  router.use('/admin/machine-twins', createMachineTwinRouter(dependencies));
  router.use('/admin/machine-runtime', createMachineRuntimeRouter(dependencies));
  router.use('/admin/platform-events', createPlatformEventRouter(dependencies));
  router.use('/inventory', createInventoryRouter(dependencies));
  router.use('/admin/inventory', createInventoryRouter(dependencies));
  router.use('/maintenance', createMaintenanceRouter(dependencies));
  router.use('/admin/maintenance', createMaintenanceRouter(dependencies));
  router.use('/operator-workspace', createOperatorWorkspaceRouter(dependencies));
  router.use('/admin/crm', createCRMRouter(dependencies));
  router.use('/customer-360', createCustomer360Router(dependencies));
  router.use('/admin/customer-360', createAdminCustomer360Router(dependencies));
  router.use('/admin/customers', createExternalChannelRouter(dependencies));
  router.use('/admin/machines', createMachineConnectivityRouter(dependencies));
  router.use('/admin', createVideoSurveillanceRouter(dependencies));
  if (dependencies.eventCenterRuntime) router.use('/admin', createEventCenterRouter(dependencies));

  router.use((req, res, next) => {
    next(
      new ApiError({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'API route was not found.',
      }),
    );
  });

  router.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    sendError(res, req, error, logger);
  });

  return router;
}

module.exports = {
  createApiV1Router,
};
