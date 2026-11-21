'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { SellerMaxAuthService, OTP_TTL_MS, normalizeSellerPhone } = require('../src/modules/seller_auth/SellerMaxAuthService');

function fixture() {
  let now = new Date('2026-11-14T10:00:00Z');
  let row = null, messages = [], sessions = [], known = true, allowed = true;
  const repository = {
    async resolveSellerWithVerifiedMax({phone,terminalId}) {
      return known && allowed && phone === '+79991234567' && terminalId === 'POS-001'
        ? {sellerId:'seller-1',pointId:'point-1',maxRecipientId:'max-verified-1'} : null;
    },
    async createChallenge(x) { row = {...x, status:'PENDING', attempts:0}; },
    async markSent(id) { assert.equal(row.id,id); row.status='SENT'; },
    async invalidate(id) { if(row?.id===id)row.status='INVALIDATED'; },
    async consumeChallenge({challengeId,codeHash,terminalId,at,sessionHash}) {
      if(!row || row.id!==challengeId || row.status!=='SENT' || row.terminalId!==terminalId || row.expiresAt<=at || row.attempts>=row.maxAttempts || !allowed)return null;
      row.attempts++;
      if(row.codeHash!==codeHash)return null;
      row.status='CONSUMED';sessions.push(sessionHash);
      return {sellerId:'seller-1',fullName:'Иванов Иван Иванович',maskedPhone:'+7 999 ***-**-67',point:{id:'point-1',code:'001'},role:'SELLER'};
    },
    async revokeSession(hash) {sessions=sessions.filter(s=>s!==hash);},
  };
  const sender={async sendPrivateMessage(message){messages.push(message);}};
  const service=new SellerMaxAuthService({repository,maxSender:sender,secret:'test-secret-should-be-at-least-32-bytes-long',clock:()=>now,randomInt:()=>246810});
  return {service,messages,clock:(v)=>{now=new Date(v)},setKnown:(v)=>{known=v},setAllowed:(v)=>{allowed=v},sender,getRow:()=>row,getSessions:()=>sessions};
}

test('phone normalization',()=>{
  assert.equal(normalizeSellerPhone('8 (999) 123-45-67'),'+79991234567');
  assert.equal(normalizeSellerPhone('+7 999 123 45 67'),'+79991234567');
  assert.equal(normalizeSellerPhone('123'),null);
});
test('MAX OTP 5 minutes, successful session, single use',async()=>{
  const f=fixture();
  const reply=await f.service.request({phone:'8 999 123-45-67',terminalId:'POS-001'});
  assert.equal(reply.accepted,true); assert.equal(new Date(reply.expiresAt).getTime()-new Date('2026-11-14T10:00:00Z').getTime(),OTP_TTL_MS);
  assert.equal(f.messages.length,1); assert.match(f.messages[0].text,/246810/);
  assert.doesNotMatch(JSON.stringify(reply),/246810/);
  const result=await f.service.verify({challengeId:reply.challengeId,code:'246810',terminalId:'POS-001'});
  assert.equal(result.seller.fullName,'Иванов Иван Иванович');
  assert.ok(result.sessionToken);assert.equal(f.getSessions().length,1);
  await assert.rejects(f.service.verify({challengeId:reply.challengeId,code:'246810',terminalId:'POS-001'}),{code:'INVALID_OR_EXPIRED_CODE'});
  await f.service.logout(result.sessionToken);assert.equal(f.getSessions().length,0);
});
test('unknown seller gives generic response and no message',async()=>{
  const f=fixture();f.setKnown(false);
  const result=await f.service.request({phone:'+79991234567',terminalId:'POS-001'});
  assert.equal(result.accepted,true);assert.match(result.challengeId,/^[\da-f-]{36}$/i);assert.equal(f.messages.length,0);
});
test('expired OTP is rejected',async()=>{
  const f=fixture();const c=await f.service.request({phone:'+79991234567',terminalId:'POS-001'});
  f.clock('2026-11-14T10:05:00Z');
  await assert.rejects(f.service.verify({challengeId:c.challengeId,code:'246810',terminalId:'POS-001'}),{code:'INVALID_OR_EXPIRED_CODE'});
});
test('wrong terminal, wrong OTP and revoked assignment fail',async()=>{
  const f=fixture();const c=await f.service.request({phone:'+79991234567',terminalId:'POS-001'});
  await assert.rejects(f.service.verify({challengeId:c.challengeId,code:'246810',terminalId:'POS-002'}),{code:'INVALID_OR_EXPIRED_CODE'});
  await assert.rejects(f.service.verify({challengeId:c.challengeId,code:'111111',terminalId:'POS-001'}),{code:'INVALID_OR_EXPIRED_CODE'});
  f.setAllowed(false);await assert.rejects(f.service.verify({challengeId:c.challengeId,code:'246810',terminalId:'POS-001'}),{code:'INVALID_OR_EXPIRED_CODE'});
});
test('MAX delivery failure invalidates challenge, no OTP in response',async()=>{
  const f=fixture();f.sender.sendPrivateMessage=async()=>{throw Error('network secret 246810')};
  const c=await f.service.request({phone:'+79991234567',terminalId:'POS-001'});
  assert.match(c.challengeId,/^[\da-f-]{36}$/i);assert.equal(f.getRow().status,'INVALIDATED');
  assert.doesNotMatch(JSON.stringify(c),/246810|network secret/);
});
test('fails closed without strong secret',()=>{assert.throws(()=>new SellerMaxAuthService({repository:{},maxSender:{sendPrivateMessage(){}},secret:'weak'}),/secret/);});
