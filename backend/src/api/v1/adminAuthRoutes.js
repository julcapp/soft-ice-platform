const express = require('express');
const { attachCorrelationId } = require('../../platform/http/apiResponse');

function createAdminAuthRouter({ adminAuthService }) {
  const router = express.Router();
  router.use(attachCorrelationId);

  router.post('/login', async (req, res, next) => {
    try {
      const result = await adminAuthService.login({
        login: req.body?.login,
        password: req.body?.password,
        ipAddress: requestIp(req),
        userAgent: req.get('user-agent') || null,
        correlationId: req.correlationId,
      });
      res.json({ data: result });
    } catch (error) { next(error); }
  });

  router.get('/me', requireBearer(adminAuthService), async (req, res) => {
    res.json({ data: req.securityContext });
  });

  router.post('/logout', requireBearer(adminAuthService), async (req, res, next) => {
    try {
      await adminAuthService.logout(req.adminAccessToken, {
        correlationId: req.correlationId,
        ipAddress: requestIp(req),
        userAgent: req.get('user-agent') || null,
      });
      res.status(204).end();
    } catch (error) { next(error); }
  });

  return router;
}

function requireBearer(adminAuthService) {
  return async (req, _res, next) => {
    try {
      const token = bearer(req);
      req.adminAccessToken = token;
      req.securityContext = await adminAuthService.authenticate(token, { correlationId: req.correlationId });
      next();
    } catch (error) { next(error); }
  };
}

function createAdminBearerContextMiddleware(adminAuthService) {
  return async (req, _res, next) => {
    try {
      if (req.path.startsWith('/admin/auth')) return next();
      const token = bearer(req);
      if (!token) return next();
      req.securityContext = await adminAuthService.authenticate(token, { correlationId: req.correlationId });
      return next();
    } catch (error) { return next(error); }
  };
}

function bearer(req) {
  const header = req.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : '';
}

function requestIp(req) {
  const forwarded = req.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : req.ip || req.socket?.remoteAddress || null;
}

module.exports = { createAdminAuthRouter, createAdminBearerContextMiddleware };
