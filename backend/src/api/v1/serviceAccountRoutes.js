const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
function createServiceAccountRouter({ serviceAccountAccess }) {
  const router = express.Router();
  const route = (fn) => asyncHandler(async (req, res) => sendData(res, req, await fn(req)));
  router.post('/users', route((req) => serviceAccountAccess.createStaff(req.body, req.securityContext)));
  router.get('/', route((req) => serviceAccountAccess.list(req.securityContext)));
  router.put('/users/:userId/member', route((req) => serviceAccountAccess.bind(req.params.userId, req.body?.memberId, req.securityContext, { grantRole: req.body?.grantRole === true })));
  router.put('/users/:userId/machines/:assignmentId', route((req) => serviceAccountAccess.assign(req.params.userId, req.params.assignmentId, req.body?.assigned, req.securityContext)));
  return router;
}
module.exports = { createServiceAccountRouter };
