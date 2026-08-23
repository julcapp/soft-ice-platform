const test=require('node:test');
const assert=require('node:assert/strict');
const {assertPaymentTransition,money,BlockedExternalPaymentProviderAdapter,TestPaymentProviderAdapter}=require('../src/modules/payment');

test('payment money uses fixed two-decimal representation',()=>{assert.equal(money(150),'150.00');assert.equal(money('150.25'),'150.25');});
test('payment money rejects zero, negative and non-numeric amounts',()=>{for(const value of [0,-1,'bad',null])assert.throws(()=>money(value),{code:'PAYMENT_AMOUNT_INVALID'});});
test('state machine permits CREATED -> PENDING -> SUCCEEDED',()=>{assert.doesNotThrow(()=>assertPaymentTransition('CREATED','PENDING'));assert.doesNotThrow(()=>assertPaymentTransition('PENDING','SUCCEEDED'));});
test('state machine rejects SUCCEEDED -> FAILED',()=>assert.throws(()=>assertPaymentTransition('SUCCEEDED','FAILED'),{code:'PAYMENT_TRANSITION_INVALID'}));
test('state machine rejects terminal replay',()=>assert.throws(()=>assertPaymentTransition('REFUNDED','REFUNDED'),{code:'PAYMENT_TRANSITION_INVALID'}));
test('production provider remains BLOCKED_EXTERNAL',async()=>{const adapter=new BlockedExternalPaymentProviderAdapter();await assert.rejects(async()=>adapter.createPayment({}),{code:'PAYMENT_PROVIDER_BLOCKED_EXTERNAL'});await assert.rejects(async()=>adapter.verifyWebhookSignature({}),{code:'PAYMENT_WEBHOOK_SIGNATURE_BLOCKED_EXTERNAL'});});
test('test provider is deterministic and test-only',async()=>{const adapter=new TestPaymentProviderAdapter();const created=await adapter.createPayment({paymentId:'p1',amount:'10.00',currency:'RUB'});assert.equal(created.status,'PENDING');assert.equal((await adapter.getPaymentStatus(created.providerPaymentId)).amount,'10.00');assert.equal(adapter.implementationKind,'TEST_ONLY');});
