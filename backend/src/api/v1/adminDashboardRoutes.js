const express = require('express');
const { asyncHandler } = require('../../platform/http/apiResponse');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');
const { getPrismaClient } = require('../../common/database');
const { FinancialDayCloseService } = require('../../modules/payment_profile/FinancialDayCloseService');
function createAdminDashboardRouter({ adminDashboardService, businessDashboardService, financialReadinessService, yooKassaDailyReconciliationService, financialDayCloseService = null, adminAuth = {} }) {
  const router = express.Router();
  const authenticate = createAdminAuthenticator(adminAuth);
  const dayCloseService = financialDayCloseService || new FinancialDayCloseService({ prisma: getPrismaClient() });
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
  if (yooKassaDailyReconciliationService) {
    router.post('/yookassa-reconciliation/import', authenticate, express.text({ type: ['text/csv', 'text/plain'], limit: '10mb' }), asyncHandler(async (req, res) => {
      const data = await yooKassaDailyReconciliationService.importCsv({
        csvText: req.body,
        reportType: req.query.reportType,
        reportDate: req.query.reportDate,
        fileName: req.query.fileName || null,
        shopId: req.query.shopId || null,
        actorId: req.securityContext?.subject || req.securityContext?.subject_id || 'admin',
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
