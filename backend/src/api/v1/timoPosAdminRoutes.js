'use strict';
const express=require('express');
const {createAdminAuthenticator}=require('../../platform/security/authenticateAdmin');
const {createTimoPosPointRouter}=require('./timoPosPointRoutes');

/** Opt-in administrative assignments for POS 001. Fail closed if not wired.
 * Uses the canonical OrganizationMember / OrganizationLocation records.
 * Does NOT register MAX identity or mark phone verified.
 */
function createTimoPosAdminRouter({prisma,adminAuth}={}){
 if(!prisma?.$transaction||!adminAuth?.sessionService)throw Error('TIMO_POS_ADMIN_DEPENDENCIES_REQUIRED');
 const router=express.Router();
 const read=createAdminAuthenticator({...adminAuth,environment:'production',requiredPermission:'admin:organization:read'});
 const write=createAdminAuthenticator({...adminAuth,environment:'production',requiredPermission:'admin:organization:manage'});
 function allowed(req,organizationId,mutation=false){
  const a=req.securityContext||{},roles=a.roles||[];
  if(!roles.some(r=>['PLATFORM_OWNER','ADMIN','ORGANIZATION_ADMIN'].includes(r)))return false;
  if(mutation&&!roles.some(r=>['PLATFORM_OWNER','ADMIN','ORGANIZATION_ADMIN'].includes(r)))return false;
  return roles.includes('PLATFORM_OWNER')||((a.organization_id||a.organizationId)===organizationId);
 }
 function invalid(res){return res.status(403).json({error:'TIMO_POS_ADMIN_SCOPE_DENIED'});}
 router.get('/organizations/:organizationId/points',read,async(req,res,next)=>{
  try{
   const {organizationId}=req.params;if(!allowed(req,organizationId))return invalid(res);
   const [points,terminals,assignments]=await Promise.all([
    prisma.organizationLocation.findMany({where:{organizationId},select:{id:true,name:true,address:true,openingHours:true,latitude:true,longitude:true,status:true}}),
    prisma.timoPosTerminal.findMany({where:{pointId:{in:(await prisma.organizationLocation.findMany({where:{organizationId},select:{id:true}})).map(x=>x.id)}}}),
    prisma.timoPosSellerPoint.findMany({where:{pointId:{in:(await prisma.organizationLocation.findMany({where:{organizationId},select:{id:true}})).map(x=>x.id)}}}),
   ]);
   res.set('Cache-Control','no-store').json({points,terminals,assignments});
  }catch(e){next(e)}
 });
 router.put('/organizations/:organizationId/points/:pointId/sellers/:sellerId',write,async(req,res,next)=>{
  try{
   const {organizationId,pointId,sellerId}=req.params;if(!allowed(req,organizationId,true))return invalid(res);
   if(typeof req.body?.active!=='boolean')return res.status(400).json({error:'INVALID_ACTIVE'});
   const result=await prisma.$transaction(async tx=>{
    const [point,member,role]=await Promise.all([
     tx.organizationLocation.findFirst({where:{id:pointId,organizationId,status:'ACTIVE',archivedAt:null}}),
     tx.organizationMember.findFirst({where:{id:sellerId,organizationId,status:'ACTIVE',archivedAt:null}}),
     tx.organizationRoleAssignment.findFirst({where:{organizationId,memberId:sellerId,role:'OPERATOR',revokedAt:null}}),
    ]);
    if(!point||!member||!role) return null;
    const assigned=await tx.timoPosSellerPoint.upsert({
      where:{sellerId_pointId:{sellerId,pointId}},create:{sellerId,pointId,active:req.body.active},
      update:{active:req.body.active}
    });
    await tx.auditEvent.create({data:{
      eventType:'TIMOPOS_SELLER_POINT_ASSIGNMENT',subjectType:'ADMINISTRATOR',subjectId:req.securityContext.subject_id,
      targetType:'TIMOPOS_SELLER_POINT',targetId:assigned.id,
      action:req.body.active?'ASSIGN':'REVOKE',decision:'ALLOW',
      sourceChannel:'ADMIN_API',correlationId:req.correlationId,
      organizationId,authMethod:req.securityContext.auth_method||null,
      metadata:{pointId,sellerId,active:req.body.active}
    }});
    return assigned;
   });
   if(!result)return res.status(409).json({error:'SELLER_POINT_OR_ROLE_NOT_VALID'});
   res.set('Cache-Control','no-store').json({id:result.id,pointId,sellerId,active:result.active});
  }catch(e){next(e)}
 });
 router.post('/organizations/:organizationId/points/:pointId/terminals',write,async(req,res,next)=>{
  try{
   const {organizationId,pointId}=req.params;
   if(!allowed(req,organizationId,true))return invalid(res);
   const terminalId=String(req.body?.terminalId||'');
   if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(terminalId))
    return res.status(400).json({error:'INVALID_TERMINAL_ID'});
   const result=await prisma.$transaction(async tx=>{
    const point=await tx.organizationLocation.findFirst({
      where:{id:pointId,organizationId,status:'ACTIVE',archivedAt:null}});
    if(!point)return null;
    const existing=await tx.timoPosTerminal.findUnique({where:{terminalId}});
    if(existing)return existing.pointId===pointId?existing:false;
    const created=await tx.timoPosTerminal.create({data:{terminalId,pointId,active:true}});
    await tx.auditEvent.create({data:{
      eventType:'TIMOPOS_TERMINAL_REGISTERED',subjectType:'ADMINISTRATOR',
      subjectId:req.securityContext.subject_id,targetType:'TIMOPOS_TERMINAL',targetId:created.id,
      action:'REGISTER',decision:'ALLOW',sourceChannel:'ADMIN_API',
      correlationId:req.correlationId,organizationId,
      authMethod:req.securityContext.auth_method||null,metadata:{terminalId,pointId}
    }});
    return created;
   });
   if(!result)return res.status(404).json({error:'POINT_NOT_FOUND'});
   if(result===false)return res.status(409).json({error:'TERMINAL_BOUND_TO_ANOTHER_POINT'});
   return res.status(201).set('Cache-Control','no-store')
      .json({terminalId:result.terminalId,pointId:result.pointId,active:result.active});
  }catch(e){next(e)}
 });
 router.post('/organizations/:organizationId/points/:pointId/sellers',write,async(req,res,next)=>{
  try{
   const {organizationId,pointId}=req.params;
   if(!allowed(req,organizationId,true))return invalid(res);
   const fullName=String(req.body?.fullName||'').trim();
   const phone=String(req.body?.phone||'').replace(/[^+0-9]/g,'');
   if(fullName.length<5||fullName.length>120||!/^\+7[0-9]{10}$/.test(phone))
    return res.status(400).json({error:'INVALID_SELLER_DETAILS'});
   const result=await prisma.$transaction(async tx=>{
    const point=await tx.organizationLocation.findFirst({where:{id:pointId,organizationId,status:'ACTIVE',archivedAt:null}});
    if(!point)return {error:'POINT_NOT_FOUND'};
    const existing=await tx.organizationMember.findFirst({where:{organizationId,phone,archivedAt:null}});
    if(existing)return {error:'SELLER_PHONE_ALREADY_EXISTS'};
    const member=await tx.organizationMember.create({data:{
      organizationId,fullName,phone,position:'Продавец',status:'ACTIVE'
    }});
    await tx.organizationRoleAssignment.create({data:{
      organizationId,memberId:member.id,role:'OPERATOR',grantedBy:req.securityContext.subject_id
    }});
    await tx.timoPosSellerPoint.create({data:{sellerId:member.id,pointId,active:true}});
    await tx.auditEvent.create({data:{
      eventType:'TIMOPOS_SELLER_CREATED',subjectType:'ADMINISTRATOR',subjectId:req.securityContext.subject_id,
      targetType:'ORGANIZATION_MEMBER',targetId:member.id,action:'CREATE_AND_ASSIGN',decision:'ALLOW',
      sourceChannel:'ADMIN_API',correlationId:req.correlationId,organizationId,
      authMethod:req.securityContext.auth_method||null,metadata:{pointId,role:'OPERATOR'}
    }});
    return {memberId:member.id,fullName:member.fullName,pointId};
   });
   if(result.error)return res.status(result.error==='POINT_NOT_FOUND'?404:409).json({error:result.error});
   return res.status(201).set('Cache-Control','no-store').json(result);
  }catch(e){next(e)}
 });
 // Point management routes belong to the same authenticated administrator runtime.
 router.use('/', createTimoPosPointRouter({prisma,adminAuth}));
 return router;
}
module.exports={createTimoPosAdminRouter};
