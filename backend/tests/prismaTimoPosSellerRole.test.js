'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {PrismaSellerMaxAuthRepository}=require('../src/modules/seller_auth/PrismaSellerMaxAuthRepository');
const {tokenHash}=require('../src/modules/seller_auth/SellerMaxAuthService');
const secret='test-otp-secret-longer-than-32-characters';
function fixture(role='OPERATOR'){
 const observed=[];
 const p={
  timoPosTerminal:{findUnique:async args=>{observed.push(['terminal',args]);return {active:true,pointId:'point1'};}},
  organizationMember:{findUnique:async()=>({id:'seller1',status:'ACTIVE',organizationId:'org1',phone:'+79991234567'})},
  organizationLocation:{findUnique:async()=>({id:'point1',status:'ACTIVE',organizationId:'org1'})},
  timoPosSellerPoint:{findUnique:async()=>({active:true})},
  organizationRoleAssignment:{findFirst:async args=>{observed.push(['role',args]);return role==='OPERATOR'?{organizationId:'org1'}:null;}},
  timoPosMaxIdentity:{findUnique:async()=>({verifiedAt:new Date(),recipientCiphertext:'encrypted',verifiedPhoneHash:tokenHash(secret,'seller-phone','+79991234567')})},
 };
 const r=new PrismaSellerMaxAuthRepository({prisma:p,secret,decryptRecipient:async()=> '123456789'});
 return {r,p,observed};
}
test('seller checks valid OPERATOR enum and point assignment',async()=>{
 const f=fixture();
 const result=await f.r.sellerForPoint(f.p,{sellerId:'seller1',pointId:'point1',terminalId:'POS-001'});
 assert.ok(result);
 assert.equal(f.observed.find(([kind])=>kind==='role')[1].where.role,'OPERATOR');
});
test('seller without approved organization operator role is denied',async()=>{
 const f=fixture('OTHER');
 assert.equal(await f.r.sellerForPoint(f.p,{sellerId:'seller1',pointId:'point1',terminalId:'POS-001'}),null);
});
