const express = require('express');
const { asyncHandler } = require('../../platform/http/apiResponse');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');

function createAdministratorSecurityRouter({ adminAuth = {} }) {
  const router = express.Router();
  const authenticate = createAdminAuthenticator({ ...adminAuth, requiredPermission: 'admin:access:read' });
  router.get('/session', authenticate, asyncHandler(async (req, res) => res.json({ administrator: req.securityContext })));
  router.delete('/sessions/:sessionId', createAdminAuthenticator({ ...adminAuth, requiredPermission: 'admin:session:revoke' }), asyncHandler(async (req, res) => {
    res.json(await adminAuth.sessionService.revokeSession({ sessionId: req.params.sessionId, actor: req.securityContext, correlationId: req.correlationId }));
  }));
  return router;
}
module.exports = { createAdministratorSecurityRouter };
