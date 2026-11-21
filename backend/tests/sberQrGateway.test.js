'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {SberQrPaymentAdapter,dynamicSbpUrl}=require('../src/modules/payment/sber/SberQrPaymentAdapter');
const {SberQrTransport}=require('../src/modules/payment/sber/SberQrTransport');
function fixture(){
 const env={SBER_QR_ENABLED:'true',SBER_QR_CONTRACT_VERIFIED:'true',SBER_QR_MEMBER_ID:'member',SBER_QR_MERCHANT_ID:'merchant',SBER_QR_TID:'terminal',SBER_QR_ID_QR:'device',SBER_QR_ALLOWED_MACHINE_IDS:'M1'};
 const order={id:'12345678-1234-1234-1234-123456789abc',machineId:'M1',amount:7,currency:'RUB'};
 const payment={id:'p',orderId:order.id,order,amount:7,metadata:{order_id:order.id,payment_id:'p'}};
 const reply={error_code:'000000',order_id:'bank-order',order_number:order.id,order_state:'PAID',mid:'merchant',tid:'terminal',id_qr:'device',order_form_url:'https://qr.nspk.ru/example?type=02&sum=700',order_operation_params:[{operation_id:'op',operation_type:'PAY',operation_sum:700,operation_currency:'643',response_code:'00'}]};
 const calls=[];const transport={isConfigured:()=>true,request:async(op,body)=>{calls.push({op,body});return reply;}};
 let claimed=false;const adapter=new SberQrPaymentAdapter({env,prisma:{$queryRawUnsafe:async()=>{if(claimed)return [];claimed=true;return [{id:'p'}];},order:{findUnique:async()=>order},payment:{findFirst:async()=>payment}},transport});
 return {adapter,env,order,payment,reply,calls};
}
test('disabled adapter never accesses bank or database',async()=>{const a=new SberQrPaymentAdapter({env:{}});assert.equal(a.capability('M1').available,false);await assert.rejects(()=>a.createPayment({}),{code:'SBER_QR_NOT_CONFIGURED'});});
test('create uses server amount in kopecks; even PAID create reply remains pending',async()=>{const f=fixture();const r=await f.adapter.createPayment({orderId:f.order.id,amount:7,currency:'RUB',paymentId:'p',idempotencyKey:'key'});assert.equal(f.calls[0].body.order_sum,700);assert.equal(f.calls[0].body.currency,'643');assert.match(f.calls[0].body.rq_uid,/^[a-f0-9]{32}$/);assert.equal(r.status,'PENDING');assert.equal(r.paid,false);});
test('wrong amount and machine are blocked before bank request',async()=>{const f=fixture();await assert.rejects(()=>f.adapter.createPayment({orderId:f.order.id,amount:8,currency:'RUB',paymentId:'p',idempotencyKey:'key'}));assert.equal(f.calls.length,0);assert.equal(f.adapter.capability('OTHER').available,false);});
test('only matched successful PAY from status is succeeded',async()=>{const f=fixture();const r=await f.adapter.getPaymentStatus('bank-order');assert.equal(r.status,'SUCCEEDED');assert.equal(r.paid,true);assert.equal(r.metadata.order_id,f.order.id);});
test('wrong amount, terminal, merchant, currency, missing PAY, duplicate PAY fail closed',async()=>{for(const mutate of [r=>r.order_operation_params[0].operation_sum=701,r=>r.tid='other',r=>r.mid='other',r=>r.order_operation_params[0].operation_currency='840',r=>r.order_operation_params=[],r=>r.order_operation_params.push({...r.order_operation_params[0]})]){const f=fixture();mutate(f.reply);await assert.rejects(()=>f.adapter.getPaymentStatus('bank-order'),{code:'SBER_QR_PAYMENT_MISMATCH'});}});
test('created status does not confirm payment and refunds are blocked',async()=>{const f=fixture();f.reply.order_state='CREATED';assert.equal((await f.adapter.getPaymentStatus('bank-order')).status,'PENDING');await assert.rejects(()=>f.adapter.refundPayment(),{code:'SBER_QR_REFUND_NOT_CONFIGURED'});});
test('static QR, wrong host, credentials and non-HTTPS links are rejected',()=>{for(const url of ['https://qr.nspk.ru/x?type=01','https://evil.test/x?type=02','https://u:p@qr.nspk.ru/x?type=02','http://qr.nspk.ru/x?type=02'])assert.throws(()=>dynamicSbpUrl(url));});
test('unknown result is not retried on create',async()=>{const f=fixture();let n=0;f.adapter.transport.request=async()=>{n++;throw Error('timeout');};await assert.rejects(()=>f.adapter.createPayment({orderId:f.order.id,amount:7,currency:'RUB',paymentId:'p',idempotencyKey:'key'}));assert.equal(n,1);});
test('transport requires credentials before making any network request',async()=>{let called=false;const t=new SberQrTransport({env:{},requestImpl:()=>{called=true;}});await assert.rejects(()=>t.request('creation',{}));assert.equal(called,false);});

test('second create after unknown result is blocked before bank',async()=>{const f=fixture();let n=0;f.adapter.transport.request=async()=>{n++;throw Error('timeout');};const req={orderId:f.order.id,amount:7,currency:'RUB',paymentId:'p',idempotencyKey:'key'};await assert.rejects(()=>f.adapter.createPayment(req));await assert.rejects(()=>f.adapter.createPayment(req),{code:'SBER_QR_CREATE_RECONCILIATION_REQUIRED'});assert.equal(n,1);});
