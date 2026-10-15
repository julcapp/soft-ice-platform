const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
function createMessageCenterRouter({ service }) {
  const router = express.Router();
  router.get('/',asyncHandler(async(req,res)=>sendData(res,req,await service.list(req.query,req.securityContext))));
  router.get('/:id',asyncHandler(async(req,res)=>sendData(res,req,await service.get(req.params.id,req.securityContext))));
  return router;
}
module.exports = { createMessageCenterRouter };
