const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');
function ctx(req) { return { roles: req.securityContext.roles, permissions: (req.get('X-Admin-Permissions') || '').split(',').filter(Boolean), actorId: req.securityContext.subject_id, correlationId: req.correlationId }; }
function createVideoSurveillanceRouter({ videoSurveillanceRuntime, adminAuth = {} }) {
  const router = express.Router(); router.use(createAdminAuthenticator(adminAuth));
  router.get('/machines/:machineId/cameras', (req, res) => sendData(res, req, videoSurveillanceRuntime.listCameras(req.params.machineId, ctx(req))));
  router.get('/machines/:machineId/cameras/:cameraId', (req, res) => sendData(res, req, videoSurveillanceRuntime.getCamera(req.params.machineId, req.params.cameraId, ctx(req))));
  router.get('/machines/:machineId/cameras/:cameraId/health', (req, res) => sendData(res, req, videoSurveillanceRuntime.getCamera(req.params.machineId, req.params.cameraId, ctx(req)).health));
  router.get('/machines/:machineId/video-fragments', (req, res) => sendData(res, req, videoSurveillanceRuntime.listFragments(req.params.machineId, ctx(req))));
  router.get('/machines/:machineId/video-incidents', (req, res) => sendData(res, req, videoSurveillanceRuntime.listIncidents(req.params.machineId, ctx(req))));
  router.get('/video-incidents/:incidentId', (req, res) => sendData(res, req, videoSurveillanceRuntime.getIncident(req.params.incidentId, ctx(req))));
  router.get('/video-audit', (req, res) => sendData(res, req, videoSurveillanceRuntime.auditLog(ctx(req))));
  router.post('/machines/:machineId/cameras/manual', asyncHandler(async (req, res) => sendData(res, req, await videoSurveillanceRuntime.registerCamera(req.params.machineId, req.body, ctx(req)), 201)));
  router.patch('/machines/:machineId/cameras/:cameraId/manual', asyncHandler(async (req, res) => sendData(res, req, await videoSurveillanceRuntime.updateCamera(req.params.machineId, req.params.cameraId, req.body, ctx(req)))));
  router.post('/machines/:machineId/cameras/:cameraId/check', asyncHandler(async (req, res) => sendData(res, req, await videoSurveillanceRuntime.check(req.params.machineId, req.params.cameraId, ctx(req)))));
  router.post('/machines/:machineId/cameras/:cameraId/control-recording', asyncHandler(async (req, res) => { const camera = videoSurveillanceRuntime.service.getRaw(req.params.machineId, req.params.cameraId, ctx(req)); return sendData(res, req, await videoSurveillanceRuntime.startOrExtend(camera, 'MANUAL_REQUEST', req.body?.eventId, ctx(req)), 201); }));
  router.post('/video-incidents', asyncHandler(async (req, res) => sendData(res, req, await videoSurveillanceRuntime.createIncident(req.body, ctx(req)), 201)));
  router.patch('/video-incidents/:incidentId', (req, res) => sendData(res, req, videoSurveillanceRuntime.updateIncident(req.params.incidentId, req.body, ctx(req))));
  router.post('/video-fragments/:fragmentId/legal-hold', asyncHandler(async (req, res) => sendData(res, req, await videoSurveillanceRuntime.legalHold(req.params.fragmentId, true, req.body?.reason, ctx(req)))));
  router.delete('/video-fragments/:fragmentId/legal-hold', asyncHandler(async (req, res) => sendData(res, req, await videoSurveillanceRuntime.legalHold(req.params.fragmentId, false, req.body?.reason, ctx(req)))));
  router.post('/video-fragments/:fragmentId/retention', asyncHandler(async (req, res) => sendData(res, req, await videoSurveillanceRuntime.extendRetention(req.params.fragmentId, Number(req.body?.hours || 72), req.body?.reason, ctx(req)))));
  return router;
}
module.exports = { createVideoSurveillanceRouter };
