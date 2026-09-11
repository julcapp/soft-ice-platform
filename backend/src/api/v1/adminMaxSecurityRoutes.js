const express = require('express');

function createAdminMaxSecurityRouter({ adminAuthService, adminMaxSecurityService }) {
  const router = express.Router();
  router.use(requireBearer(adminAuthService));

  router.get('/candidates', async (req, res, next) => {
    try {
      const data = await adminMaxSecurityService.listCandidates(req.securityContext);
      res.json({ data });
    } catch (error) { next(error); }
  });

  router.post('/confirm', async (req, res, next) => {
    try {
      const data = await adminMaxSecurityService.confirmCandidate(
        req.securityContext,
        req.body?.candidateId,
        requestContext(req),
      );
      res.json({ data });
    } catch (error) { next(error); }
  });

  return router;
}

function requireBearer(adminAuthService) {
  return async (req, _res, next) => {
    try {
      const header = req.get('authorization') || '';
      const match = /^Bearer\s+(.+)$/i.exec(header);
      const token = match ? match[1].trim() : '';
      req.securityContext = await adminAuthService.authenticate(token, { correlationId: req.correlationId });
      next();
    } catch (error) { next(error); }
  };
}

function requestIp(req) {
  const forwarded = req.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : req.ip || req.socket?.remoteAddress || null;
}

function requestContext(req) {
  return { correlationId: req.correlationId, ipAddress: requestIp(req), userAgent: req.get('user-agent') || null };
}

module.exports = { createAdminMaxSecurityRouter };
