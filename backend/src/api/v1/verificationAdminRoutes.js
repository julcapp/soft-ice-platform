'use strict';
const express=require('express');
const {createAdminAuthenticator}=require('../../platform/security/authenticateAdmin');

/** Administrative verification EVENT visibility, never OTP plaintext or hashes.
 * Privilege is scoped to an authenticated organization. Raw customer identity
 * and delivery payloads are deliberately excluded from the response.
 */
function createVerificationAdminRouter({prisma,adminAuth}={}){
 if(!prisma?.timoPosLoginChallenge||!prisma?.organizationLocation||!adminAuth?.sessionService)
  throw Error('VERIFICATION_ADMIN_RUNTIME_REQUIRED');
 const router=express.Router();
 const authenticate=createAdminAuthenticator({...adminAuth,environment:'production',requiredPermission:'admin:organization:read'});
 const mutation=createAdminAuthenticator({...adminAuth,environment:'production',requiredPermission:'admin:organization:manage'});
 function isScoped(req,organizationId) {
  const s=req.securityContext||{},roles=s.roles||[];
  return roles.includes('PLATFORM_OWNER') ||
   (roles.some(r=>['ADMIN','ORGANIZATION_ADMIN'].includes(r)) &&
    (s.organization_id||s.organizationId)===organizationId);
 }
 router.get('/organizations/:organizationId/verification-events',authenticate,async(req,res,next)=>{
  try{
   const org=req.params.organizationId;
   if(!isScoped(req,org))return res.status(403).json({error:'VERIFICATION_SCOPE_DENIED'});
   const points=await prisma.organizationLocation.findMany({where:{organizationId:org},select:{id:true}});
   const pointIds=points.map(p=>p.id);
   const [logins,audit]=await Promise.all([
    prisma.timoPosLoginChallenge.findMany({
     where:{pointId:{in:pointIds}},orderBy:{createdAt:'desc'},take:100,
     select:{id:true,pointId:true,terminalId:true,status:true,createdAt:true,expiresAt:true,sentAt:true,consumedAt:true,attempts:true,maxAttempts:true}
    }),
    prisma.auditEvent.findMany({where:{organizationId:org,OR:[
      {eventType:{contains:'VERIFICATION',mode:'insensitive'}},
      {eventType:{contains:'OTP',mode:'insensitive'}},
      {eventType:{contains:'CHALLENGE',mode:'insensitive'}},
      {eventType:{contains:'CODE',mode:'insensitive'}},
    ]},orderBy:{occurredAt:'desc'},take:100,
    select:{id:true,eventType:true,sourceChannel:true,action:true,decision:true,occurredAt:true,reasonCode:true}})
   ]);
   const items=[
    ...logins.map(c=>({id:c.id,kind:'SELLER_LOGIN',channel:'MAX',pointId:c.pointId,terminalId:c.terminalId,
      status:c.status,createdAt:c.createdAt,expiresAt:c.expiresAt,sentAt:c.sentAt,
      attempts:c.attempts,maxAttempts:c.maxAttempts,revocable:['PENDING','SENT'].includes(c.status)&&new Date(c.expiresAt)>new Date()})),
    ...audit.map(a=>({id:a.id,kind:a.eventType,channel:a.sourceChannel||'UNKNOWN',
      status:a.decision,createdAt:a.occurredAt,action:a.action,reasonCode:a.reasonCode,revocable:false}))
   ].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,150);
   return res.set('Cache-Control','no-store').json({events:items,rawCodeAvailable:false,
     description:'OTP secrets, hashes and recipient identities are never returned.'});
  }catch(e){next(e)}
 });
 router.post('/organizations/:organizationId/verification-events/:challengeId/revoke',mutation,async(req,res,next)=>{
  try{
   const {organizationId,challengeId}=req.params;
   if(!isScoped(req,organizationId))return res.status(403).json({error:'VERIFICATION_SCOPE_DENIED'});
   const result=await prisma.$transaction(async tx=>{
    const points=await tx.organizationLocation.findMany({where:{organizationId},select:{id:true}});
    const match=await tx.timoPosLoginChallenge.findFirst({where:{
     id:challengeId,pointId:{in:points.map(p=>p.id)},status:{in:['PENDING','SENT']},
     expiresAt:{gt:new Date()}
    }});
    if(!match)return false;
    const updated=await tx.timoPosLoginChallenge.updateMany({
     where:{id:challengeId,status:{in:['PENDING','SENT']}},data:{status:'REVOKED'}
    });
    if(updated.count!==1)return false;
    await tx.auditEvent.create({data:{
     eventType:'TIMOPOS_LOGIN_CHALLENGE_REVOKED',
     subjectType:'ADMINISTRATOR',subjectId:req.securityContext.subject_id,
     targetType:'TIMOPOS_LOGIN_CHALLENGE',targetId:challengeId,
     action:'REVOKE',decision:'ALLOW',sourceChannel:'ADMIN_API',
     organizationId,correlationId:req.correlationId||null,
     authMethod:req.securityContext.auth_method||null,
     metadata:{pointId:match.pointId,terminalId:match.terminalId}
    }});
    return true;
   });
   if(!result)return res.status(409).json({error:'CHALLENGE_NOT_REVOCABLE'});
   return res.set('Cache-Control','no-store').json({revoked:true});
  }catch(e){next(e)}
 });
 return router;
}
module.exports={createVerificationAdminRouter};
