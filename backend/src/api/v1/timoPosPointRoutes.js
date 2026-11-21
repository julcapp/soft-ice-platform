'use strict';
const express = require('express');
const {createAdminAuthenticator} = require('../../platform/security/authenticateAdmin');
const {isBusinessOpen} = require('../../modules/timopos/TimoPosAccessPolicy');

const STARTER_POINT_NAMES = Object.freeze(['Точка продаж №001','Точка продаж №002','Точка продаж №003','Точка продаж №004','Точка продаж №005']);
const DEFAULT_TIME_ZONE = 'Asia/Tomsk';
const schedule247 = (timeZone=DEFAULT_TIME_ZONE)=>({mode:'24_7',timeZone,days:{}});
const allowedZone = zone => {
 try { new Intl.DateTimeFormat('en-US',{timeZone:zone}); return true; } catch { return false; }
};
function validateSchedule(schedule){
 if(!schedule || !allowedZone(schedule.timeZone))return false;
 if(schedule.mode==='24_7')return schedule.days&&typeof schedule.days==='object';
 if(schedule.mode!=='SCHEDULED'||!schedule.days||typeof schedule.days!=='object')return false;
 const validTime = s=>typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
 for(let d=0;d<7;d++){
  const slots=schedule.days[String(d)];
  if(!Array.isArray(slots))return false;
  if(!slots.every(s=>validTime(s.from)&&validTime(s.to)&&s.from<s.to))return false;
 }
 return true;
}
function createTimoPosPointRouter({prisma,adminAuth}={}){
 if(!prisma?.$transaction||!adminAuth?.sessionService)throw Error('TIMOPOS_POINT_RUNTIME_REQUIRED');
 const router=express.Router(),authenticate=createAdminAuthenticator({...adminAuth,environment:'production',requiredPermission:'admin:organization:manage'});
 const scope=(req,org)=>{const c=req.securityContext||{},roles=c.roles||[];
 return roles.includes('PLATFORM_OWNER')||(roles.some(r=>['ADMIN','ORGANIZATION_ADMIN'].includes(r))&&(c.organization_id||c.organizationId)===org);
 };
 const audit=(req,org,action,targetId,metadata)=>({
  eventType:'TIMOPOS_POINT_MANAGEMENT',subjectType:'ADMINISTRATOR',subjectId:req.securityContext.subject_id,
  targetType:'ORGANIZATION_LOCATION',targetId,action,decision:'ALLOW',sourceChannel:'ADMIN_API',
  correlationId:req.correlationId||null,authMethod:req.securityContext.auth_method||null,organizationId:org,metadata
 });
 const createPoint=async(tx,req,org,{name,address,openingHours})=>{
  const point=await tx.organizationLocation.create({data:{
   organizationId:org,name,address,openingHours,status:'ACTIVE'
  }});
  await tx.auditEvent.create({data:audit(req,org,'CREATE',point.id,{name})});
  return point;
 };
 router.use(authenticate);
 router.param('organizationId',(req,res,next,organizationId)=>{
  if(!scope(req,organizationId))return res.status(403).json({error:'POINT_ADMIN_SCOPE_DENIED'});
  return next();
 });
 router.post('/organizations/:organizationId/points/initialize',async(req,res,next)=>{
  try {
   const org=req.params.organizationId;
   const result=await prisma.$transaction(async tx=>{
    const organization=await tx.organization.findUnique({where:{id:org}});
    if(!organization)return null;
    const existing=await tx.organizationLocation.findMany({where:{organizationId:org},select:{id:true,name:true}});
    const known=new Set(existing.map(p=>p.name));
    const created=[];
    for(const name of STARTER_POINT_NAMES){
     if(known.has(name))continue;
     created.push(await createPoint(tx,req,org,{name,address:'Адрес не указан',openingHours:schedule247()}));
    }
    return created;
   });
   if(!result)return res.status(404).json({error:'ORGANIZATION_NOT_FOUND'});
   return res.status(200).json({created:result.length,points:result.map(({id,name,openingHours})=>({id,name,openingHours}))});
  }catch(e){next(e)}
 });
 router.post('/organizations/:organizationId/points',async(req,res,next)=>{
  try{
   const {organizationId}=req.params;
   const name=String(req.body?.name||'').trim();
   const address=String(req.body?.address||'Адрес не указан').trim();
   const openingHours=req.body?.openingHours||schedule247();
   if(name.length<3||name.length>120||!address||address.length>350||!validateSchedule(openingHours))
    return res.status(400).json({error:'INVALID_POINT_PROPERTIES'});
   const result=await prisma.$transaction(tx=>createPoint(tx,req,organizationId,{name,address,openingHours}));
   return res.status(201).json({point:result});
  }catch(e){next(e)}
 });
 router.patch('/organizations/:organizationId/points/:pointId',async(req,res,next)=>{
  try{
   const {organizationId,pointId}=req.params;
   const b=req.body||{},data={};
   if(Object.hasOwn(b,'name')){if(typeof b.name!=='string'||b.name.trim().length<3||b.name.length>120)return res.status(400).json({error:'INVALID_NAME'});data.name=b.name.trim()}
   if(Object.hasOwn(b,'address')){if(typeof b.address!=='string'||!b.address.trim()||b.address.length>350)return res.status(400).json({error:'INVALID_ADDRESS'});data.address=b.address.trim()}
   if(Object.hasOwn(b,'openingHours')){if(!validateSchedule(b.openingHours))return res.status(400).json({error:'INVALID_SCHEDULE'});data.openingHours=b.openingHours}
   if(Object.hasOwn(b,'latitude')||Object.hasOwn(b,'longitude')){
    const lat=b.latitude,lon=b.longitude;
    if(typeof lat!=='number'||typeof lon!=='number'||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)
     return res.status(400).json({error:'INVALID_COORDINATES'});
    data.latitude=lat;data.longitude=lon;
   }
   if(!Object.keys(data).length)return res.status(400).json({error:'NO_CHANGES'});
   const result=await prisma.$transaction(async tx=>{
    const old=await tx.organizationLocation.findFirst({where:{id:pointId,organizationId,archivedAt:null}});
    if(!old)return null;
    const item=await tx.organizationLocation.update({where:{id:pointId},data});
    await tx.auditEvent.create({data:audit(req,organizationId,'UPDATE',pointId,{fields:Object.keys(data)})});
    return item;
   });
   if(!result)return res.status(404).json({error:'POINT_NOT_FOUND'});
   res.json({point:result});
  }catch(e){next(e)}
 });
 return router;
}
module.exports={createTimoPosPointRouter,STARTER_POINT_NAMES,schedule247,validateSchedule};
