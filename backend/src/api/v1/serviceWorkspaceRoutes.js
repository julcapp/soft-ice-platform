const express = require('express');
const { ApiError } = require('../../platform/errors/ApiError');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { MAX_PHOTO_BYTES } = require('../../modules/operator_workspace/ServiceVisitService');

function createServiceWorkspaceRouter({ serviceVisitService }) {
  const router = express.Router();
  router.use((req, _res, next) => {
    if (req.securityContext?.subject_type !== 'administrator' || req.securityContext?.auth_method !== 'password') {
      return next(new ApiError({ statusCode: 401, code: 'SERVICE_AUTH_REQUIRED', message: 'Войдите в служебную панель.' }));
    }
    return next();
  });
  const route = (handler, status = 200) => asyncHandler(async (req, res) => sendData(res, req, await handler(req), status));
  router.get('/', route((req) => serviceVisitService.workspace(req.securityContext)));
  router.get('/machines/:machineId/diagnostics', route((req) => serviceVisitService.diagnostics(req.params.machineId, req.securityContext)));
  router.post('/machines/:machineId/visits', route((req) => serviceVisitService.open(req.params.machineId, req.securityContext), 201));
  router.get('/visits/:visitId', route((req) => serviceVisitService.detail(req.params.visitId, req.securityContext)));
  router.post('/visits/:visitId/photos', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_PHOTO_BYTES }),
    route((req) => serviceVisitService.addPhoto(req.params.visitId, { stage: req.query.stage, buffer: req.body }, req.securityContext), 201));
  router.get('/photos/:photoId', asyncHandler(async (req, res) => {
    const photo = await serviceVisitService.photo(req.params.photoId, req.securityContext);
    res.set({ 'Content-Type': photo.contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }).send(photo.buffer);
  }));
  router.post('/visits/:visitId/complete', route((req) => serviceVisitService.complete(req.params.visitId, req.body?.summary, req.securityContext)));
  return router;
}
module.exports = { createServiceWorkspaceRouter };
