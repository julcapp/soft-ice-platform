'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {createVerificationAdminRouter}=require('../src/api/v1/verificationAdminRoutes');
async function fixture(){
 const logs=[],challenges=[{id:'ch1',pointId:'p1',terminalId:'POS-001',status:'SENT',createdAt:new Date(),expiresAt:new Date(Date.now()+300000),sentAt:new Date(),attempts:0,maxAttempts:5,codeHash:'SECRET_DO_NOT_EXPOSE'}];
 const prisma={
  organizationLocation:{findMany:async({where})=>where.organizationId==='org1'?[{id:'p1'}]:[]},
  timoPosLoginChallenge:{
   findMany:async()=>challenges,
   findFirst:async({where})=>challenges.find(x=>x.id===where.id&&['PENDING','SENT'].includes(x.status)),
   updateMany:async({where,data})=>{const item=challenges.find(x=>x.id===where.id&&['PENDING','SENT'].includes(x.status));if(!item)return {count:0};Object.assign(item,data);return {count:1}},
  },auditEvent:{findMany:async()=>[],create:async({data})=>logs.push(data)},
  $transaction:async fn=>fn(prisma)
 };
 const app=express();app.use(express.json());
 app.use('/admin',createVerificationAdminRouter({prisma,adminAuth:{sessionService:{
  validateToken:async(token,{requiredPermission})=>({subject_id:'adm',organization_id:token==='other'?'org2':'org1',roles:['ORGANIZATION_ADMIN'],permissions:[requiredPermission]})
 }}}));
 const s=await new Promise(resolve=>{const x=app.listen(0,'127.0.0.1',()=>resolve(x))});
 const req=(url,token='ok',method='GET')=>fetch('http://127.0.0.1:'+s.address().port+'/admin/organizations/'+url,{method,headers:{Authorization:'Bearer '+token}});
 return {req,logs,challenges,close:()=>new Promise(resolve=>s.close(resolve))}
}
test('cannot retrieve OTP material and can revoke sent challenge with audit',async()=>{
 const f=await fixture();try{
  const res=await f.req('org1/verification-events');
  assert.equal(res.status,200);
  const text=await res.text();assert.doesNotMatch(text,/SECRET_DO_NOT_EXPOSE/);
  const data=JSON.parse(text);assert.equal(data.rawCodeAvailable,false);
  assert.equal(data.events[0].channel,'MAX');assert.equal(data.events[0].revocable,true);
  assert.equal((await f.req('org1/verification-events/ch1/revoke','ok','POST')).status,200);
  assert.equal(f.challenges[0].status,'REVOKED');assert.equal(f.logs.length,1);
  assert.equal((await f.req('org1/verification-events/ch1/revoke','ok','POST')).status,409);
 }finally{await f.close()}
});
test('administrators cannot access other organizations verification events',async()=>{
 const f=await fixture();try{
  assert.equal((await f.req('org1/verification-events','other')).status,403);
  assert.equal((await f.req('org1/verification-events/ch1/revoke','other','POST')).status,403);
 }finally{await f.close()}
});
