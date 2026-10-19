'use strict';
const {randomUUID}=require('node:crypto');
const {CustomerBenefitService}=require('../customer_benefits/CustomerBenefitService');
const fail=(code,message,statusCode=409)=>Object.assign(new Error(message),{code,statusCode});
function verifyTopupPayment(payment,row){
 if(!payment?.id||payment.test!==true||String(payment.recipient?.account_id)!==row.shopId||payment.amount?.currency!=='RUB'||!/^[0-9]+\.[0-9]{2}$/.test(payment.amount?.value||'')||Math.round(Number(payment.amount.value)*100)!==row.amountCents||payment.metadata?.club_topup_id!==row.id||payment.metadata?.customer_id!==row.customerId||row.providerPaymentId&&row.providerPaymentId!==payment.id)throw fail('CLUB_PAYMENT_MISMATCH','Платёж требует проверки сотрудником. Повторно не оплачивайте.');
 if(payment.status==='succeeded'&&payment.paid!==true)throw fail('CLUB_PAYMENT_UNCONFIRMED','Банк не подтвердил списание.');
 return payment.status==='succeeded'?'SUCCEEDED':payment.status==='canceled'?'CANCELED':'PENDING';
}
class MiniAppClubTopupService{
 constructor({prisma,adapter,clock=()=>new Date()}){Object.assign(this,{prisma,adapter,clock});}
 request(path,options){const request=this.adapter?.request||this.adapter?._request;if(!this.adapter?.isConfigured?.()||!request)throw fail('CLUB_PAYMENT_UNAVAILABLE','Пополнение пока недоступно.',503);return request.call(this.adapter,path,options);}
 async assertTestShop(){const shop=await this.request('/me',{method:'GET'});if(shop.test!==true||shop.status!=='enabled'||String(shop.account_id)!==String(this.adapter.shopId))throw fail('CLUB_TEST_SHOP_REQUIRED','Для этой версии требуется тестовый магазин.',503);return String(shop.account_id);}
 async initiate(customerId){
  const shopId=await this.assertTestShop();
  let row=await this.prisma.$transaction(async tx=>{
   await tx.$queryRawUnsafe('SELECT 1 FROM pg_advisory_xact_lock(hashtext($1))','club-initial-topup:'+customerId);
   const existing=await tx.$queryRawUnsafe('SELECT * FROM "MiniAppClubTopupCheckout" WHERE "customerId"=$1 AND status IN (\'CREATING\',\'PENDING\',\'SUCCEEDED\') ORDER BY CASE WHEN status=\'SUCCEEDED\' THEN 0 ELSE 1 END,"createdAt" DESC LIMIT 1',customerId);
   if(existing.length)return existing[0];
   const policy=await new CustomerBenefitService({prisma:tx}).policy(),rule=policy?.rules.find(r=>r.key==='club_initial_topup');
   if(rule?.mode!=='live'||!Number.isInteger(rule.value)||rule.value<=0)throw fail('CLUB_TOPUP_RULE_INACTIVE','Правило пополнения пока не включено.');
   return (await tx.$queryRawUnsafe('INSERT INTO "MiniAppClubTopupCheckout" (id,"customerId","policyVersion","amountCents","shopId") VALUES ($1,$2,$3,$4,$5) RETURNING *',randomUUID(),customerId,policy.version,rule.value*100,shopId))[0];
  });
  if(row.shopId!==shopId)throw fail('CLUB_PAYMENT_SHOP_CHANGED','Магазин изменён. Требуется проверка платежа.');
  if(row.status==='SUCCEEDED')return this.dto(row);
  if(row.providerPaymentId){const current=await this.refresh(customerId,row.id);if(current.status!=='PENDING')return current;}
  if(this.clock()-new Date(row.createdAt)>23*3600000){if(row.providerPaymentId)return this.refresh(customerId,row.id);throw fail('CLUB_PAYMENT_RECONCILIATION_REQUIRED','Старый запрос требует проверки сотрудником. Новый платёж не создаётся.');}
  const payment=await this.request('/payments',{method:'POST',headers:{'Idempotence-Key':row.id},body:{amount:{value:(row.amountCents/100).toFixed(2),currency:'RUB'},capture:true,confirmation:{type:'embedded'},description:'Тестовое первоначальное пополнение клубного счёта «У Тимоши»',metadata:{club_topup_id:row.id,customer_id:customerId}}});
  row=await this.apply(row,payment);
  return {...this.dto(row),confirmationToken:row.status==='PENDING'?payment.confirmation?.confirmation_token:null};
 }
 async apply(row,payment){
  const status=verifyTopupPayment(payment,row);
  return this.prisma.$transaction(async tx=>{
   const [current]=await tx.$queryRawUnsafe('SELECT * FROM "MiniAppClubTopupCheckout" WHERE id=$1 FOR UPDATE',row.id);
   if(current.providerPaymentId&&current.providerPaymentId!==payment.id)throw fail('CLUB_PAYMENT_MISMATCH','Платёж требует проверки.');
   if(['SUCCEEDED','CANCELED'].includes(current.status))return current;
   const [updated]=await tx.$queryRawUnsafe('UPDATE "MiniAppClubTopupCheckout" SET "providerPaymentId"=$2,status=$3,"confirmedAt"=CASE WHEN $3=\'SUCCEEDED\' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=$1 RETURNING *',row.id,payment.id,status);
   if(status==='SUCCEEDED')await tx.customerTimelineEvent.create({data:{customerId:row.customerId,occurredAt:this.clock(),eventType:'CLUB_TEST_TOPUP_CONFIRMED',category:'PAYMENT',title:'Подтверждено тестовое пополнение',description:`${row.amountCents/100} ₽. Тестовые средства учитываются отдельно от реальных денег.`,sourceDomain:'club_account',sourceEntityType:'MiniAppClubTopupCheckout',sourceEntityId:row.id,correlationId:row.id}});
   if(status==='SUCCEEDED')await require('./TestClubTopupMessage').recordTestClubTopupMessage(tx,updated,this.clock());
   return updated;
  });
 }
 async refresh(customerId,id){const [row]=await this.prisma.$queryRawUnsafe('SELECT * FROM "MiniAppClubTopupCheckout" WHERE id=$1 AND "customerId"=$2',id,customerId);if(!row)throw fail('CLUB_TOPUP_NOT_FOUND','Пополнение не найдено.',404);if(!row.providerPaymentId)return this.dto(row);if(['SUCCEEDED','CANCELED'].includes(row.status))return this.dto(row);await this.assertTestShop();const payment=await this.request('/payments/'+encodeURIComponent(row.providerPaymentId),{method:'GET'});return this.dto(await this.apply(row,payment));}
 dto(row){return {id:row.id,status:row.status,amountRub:row.amountCents/100,test:true,confirmedAt:row.confirmedAt};}
 async reconcile(){const rows=await this.prisma.$queryRawUnsafe('SELECT id,"customerId" FROM "MiniAppClubTopupCheckout" WHERE status=\'PENDING\' AND "providerPaymentId" IS NOT NULL ORDER BY "createdAt" LIMIT 20');for(const row of rows)await this.refresh(row.customerId,row.id);}
}
module.exports={MiniAppClubTopupService,verifyTopupPayment};
