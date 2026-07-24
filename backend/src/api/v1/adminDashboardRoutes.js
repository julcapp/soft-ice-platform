const express = require('express');
const { asyncHandler } = require('../../platform/http/apiResponse');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');
function createAdminDashboardRouter({ adminDashboardService, adminAuth = {} }) {
  const router = express.Router();
  router.get('/', createAdminAuthenticator(adminAuth), asyncHandler(async (req, res) => {
    res.json(await adminDashboardService.getDashboard(req.securityContext));
  }));
  return router;
}
module.exports = { createAdminDashboardRouter };
