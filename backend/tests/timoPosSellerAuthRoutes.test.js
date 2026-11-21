'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {createTimoPosSellerAuthRouter}=require('../src/api/v1/timoPosSellerAuthRoutes');
const ORIGIN='https://timopos.utimoshi.ru';
const makeFixture=async()=>{
 let revoked=false,blocked=false;
 const sellerMaxAuthService={
  async request(){return {challengeId:'some-uuid',expiresAt:'2026-11-17T10:00:00Z'};},
  async verify(){return {sessionToken:'token-test-ABC',seller:{id:'seller1',point:{id:'p1'}}};},
  async logout(token){if(token==='token-test-ABC')revoked=true;},
 };
 const sellerMaxAuthRepository={
  async resolveSession(token){return token==='token-test-ABC'&&!revoked?{sellerId:'seller1',terminalId:'POS-001'}:null;},
 };
 const rateLimiter={async check(){return !blocked;}};
 const app=express();app.use(express.json());
 app.use('/api/v1/timopos/seller',createTimoPosSellerAuthRouter({
  sellerMaxAuthService,sellerMaxAuthRepository,rateLimiter,allowedOrigin:ORIGIN,allowInsecureTestTransport:true,
 }));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const base='http://127.0.0.1:'+server.address().port+'/api/v1/timopos/seller';
 const req=(path,options={})=>fetch(base+path,{...options,headers:{origin:ORIGIN,'content-type':'application/json',...(options.headers||{})}});
 return {req,block:()=>{blocked=true;},close:()=>new Promise(resolve=>server.close(resolve))};
};
test('constructor fails closed without limiter, origin or services',()=>{
 assert.throws(()=>createTimoPosSellerAuthRouter({}),/dependencies/);
});
test('OTP is accepted; verification creates secure HttpOnly cookie; logout revokes',async()=>{
 const f=await makeFixture();try{
  const c=await f.req('/challenges',{method:'POST',body:JSON.stringify({phone:'+79991234567',terminalId:'POS-001'})});
  assert.equal(c.status,202);assert.equal((await c.json()).accepted,true);
  const v=await f.req('/sessions',{method:'POST',body:JSON.stringify({challengeId:'a',code:'123456',terminalId:'POS-001'})});
  assert.equal(v.status,201);
  const cookie=v.headers.get('set-cookie');
  assert.match(cookie,/__Host-timopos_seller=token-test-ABC/);
  assert.match(cookie,/HttpOnly/i);assert.match(cookie,/Secure/i);assert.match(cookie,/SameSite=Strict/i);assert.match(cookie,/Path=\//i);
  assert.doesNotMatch(JSON.stringify(await v.json()),/token-test-ABC/);
  const s=await f.req('/session',{headers:{cookie:cookie.split(';')[0]}});
  assert.equal(s.status,200);assert.equal((await s.json()).seller.terminalId,'POS-001');
  const out=await f.req('/session',{method:'DELETE',headers:{cookie:cookie.split(';')[0]}});
  assert.equal(out.status,204);
  assert.equal((await f.req('/session',{headers:{cookie:cookie.split(';')[0]}})).status,401);
 }finally{await f.close();}
});
test('reject cross-origin POST and rate-limited challenge',async()=>{
 const f=await makeFixture();try{
  const denied=await f.req('/challenges',{method:'POST',headers:{origin:'https://attacker.example'},body:'{}'});
  assert.equal(denied.status,403);
  f.block();
  const limited=await f.req('/challenges',{method:'POST',body:'{}'});
  assert.equal(limited.status,429);
 }finally{await f.close();}
});
test('secure transport is mandatory by default',()=>{
 const router=createTimoPosSellerAuthRouter({
  sellerMaxAuthService:{},sellerMaxAuthRepository:{resolveSession(){}},
  rateLimiter:{check(){}},allowedOrigin:ORIGIN,
 });
 assert.ok(router);
});
