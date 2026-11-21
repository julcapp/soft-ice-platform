'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {createTimoPosAdminRouter}=require('../src/api/v1/timoPosAdminRoutes');
const point={id:'point-001',organizationId:'org-1',name:'Точка №001'};
const audit=[];
const prisma={
  organizationLocation:{
    findMany:async()=>[point],
    findFirst:async({where})=>where.id===point.id&&where.organizationId==='org-1'?point:null,
  },
  organizationMember:{findFirst:async({where})=>where.id==='seller-1'?{id:'seller-1',organizationId:'org-1'}:null},
  organizationRoleAssignment:{findFirst:async({where})=>where.role==='OPERATOR'?{id:'role1'}:null},
  timoPosTerminal:{findMany:async()=>[{terminalId:'POS-001',pointId:'point-001'}],findUnique:async({where})=>where.terminalId==='POS-001'?{id:'t1',terminalId:'POS-001',pointId:'point-001',active:true}:null,create:async({data})=>({id:'new-t1',...data})},
  timoPosSellerPoint:{
    findMany:async()=>[{id:'a1',sellerId:'seller-1',pointId:'point-001',active:true}],
    upsert:async args=>({id:'a1',...args.create})
  },
  auditEvent:{create:async({data})=>{audit.push(data);return data;}},
  $transaction:async fn=>fn(prisma),
};
async function fixture(){
 const app=express();app.use(express.json());app.use('/api/v1/admin/timopos',createTimoPosAdminRouter({
 prisma,adminAuth:{environment:'production',sessionService:{
 async validateToken(token,{requiredPermission}){
  if(token==='platform')return {subject_id:'boss',organization_id:null,roles:['PLATFORM_OWNER'],permissions:['admin:*'],auth_method:'bearer'};
  if(token==='scoped')return {subject_id:'admin1',organization_id:'org-1',roles:['ORGANIZATION_ADMIN'],permissions:[requiredPermission],auth_method:'bearer'};
  if(token==='unauthorized')return {subject_id:'visitor',organization_id:'org-1',roles:['SELLER'],permissions:[requiredPermission],auth_method:'bearer'};
  throw Error('invalid token');
 }}}}));
 app.use((err,req,res,next)=>res.status(401).json({error:'AUTH_REQUIRED'}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const base='http://127.0.0.1:'+server.address().port+'/api/v1/admin/timopos';
 const call=(path,token='scoped',method='GET',body)=>fetch(base+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {call,close:()=>new Promise(resolve=>server.close(resolve))};
}
test('admin only gets scoped terminals and assignments',async()=>{
 const f=await fixture();try{
  const r=await f.call('/organizations/org-1/points');assert.equal(r.status,200);
  const j=await r.json();assert.equal(j.terminals[0].terminalId,'POS-001');assert.equal(j.assignments[0].sellerId,'seller-1');
  assert.equal((await f.call('/organizations/org-2/points')).status,403);
  assert.equal((await f.call('/organizations/org-1/points','unauthorized')).status,403);
 }finally{await f.close();}
});
test('authorized administrator may assign only valid OPERATOR seller and audit',async()=>{
 const f=await fixture();try{
  const url='/organizations/org-1/points/point-001/sellers/seller-1';
  const r=await f.call(url,'scoped','PUT',{active:true});assert.equal(r.status,200);
  assert.equal(audit.at(-1).eventType,'TIMOPOS_SELLER_POINT_ASSIGNMENT');
  assert.equal(audit.at(-1).subjectId,'admin1');
  assert.equal(audit.at(-1).metadata.pointId,'point-001');
  assert.equal((await f.call(url,'scoped','PUT',{active:'true'})).status,400);
  assert.equal((await f.call('/organizations/org-2/points/point-001/sellers/seller-1','scoped','PUT',{active:true})).status,403);
  assert.equal((await f.call('/organizations/org-1/points/point-001/sellers/unknown','scoped','PUT',{active:true})).status,409);
 }finally{await f.close();}
});
test('admin registers terminal only in assigned active point and records audit',async()=>{
 const f=await fixture();try{
  const url='/organizations/org-1/points/point-001/terminals';
  const ok=await f.call(url,'scoped','POST',{terminalId:'POS-002'});
  assert.equal(ok.status,201);
  const result=await ok.json();assert.equal(result.terminalId,'POS-002');
  assert.equal(audit.at(-1).eventType,'TIMOPOS_TERMINAL_REGISTERED');
  assert.equal((await f.call(url,'scoped','POST',{terminalId:'bad terminal'})).status,400);
  assert.equal((await f.call('/organizations/org-2/points/point-001/terminals','scoped','POST',{terminalId:'POS-002'})).status,403);
 }finally{await f.close();}
});
test('router denies missing PostgreSQL/session dependencies',()=>{
 assert.throws(()=>createTimoPosAdminRouter({}),/DEPENDENCIES_REQUIRED/);
});
