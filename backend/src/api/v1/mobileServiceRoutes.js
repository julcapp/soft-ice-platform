const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { ApiError } = require('../../platform/errors/ApiError');
const { createServiceWorkspaceRouter } = require('./serviceWorkspaceRoutes');
const { MAX_PHOTO_BYTES } = require('../../modules/operator_workspace/ServiceVisitService');
function createMobileServiceRouter({ mobileSessions, serviceVisitService }) {
 const router = express.Router();
 const token = (req) => /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '')?.[1] || '';
 router.post('/login', asyncHandler(async(req,res)=>sendData(res,req,await mobileSessions.login({login:req.body?.login,password:req.body?.password,ipAddress:req.ip,userAgent:req.get('user-agent'),correlationId:req.correlationId}))));
 router.post('/challenge', asyncHandler(async(req,res)=>sendData(res,req,await mobileSessions.challenge(token(req),req.body || {}))));
 router.use('/workspace/visits/:visitId/photos',express.raw({type:['image/jpeg','image/png','image/webp'],limit:MAX_PHOTO_BYTES,verify:(req,_res,buffer)=>{req.rawBody=Buffer.from(buffer);}}));
 router.use(asyncHandler(async(req,_res,next)=>{
   req.securityContext=await mobileSessions.authenticate(token(req),{challengeId:req.get('X-Device-Challenge'),nonce:req.get('X-Device-Nonce'),signature:req.get('X-Device-Signature')},req.method,req.originalUrl,req.rawBody || Buffer.alloc(0));
   req.securityContext.correlation_id=req.correlationId; next();
 }));
 router.post('/logout',asyncHandler(async(req,res)=>sendData(res,req,await mobileSessions.logout(req.securityContext))));
 router.post('/role',asyncHandler(async(req,res)=>sendData(res,req,await mobileSessions.selectRole(req.securityContext,req.body?.role))));
 router.use((req,_res,next)=>req.securityContext.active_service_role ? next() : next(new ApiError({statusCode:403,code:'MOBILE_ROLE_REQUIRED',message:'Выберите роль мастера или техника.'})));
 router.use('/workspace',createServiceWorkspaceRouter({serviceVisitService}));
 return router;
}
module.exports={createMobileServiceRouter};
