const express = require('express');
const { asyncHandler } = require('../../platform/http/apiResponse');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');
const { getPrismaClient } = require('../../common/database');
const { FinancialDayCloseService } = require('../../modules/payment_profile/FinancialDayCloseService');
function createAdminDashboardRouter({ adminDashboardService, businessDashboardService, financialReadinessService, yooKassaDailyReconciliationService, financialDayCloseService = null, adminNotificationCenterService = null, adminOperationsDispatchService = null, adminAuth = {} }) {
  const router = express.Router();
  const authenticate = createAdminAuthenticator(adminAuth);
  const dayCloseService = financialDayCloseService || new FinancialDayCloseService({ prisma: getPrismaClient() });
  const adminSubject = (req) => req.securityContext?.subject || req.securityContext?.subject_id || 'admin';
  router.get('/', authenticate, asyncHandler(async (req, res) => {
    res.json(await adminDashboardService.getDashboard(req.securityContext));
  }));
  if (businessDashboardService) {
    router.get('/business', authenticate, asyncHandler(async (req, res) => {
      res.json({ data: await businessDashboardService.getDashboard(req.securityContext, { from: req.query.from, to: req.query.to }) });
    }));
  }
  if (financialReadinessService) {
    router.get('/financial-readiness', authenticate, asyncHandler(async (req, res) => {
      res.json({ data: await financialReadinessService.get() });
    }));
  }
  router.get('/financial-day-close', authenticate, asyncHandler(async (req, res) => {
    res.json({ data: await dayCloseService.getDay(req.query.reportDate) });
  }));
  if (adminNotificationCenterService) {
    router.get('/notifications', authenticate, asyncHandler(async (req, res) => {
      res.json({ data: await adminNotificationCenterService.list({ adminSubject: adminSubject(req), limit: req.query.limit }) });
    }));
    router.post('/notifications/read', authenticate, express.json(), asyncHandler(async (req, res) => {
      res.json({ data: await adminNotificationCenterService.markRead({ adminSubject: adminSubject(req), notificationKey: req.body?.notificationKey }) });
    }));
    router.post('/notifications/read-all', authenticate, asyncHandler(async (req, res) => {
      res.json({ data: await adminNotificationCenterService.markAllRead({ adminSubject: adminSubject(req) }) });
    }));
  }
  if (adminOperationsDispatchService) {
    router.get('/operations-dispatch', authenticate, asyncHandler(async (req, res) => {
      res.json({ data: await adminOperationsDispatchService.list({
        adminSubject: adminSubject(req), category: req.query.category || 'ALL', severity: req.query.severity || 'ALL', status: req.query.status || 'ALL', limit: req.query.limit,
      }) });
    }));
    router.post('/operations-dispatch/update', authenticate, express.json(), asyncHandler(async (req, res) => {
      res.json({ data: await adminOperationsDispatchService.update({
        notificationKey: req.body?.notificationKey, actorSubject: adminSubject(req), status: req.body?.status, assigneeSubject: req.body?.assigneeSubject, comment: req.body?.comment,
      }) });
    }));
    router.get('/operations-dispatch/history', authenticate, asyncHandler(async (req, res) => {
      res.json({ data: await adminOperationsDispatchService.history({ notificationKey: req.query.notificationKey, limit: req.query.limit }) });
    }));
  }
  if (yooKassaDailyReconciliationService) {
    router.post('/yookassa-reconciliation/import', authenticate, express.text({ type: ['text/csv', 'text/plain'], limit: '10mb' }), asyncHandler(async (req, res) => {
      const data = await yooKassaDailyReconciliationService.importCsv({
        csvText: req.body,
        reportType: req.query.reportType,
        reportDate: req.query.reportDate,
        fileName: req.query.fileName || null,
        shopId: req.query.shopId || null,
        actorId: adminSubject(req),
      });
      res.status(201).json({ data });
    }));
    router.get('/yookassa-reconciliation/issues', authenticate, asyncHandler(async (req, res) => {
      res.json({ data: await yooKassaDailyReconciliationService.listIssues({ limit: req.query.limit, status: req.query.status || 'OPEN' }) });
    }));
  }
  return router;
}
module.exports = { createAdminDashboardRouter };
