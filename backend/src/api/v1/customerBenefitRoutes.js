'use strict';
const express=require('express');
const {getPrismaClient}=require('../../common/database');
const {createAdminAuthenticator}=require('../../platform/security/authenticateAdmin');
const {asyncHandler,sendData}=require('../../platform/http/apiResponse');
const {CustomerBenefitService}=require('../../modules/customer_benefits/CustomerBenefitService');
const {problem}=require('../../modules/customer_benefits/BenefitRules');
function createCustomerBenefitRouter(dependencies={}){
 const router=express.Router(),service=dependencies.customerBenefitService||new CustomerBenefitService({prisma:dependencies.prisma||getPrismaClient()});
 router.use(createAdminAuthenticator(dependencies.adminAuth||{}));
 router.use((req,res,next)=>{const roles=(req.securityContext?.roles||[]).map(r=>String(r).toUpperCase());if(!roles.some(r=>['PLATFORM_OWNER','OWNER','ADMIN'].includes(r)))return next(problem('BENEFIT_FORBIDDEN','Управление условиями доступно администратору.',403));next();});
 const actor=req=>req.securityContext.actor_id||req.securityContext.subject_id||'administrator';
 router.get('/',asyncHandler(async(req,res)=>sendData(res,req,await service.read())));
 router.post('/initialize',asyncHandler(async(req,res)=>sendData(res,req,await service.initialize(actor(req)))));
 router.post('/versions',asyncHandler(async(req,res)=>sendData(res,req,await service.save({...req.body,actorId:actor(req)}))));
 router.post('/activate',asyncHandler(async(req,res)=>sendData(res,req,await service.activate({...req.body,actorId:actor(req)}))));
 router.post('/preview',asyncHandler(async(req,res)=>sendData(res,req,await service.preview({...req.body,actorId:actor(req)}))));
 router.get('/journal',asyncHandler(async(req,res)=>sendData(res,req,await service.journal())));
 return router;
}
module.exports={createCustomerBenefitRouter};
