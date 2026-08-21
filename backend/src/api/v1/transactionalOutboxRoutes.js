const express=require('express');
const {createAdminAuthenticator}=require('../../platform/security/authenticateAdmin');
function createTransactionalOutboxRouter({outboxAdminService,adminAuth={}}){
  const router=express.Router();router.use(createAdminAuthenticator(adminAuth));
  const context=(req)=>({roles:req.securityContext.roles||[],organizationId:req.get('X-Organization-Id')||null,actorId:req.securityContext.subject_id,correlationId:req.correlationId});
  router.get('/',async(req,res,next)=>{try{const [items,counts]=await Promise.all([outboxAdminService.list(req.query,context(req)),outboxAdminService.counts(context(req))]);res.json({data:{items,counts}});}catch(e){next(e);}});
  router.post('/:eventId/retry',async(req,res,next)=>{try{res.json({data:await outboxAdminService.retry(req.params.eventId,context(req))});}catch(e){next(e);}});
  return router;
}
module.exports={createTransactionalOutboxRouter};
