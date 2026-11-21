'use strict';
const express=require('express');
const {createAdminAuthenticator}=require('../../platform/security/authenticateAdmin');
const {listPlatformTestTopups}=require('../../modules/club_account/TestClubAdminProjection');
function createTestClubAdminRouter({paymentRepository,adminAuth={}}){
 const router=express.Router();router.use(createAdminAuthenticator(adminAuth));
 router.get('/',async(req,res,next)=>{try{
  if(req.securityContext.auth_method!=='password'||!req.securityContext.roles?.includes('PLATFORM_OWNER'))throw Object.assign(new Error('Тестовые пополнения доступны владельцу платформы.'),{statusCode:403,code:'CLUB_TEST_ADMIN_FORBIDDEN'});
  const items=await listPlatformTestTopups(paymentRepository.prisma,req.query,{platform:true});
  res.json({data:items});
 }catch(error){next(error);}});
 return router;
}
module.exports={createTestClubAdminRouter};
