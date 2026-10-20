'use strict';
const { randomUUID } = require('node:crypto');
const { SberQrTransport, fail } = require('./SberQrTransport');
function dynamicSbpUrl(value) {
  let u;try{u=new URL(value);}catch{throw fail('SBER_QR_LINK_INVALID','Банк не выдал ссылку СБП.');}
  if(u.protocol!=='https:'||u.hostname!=='qr.nspk.ru'||u.username||u.password||u.port||u.searchParams.get('type')!=='02')throw fail('SBER_QR_LINK_INVALID','Нужен динамический QR-код СБП для заказа.');
  return u.href;
}
class SberQrPaymentAdapter {
  constructor({ prisma, env=process.env, transport, clock=()=>new Date() }={}) { Object.assign(this,{prisma,env,clock});this.transport=transport||new SberQrTransport({env});this.provider='SBER_SBP'; }
  isConfigured() { return this.env.SBER_QR_ENABLED==='true' && this.env.SBER_QR_CONTRACT_VERIFIED==='true' && ['SBER_QR_MEMBER_ID','SBER_QR_MERCHANT_ID','SBER_QR_TID','SBER_QR_ID_QR','SBER_QR_ALLOWED_MACHINE_IDS'].every(k=>Boolean(this.env[k])) && this.transport.isConfigured() && Boolean(this.prisma); }
  assertReady(machineId) {
    if(!this.isConfigured()||!String(this.env.SBER_QR_ALLOWED_MACHINE_IDS).split(',').map(s=>s.trim()).includes(machineId))throw fail('SBER_QR_NOT_CONFIGURED','СБП от Сбербанка пока подключается.');
  }
  capability(machineId) { let available=true;try{this.assertReady(machineId);}catch{available=false;}return {id:'sber_sbp',provider:'SBER_SBP',title:'СБП от Сбербанка',available,reasonCode:available?null:'SBER_QR_NOT_CONFIGURED',bankSelection:'NSPK_LINK'}; }
  stamp() { return {rq_uid:randomUUID().replaceAll('-',''),rq_tm:this.clock().toISOString().replace(/\.\d{3}Z$/,'Z')}; }
  async createPayment(request) {
    if(!this.isConfigured())throw fail('SBER_QR_NOT_CONFIGURED','СБП от Сбербанка пока подключается.');
    const order=await this.prisma.order.findUnique({where:{id:request.orderId}});
    if(!order)throw fail('SBER_QR_ORDER_MISSING','Заказ не найден.');this.assertReady(order.machineId);
    const cents=Math.round(Number(order.amount)*100);
    if(order.currency!=='RUB'||request.currency!=='RUB'||!Number.isSafeInteger(cents)||cents<=0||Math.abs(Number(order.amount)*100-cents)>0.00001||Math.abs(Number(request.amount)*100-cents)>0.00001||!request.idempotencyKey||!request.paymentId)throw fail('SBER_QR_AMOUNT_INVALID','Сумма заказа не подтверждена.');
    const body={...this.stamp(),member_id:this.env.SBER_QR_MEMBER_ID,order_number:order.id,order_create_date:this.clock().toISOString().replace(/\.\d{3}Z$/,'Z'),id_qr:this.env.SBER_QR_ID_QR,order_sum:cents,currency:'643',description:'Заказ «У Тимоши»'};
    const claimed=await this.prisma.$queryRawUnsafe(`UPDATE "Payment" SET metadata=COALESCE(metadata,'{}'::jsonb)||jsonb_build_object('sberCreateRqUid',$1::text),"updatedAt"=NOW() WHERE id=$2 AND "orderId"=$3 AND provider='SBER_SBP' AND status IN ('CREATED','PENDING') AND "providerPaymentId" IS NULL AND NOT (COALESCE(metadata,'{}'::jsonb) ? 'sberCreateRqUid') RETURNING id`,body.rq_uid,request.paymentId,order.id);
    if(claimed.length!==1)throw fail('SBER_QR_CREATE_RECONCILIATION_REQUIRED','Результат создания этого платежа требует проверки. Повторная оплата не нужна.');
    // The common checkout persists its intent/idempotency key BEFORE this call. Never retry creation here.
    const reply=await this.transport.request('creation',body);
    if(reply.error_code!=='000000'||!reply.order_id||reply.order_number!==order.id)throw fail('SBER_QR_CREATE_UNCONFIRMED','Банк не подтвердил создание заказа.');
    const confirmationUrl=dynamicSbpUrl(reply.order_form_url);
    const u=new URL(confirmationUrl);if(u.searchParams.has('sum')&&u.searchParams.get('sum')!==String(cents))throw fail('SBER_QR_AMOUNT_MISMATCH','Сумма QR-кода не совпадает с заказом.');
    return {providerPaymentId:reply.order_id,status:'PENDING',paid:false,amount:Number(order.amount).toFixed(2),currency:'RUB',confirmationUrl,rawStatus:reply.order_state,metadata:{...request.metadata,order_id:order.id,payment_id:request.paymentId}};
  }
  async getPaymentStatus(providerPaymentId) {
    if(!this.isConfigured())throw fail('SBER_QR_NOT_CONFIGURED','СБП от Сбербанка пока подключается.');
    const p=await this.prisma.payment.findFirst({where:{provider:'SBER_SBP',providerPaymentId},include:{order:true}});
    if(!p||!p.order)throw fail('SBER_QR_PAYMENT_MISSING','Платёж не найден.');this.assertReady(p.order.machineId);
    const r=await this.transport.request('status',{...this.stamp(),order_id:providerPaymentId,tid:this.env.SBER_QR_TID,partner_order_number:p.orderId});
    if(r.error_code!=='000000'||r.order_id!==providerPaymentId||r.mid!==this.env.SBER_QR_MERCHANT_ID||r.tid!==this.env.SBER_QR_TID||r.id_qr!==this.env.SBER_QR_ID_QR)throw fail('SBER_QR_PAYMENT_MISMATCH','Принадлежность платежа не подтверждена банком.');
    const ops=r.order_operation_params;
    const operations=Array.isArray(ops)?ops:Array.isArray(ops?.items)?ops.items:ops?.operation_id?[ops]:[];
    const paid=operations.filter(x=>x.operation_type==='PAY'&&x.response_code==='00');
    const cents=Math.round(Number(p.amount)*100);
    if(r.order_state==='PAID'&&(paid.length!==1||paid[0].operation_sum!==cents||paid[0].operation_currency!=='643'||!paid[0].operation_id||operations.some(x=>['REFUND','REVERSE'].includes(x.operation_type)&&x.response_code==='00')))throw fail('SBER_QR_PAYMENT_MISMATCH','Сумма или результат оплаты требуют проверки.');
    const status=r.order_state==='PAID'?'SUCCEEDED':r.order_state==='REVOKED'?'CANCELED':r.order_state==='DECLINED'?'FAILED':'PENDING';
    return {providerPaymentId,status,paid:status==='SUCCEEDED',amount:Number(p.amount).toFixed(2),currency:'RUB',rawStatus:r.order_state,metadata:{...p.metadata,order_id:p.orderId,payment_id:p.id}};
  }
  async refundPayment() { throw fail('SBER_QR_REFUND_NOT_CONFIGURED','Возврат через Сбербанк требует отдельной проверки банковского договора.'); }
  async getRefund() { throw fail('SBER_QR_REFUND_NOT_CONFIGURED','Статус возврата через Сбербанк пока не подключён.'); }
}
module.exports={SberQrPaymentAdapter,dynamicSbpUrl};
