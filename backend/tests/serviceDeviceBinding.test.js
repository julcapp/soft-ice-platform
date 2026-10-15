const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { ServiceDeviceBinding, deviceInput } = require('../src/modules/operator_workspace/ServiceDeviceBinding');
const pair = () => crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const metadata = (key) => ({manufacturer:'Samsung',model:'Galaxy A55',androidVersion:'15',appVersion:'1.0',publicKey:key.export({type:'spki',format:'pem'})});
test('модель не заменяет уникальный ключ устройства', () => {
  const a = deviceInput(metadata(pair().publicKey)), b = deviceInput(metadata(pair().publicKey));
  assert.equal(a.model,b.model); assert.notEqual(a.keyFingerprint,b.keyFingerprint);
  assert.throws(()=>deviceInput({...metadata(pair().publicKey),publicKey:'invalid'}),{statusCode:422});
});
test('подпись другого смартфона, повтор, отзыв и истечение срока отклоняются', async () => {
  const own=pair(),other=pair(),now=new Date('2026-10-06T06:00:00Z'),id=crypto.randomUUID(),nonce='random-test-nonce';
  const row={bindingId:crypto.randomUUID(),memberId:'member',publicKey:metadata(own.publicKey).publicKey,nonceHash:crypto.createHash('sha256').update(nonce).digest('hex'),expiresAt:new Date(now.getTime()+60000)};
  const tx={$queryRawUnsafe:async()=>[row],$executeRawUnsafe:async()=>{row.consumedAt=now;}};
  const service=new ServiceDeviceBinding({prisma:{$transaction:async(fn)=>fn(tx)},clock:()=>now});
  const input=(key)=>({challengeId:id,nonce,signature:crypto.sign('sha256',Buffer.from(`softice-service-device-v1\n${id}\n${nonce}`),key).toString('base64')});
  await assert.rejects(service.verify('member',input(other.privateKey)),{code:'SERVICE_DEVICE_PROOF_INVALID'});
  await assert.rejects(service.verify('other-member',input(own.privateKey)),{statusCode:403});
  assert.equal((await service.verify('member',input(own.privateKey))).bindingId,row.bindingId);
  await assert.rejects(service.verify('member',input(own.privateKey)),{statusCode:403});
  row.consumedAt=null; row.revokedAt=now;
  await assert.rejects(service.verify('member',input(own.privateKey)),{statusCode:403});
  row.revokedAt=null; row.expiresAt=now;
  await assert.rejects(service.verify('member',input(own.privateKey)),{statusCode:403});
});
test('конфликт второго активного смартфона не заменяет привязку автоматически',async()=>{
  const tx={$queryRawUnsafe:async()=>[{id:'member',organizationId:'org'}],$executeRawUnsafe:async()=>{throw {code:'P2002'};}};
  const service=new ServiceDeviceBinding({prisma:{$transaction:async fn=>fn(tx)}});service.access.scope=async()=>null;
  await assert.rejects(service.register('member',metadata(pair().publicKey),{subject_id:crypto.randomUUID()}),{statusCode:409,code:'SERVICE_DEVICE_ALREADY_BOUND'});
});
