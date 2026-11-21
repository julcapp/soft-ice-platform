'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const { AesGcmValueCodec }=require('../src/platform/security/AesGcmValueCodec');
const { createTimoPosSellerAuthRuntime }=require('../src/modules/seller_auth/createTimoPosSellerAuthRuntime');
const encryptionKey=crypto.randomBytes(32).toString('base64');
const otpSecret='test-otp-secret-longer-than-32-characters';
const limiter={async check(){return true}};
const maxClient={async sendMessage(){}};
const options={prisma:{},maxClient,otpSecret,encryptionKey,rateLimiter:limiter,allowedOrigin:'https://timopos.utimoshi.ru'};
test('runtime requires explicit durable adapters and secrets',()=>{
 assert.throws(()=>createTimoPosSellerAuthRuntime({}),/requires/);
 assert.throws(()=>createTimoPosSellerAuthRuntime({...options,encryptionKey:'invalid'}),/base64|key/i);
 assert.throws(()=>createTimoPosSellerAuthRuntime({...options,rateLimiter:null}),/requires/);
});
test('composition has secure transport and is not auto-enabled',()=>{
 const r=createTimoPosSellerAuthRuntime(options);
 assert.equal(r.allowedOrigin,options.allowedOrigin);
 assert.equal(r.allowInsecureTestTransport,false);
 assert.equal(typeof r.sellerMaxAuthService.verify,'function');
 assert.equal(typeof r.sellerMaxAuthRepository.resolveSession,'function');
});
test('MAX seller recipient ciphertext tied to precise seller identity',async()=>{
 const runtime=createTimoPosSellerAuthRuntime(options);
 const codec=new AesGcmValueCodec({key:encryptionKey});
 const value=codec.encrypt('123456789','timopos:seller:seller-1:max');
 assert.equal(await runtime.sellerMaxAuthRepository.decryptRecipient(value,'seller-1'),'123456789');
 await assert.rejects(async()=>runtime.sellerMaxAuthRepository.decryptRecipient(value,'seller-2'),{code:'ENCRYPTED_VALUE_INVALID'});
});
