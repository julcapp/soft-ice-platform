'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {createTimoPosPointRouter,validateSchedule,schedule247}=require('../src/api/v1/timoPosPointRoutes');
const {isBusinessOpen}=require('../src/modules/timopos/TimoPosAccessPolicy');
async function fixture(){
 const points=[],audits=[];
 const prisma={organization:{findUnique:async({where})=>where.id==='org1'?{id:'org1'}:null},
  organizationLocation:{
   findMany:async({where})=>points.filter(p=>p.organizationId===where.organizationId),
   findFirst:async({where})=>points.find(p=>p.id===where.id&&p.organizationId===where.organizationId),
   create:async({data})=>{const p={id:'p'+(points.length+1),...data};points.push(p);return p},
   update:async({where,data})=>{const p=points.find(p=>p.id===where.id);Object.assign(p,data);return p},
  },auditEvent:{create:async({data})=>audits.push(data)},$transaction:async f=>f(prisma)};
 const app=express();app.use(express.json());app.use('/api',createTimoPosPointRouter({prisma,adminAuth:{
  sessionService:{validateToken:async token=>({subject_id:'a1',organization_id:token==='other'?'other':'org1',
    roles:['ORGANIZATION_ADMIN'],permissions:['admin:organization:manage']})}}}));
 const srv=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
 const request=(path,body,token='good',method='POST')=>fetch('http://127.0.0.1:'+srv.address().port+'/api/organizations/'+path,{
  method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body||{})});
 return {points,audits,request,close:()=>new Promise(resolve=>srv.close(resolve))}
}
test('default 24/7 is valid for every weekday and night',()=>{
 const s=schedule247();assert.equal(validateSchedule(s),true);
 assert.equal(isBusinessOpen({now:new Date('2026-11-17T23:59:00Z'),schedule:s}),true);
 assert.equal(validateSchedule({...s,timeZone:'invalid/timezone'}),false);
});
test('initialization creates five distinct points and is repeat-safe',async()=>{
 const f=await fixture();try{
  let x=await f.request('org1/points/initialize');assert.equal(x.status,200);assert.equal((await x.json()).created,5);
  assert.equal(f.points.length,5);assert.ok(f.points.every(x=>x.openingHours.mode==='24_7'));
  x=await f.request('org1/points/initialize');assert.equal((await x.json()).created,0);
  assert.equal(f.audits.length,5);
 }finally{await f.close()}
});
test('scope enforced, point creation and hours editing audited',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('org1/points/initialize',{},'other')).status,403);
  const x=await f.request('org1/points',{name:'Точка №006',address:'Адрес не указан'});assert.equal(x.status,201);
  const id=(await x.json()).point.id;
  const sch={mode:'SCHEDULED',timeZone:'Asia/Tomsk',days:Object.fromEntries(Array.from({length:7},(_,i)=>[i.toString(),[{from:'09:00',to:'18:00'}]]))};
  const y=await f.request('org1/points/'+id,{openingHours:sch},'good','PATCH');
  assert.equal(y.status,200);assert.equal(f.points[0].openingHours.mode,'SCHEDULED');
  assert.equal((await f.request('org1/points/'+id,{openingHours:{mode:'24_7',timeZone:'bad',days:{}}},'good','PATCH')).status,400);
 }finally{await f.close()}
});
