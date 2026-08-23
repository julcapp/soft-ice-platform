const express = require('express');
const { asyncHandler } = require('../../platform/http/apiResponse');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');
function createAdminDashboardRouter({ adminDashboardService, businessDashboardService, financialReadinessService, adminAuth = {} }) {
  const router = express.Router();
  const authenticate = createAdminAuthenticator(adminAuth);
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
  return router;
}
module.exports = { createAdminDashboardRouter };
