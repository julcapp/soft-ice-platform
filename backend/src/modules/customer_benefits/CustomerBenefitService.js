'use strict';
const {randomUUID}=require('node:crypto');
const {INITIAL_RULES,validateRules,calculatePurchase,problem}=require('./BenefitRules');
const REASONS={NO_PAID_AMOUNT:'Нет оплаченной суммы',CURRENCY_UNSUPPORTED:'Валюта не поддерживается правилами',ORDER_NOT_COMPLETED:'Заказ не завершён',PAYMENT_NOT_SUCCEEDED:'Нет подтверждённой оплаты',DISPENSE_NOT_CONFIRMED:'Нет подтверждённой выдачи',REFUND_EXISTS:'Есть возврат',PREPAID_EXCLUDED:'Предоплата: без бонусов',GIFT_EXCLUDED:'Переданный подарок: без бонусов',CUSTOMER_NOT_VERIFIED:'Клиент не подтверждён',TEST_PAYMENT:'Тестовый платёж/аппарат',PAYMENT_MODE_UNKNOWN:'Режим платежа не подтверждён',BEFORE_POLICY:'Завершён до включения версии',DEMO:'Demo: только расчёт',OFF:'Правило выключено',ZERO:'После округления 0',READY:'Готово к начислению',ALREADY_POSTED:'Уже начислено'};
const INCLUDE={payment:{include:{refunds:true}},paymentAttempts:true,machineDispenseAttempts:true,customer:{select:{id:true,phoneVerifiedAt:true,status:true}}};
function orderReason(order,{gift=false,flow=null}={}){
  if(order.status!=='COMPLETED')return 'ORDER_NOT_COMPLETED';
  if(order.payment?.status!=='SUCCEEDED')return 'PAYMENT_NOT_SUCCEEDED';
  if(order.currency!=='RUB'||order.payment.currency!=='RUB')return 'CURRENCY_UNSUPPORTED';
  if(!(Number(order.payment.amount)>0))return 'NO_PAID_AMOUNT';
  if(order.payment.refunds?.length)return 'REFUND_EXISTS';
  if(!order.machineDispenseAttempts?.some(a=>a.status==='DISPENSED'&&a.completedAt))return 'DISPENSE_NOT_CONFIRMED';
  if(gift)return 'GIFT_EXCLUDED';
  if(flow?.metadata?.fulfillmentMode==='PICKUP'||order.payment.metadata?.fulfillmentMode==='PICKUP')return 'PREPAID_EXCLUDED';
  if(!order.customer?.phoneVerifiedAt||order.customer.status!=='active')return 'CUSTOMER_NOT_VERIFIED';
  const provider=order.paymentAttempts?.find(p=>p.status==='SUCCEEDED')?.metadata?.provider;
  if(/^TEST[-_]/i.test(order.machineId||'')||provider?.test===true||order.payment.metadata?.test===true)return 'TEST_PAYMENT';
  if(provider?.test!==false&&order.payment.metadata?.test!==false)return 'PAYMENT_MODE_UNKNOWN';
  return null;
}
class CustomerBenefitService{
 constructor({prisma}){this.prisma=prisma;}
 async versions(tx=this.prisma){return tx.$queryRawUnsafe('SELECT * FROM "CustomerBenefitPolicyVersion" ORDER BY "version" DESC LIMIT 30');}
 async read(){const versions=await this.versions();return {current:versions[0]?{...versions[0],rules:[...versions[0].rules,...INITIAL_RULES.filter(def=>!versions[0].rules.some(row=>row.key===def.key))]}:{version:0,status:'DRAFT',rules:INITIAL_RULES},versions,active:await this.policy(),reasons:REASONS,engine:'future_completed_orders',historicalPostingEnabled:false};}
 async initialize(actorId='system'){return this.prisma.$transaction(async tx=>{await tx.$queryRawUnsafe("SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('customer-benefit-policy'))");const rows=await this.versions(tx);if(rows.length)return rows[0];return (await tx.$queryRawUnsafe('INSERT INTO "CustomerBenefitPolicyVersion" ("rules","status","actorId","reason") VALUES ($1::jsonb,\'DRAFT\',$2,$3) RETURNING *',JSON.stringify(INITIAL_RULES),actorId,'Первичная версия из аудита 15.10.2026; demo не включено'))[0];});}
 async save({baseVersion,rules,reason,actorId}){
  const checked=validateRules(rules);if(!String(reason||'').trim())throw problem('BENEFIT_REASON_REQUIRED','Укажите причину изменения.');
  return this.prisma.$transaction(async tx=>{await tx.$queryRawUnsafe("SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('customer-benefit-policy'))");const rows=await this.versions(tx);if(Number(baseVersion)!==Number(rows[0]?.version||0))throw problem('BENEFIT_VERSION_CONFLICT','Условия изменены другим администратором. Обновите страницу.',409);
   return (await tx.$queryRawUnsafe('INSERT INTO "CustomerBenefitPolicyVersion" ("rules","status","actorId","reason") VALUES ($1::jsonb,\'DRAFT\',$2,$3) RETURNING *',JSON.stringify(checked),actorId,String(reason).slice(0,1000)))[0];});
 }
 async activate({version,reason,actorId}){if(!String(reason||'').trim())throw problem('BENEFIT_REASON_REQUIRED','Укажите основание включения.');return this.prisma.$transaction(async tx=>{await tx.$queryRawUnsafe("SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('customer-benefit-policy'))");const rows=await this.versions(tx),draft=rows[0];if(!draft||draft.version!==Number(version)||draft.status!=='DRAFT')throw problem('BENEFIT_VERSION_CONFLICT','Нужна последняя сохранённая черновая версия.',409);validateRules(draft.rules);if(!draft.rules.some(r=>r.mode==='live')&&!await this.policy(tx))throw problem('BENEFIT_NO_LIVE_RULES','В версии нет боевых правил.');return (await tx.$queryRawUnsafe('INSERT INTO "CustomerBenefitPolicyVersion" ("rules","status","actorId","reason") VALUES ($1::jsonb,\'LIVE\',$2,$3) RETURNING *',JSON.stringify(draft.rules),actorId,String(reason).slice(0,1000)))[0];});}
 async policy(tx=this.prisma){return (await tx.$queryRawUnsafe('SELECT * FROM "CustomerBenefitPolicyVersion" WHERE "status"=\'LIVE\' ORDER BY "version" DESC LIMIT 1'))[0]||null;}
 async evaluate(tx,order,policy,{historical=false,simulation=null}={}){
  const [flow,gift]=await Promise.all([tx.saleFlow.findUnique({where:{orderId:order.id},select:{metadata:true,completedAt:true}}),tx.giftTransfer.findFirst({where:{originalOrderId:order.id},select:{id:true}})]);
  let reason=orderReason(order,{flow,gift:Boolean(gift)});
  if(!historical&&!reason&&new Date(flow?.completedAt||order.updatedAt)<new Date(policy.createdAt))reason='BEFORE_POLICY';
  const rule=key=>policy.rules.find(r=>r.key===key);
  const entries=[];
  const add=(key,customerId,amountBonus,operationKey,referralId=null)=>{const r=rule(key);if(!r)return;const code=reason||(!['live','demo'].includes(r.mode)?'OFF':r.mode==='demo'?'DEMO':amountBonus<=0?'ZERO':'READY');entries.push({orderId:order.id,customerId,ruleKey:key,amountBonus,operationKey,referralId,mode:r.mode,reason:code,reasonText:REASONS[code]});};
  const amount=Number(order.payment?.amount||0);
  add('purchase_percent',order.customerId,calculatePurchase(amount,rule('purchase_percent')?.value||0),`purchase:${order.id}`);
  if(reason)return entries;
  const referral=await tx.referral.findUnique({where:{referredCustomerId:order.customerId}});
  if(!referral||String(referral.status).toLowerCase()==='rejected'||referral.referrerCustomerId===order.customerId||new Date(referral.createdAt)>new Date(order.createdAt))return entries;
  if(referral.status==='rewarded'&&referral.referrerBonusPaid&&referral.referredBonusPaid)return entries;
  const earlier=await tx.order.findMany({where:{customerId:order.customerId,status:'COMPLETED',id:{not:order.id}},include:INCLUDE,take:1001});
  if(earlier.length>1000)throw problem('BENEFIT_HISTORY_LIMIT','История клиента требует пакетной проверки.',409);
  const completedAt=Math.min(...order.machineDispenseAttempts.filter(a=>a.status==='DISPENSED'&&a.completedAt).map(a=>new Date(a.completedAt).getTime()));
  for(const old of earlier){if(orderReason(old))continue;const oldCompletedAt=Math.min(...old.machineDispenseAttempts.filter(a=>a.status==='DISPENSED'&&a.completedAt).map(a=>new Date(a.completedAt).getTime()));if(oldCompletedAt>completedAt||(oldCompletedAt===completedAt&&old.id>order.id))continue;const [oldFlow,oldGift]=await Promise.all([tx.saleFlow.findUnique({where:{orderId:old.id},select:{metadata:true}}),tx.giftTransfer.findFirst({where:{originalOrderId:old.id},select:{id:true}})]);if(!orderReason(old,{flow:oldFlow,gift:Boolean(oldGift)}))return entries;}
  const referrer=await tx.customer.findUnique({where:{id:referral.referrerCustomerId},select:{phoneVerifiedAt:true,status:true}});
  if(!referrer?.phoneVerifiedAt||referrer.status!=='active')return entries;
  if(!referral.referredBonusPaid)add('referral_invitee',order.customerId,rule('referral_invitee')?.value||0,`referral:${referral.id}:invitee`,referral.id);
  if(!referral.referrerBonusPaid)add('referral_inviter',referral.referrerCustomerId,rule('referral_inviter')?.value||0,`referral:${referral.id}:inviter`,referral.id);
  const count=await tx.referral.count({where:{referrerCustomerId:referral.referrerCustomerId,status:'rewarded',id:{not:referral.id}}});
  let milestoneCount=count+1;
  if(simulation&&referral.status!=='rewarded'){let ids=simulation.get(referral.referrerCustomerId);if(!ids){ids=new Set();simulation.set(referral.referrerCustomerId,ids);}ids.add(referral.id);milestoneCount=count+ids.size;}
  if((rule('milestone_count')?.mode==='live'||(historical&&rule('milestone_count')?.mode==='demo'))&&milestoneCount>=Number(rule('milestone_count').value||Infinity))add('milestone_bonus',referral.referrerCustomerId,rule('milestone_bonus')?.value||0,`milestone:${referral.referrerCustomerId}`,referral.id);
  return entries;
 }
 async completeOrder(tx,orderId){
  const policy=await this.policy(tx);if(!policy)return {applied:0};
  const order=await tx.order.findUnique({where:{id:orderId},include:INCLUDE});if(!order)return {applied:0};
  // Serializes referral milestones and first-purchase qualification across orders.
  await tx.$queryRawUnsafe("SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('customer-benefit-posting'))");
  const entries=await this.evaluate(tx,order,policy);let applied=0;
  for(const row of entries.filter(r=>r.reason==='READY')){
   await tx.$queryRawUnsafe('SELECT "id" FROM "Customer" WHERE "id"=$1 FOR UPDATE',row.customerId);
   if((await tx.$queryRawUnsafe('SELECT "id" FROM "CustomerBenefitPosting" WHERE "operationKey"=$1',row.operationKey)).length)continue;
   const duplicate=await tx.bonusTransaction.findFirst({where:row.referralId?{referralId:row.referralId,customerId:row.customerId,type:row.ruleKey==='referral_invitee'?'REFERRAL_REWARD_REFERRED':row.ruleKey==='referral_inviter'?'REFERRAL_REWARD_REFERRER':'REFERRAL_MILESTONE'}:{orderId:order.id,customerId:row.customerId,type:'PURCHASE_REWARD'}});if(duplicate)continue;
   const account=await tx.bonusAccount.upsert({where:{customerId:row.customerId},create:{customerId:row.customerId,balanceBonus:row.amountBonus},update:{balanceBonus:{increment:row.amountBonus}}});
   const type=row.ruleKey==='purchase_percent'?'PURCHASE_REWARD':row.ruleKey==='referral_invitee'?'REFERRAL_REWARD_REFERRED':row.ruleKey==='referral_inviter'?'REFERRAL_REWARD_REFERRER':'REFERRAL_MILESTONE';
   const bonus=await tx.bonusTransaction.create({data:{customerId:row.customerId,orderId:order.id,referralId:row.referralId,type,direction:'credit',amountBonus:row.amountBonus,source:'CUSTOMER_BENEFIT_RULES',reason:`${row.ruleKey}; версия ${policy.version}`,referenceEntityType:'CustomerBenefitPolicyVersion',referenceEntityId:String(policy.version),balanceAfterBonus:account.balanceBonus}});
   await tx.$executeRawUnsafe('INSERT INTO "CustomerBenefitPosting" ("id","operationKey","policyVersion","customerId","orderId","ruleKey","amountBonus","bonusTransactionId") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',randomUUID(),row.operationKey,policy.version,row.customerId,order.id,row.ruleKey,row.amountBonus,bonus.id);
   if(row.ruleKey==='purchase_percent')await tx.order.update({where:{id:order.id},data:{bonusEarned:{increment:row.amountBonus}}});
   if(row.referralId&&row.ruleKey!=='milestone_bonus')await tx.$executeRawUnsafe('INSERT INTO "ReferralQualification" ("id","referralId","action","sourceEventId","occurredAt") VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP) ON CONFLICT ("referralId") DO NOTHING',randomUUID(),row.referralId,'first_purchase',`order:${order.id}`);
   if(row.referralId&&row.ruleKey!=='milestone_bonus')await tx.referral.update({where:{id:row.referralId},data:{[row.ruleKey==='referral_invitee'?'referredBonusPaid':'referrerBonusPaid']:true,firstPurchaseAt:new Date()}});
   applied++;
  }
  for(const id of [...new Set(entries.filter(e=>e.referralId).map(e=>e.referralId))]){const ref=await tx.referral.findUnique({where:{id}});if(ref.referrerBonusPaid&&ref.referredBonusPaid)await tx.referral.update({where:{id},data:{status:'rewarded'}});}
  return {applied};
 }
 async preview({version,customerId=null,actorId}){
  const policies=await this.versions(),policy=policies.find(v=>v.version===Number(version));if(!policy)throw problem('BENEFIT_VERSION_NOT_FOUND','Версия не найдена.',404);
  const orders=await this.prisma.order.findMany({where:customerId?{customerId}:{},include:INCLUDE,orderBy:[{createdAt:'asc'},{id:'asc'}],take:501});
  const entries=[],simulation=new Map(),operationKeys=new Set();for(const order of orders.slice(0,500)){for(const row of await this.evaluate(this.prisma,order,policy,{historical:true,simulation})){if(operationKeys.has(row.operationKey))continue;operationKeys.add(row.operationKey);entries.push(row);}}
  for(const row of entries){if(!row.customerId)continue;const posted=await this.prisma.$queryRawUnsafe('SELECT "id" FROM "CustomerBenefitPosting" WHERE "operationKey"=$1',row.operationKey);const types={purchase_percent:'PURCHASE_REWARD',referral_invitee:'REFERRAL_REWARD_REFERRED',referral_inviter:'REFERRAL_REWARD_REFERRER',milestone_bonus:'REFERRAL_MILESTONE'};const oldBonus=await this.prisma.bonusTransaction.findFirst({where:{customerId:row.customerId,...(row.referralId?{referralId:row.referralId}:{orderId:row.orderId}),type:types[row.ruleKey]}});if(posted.length||oldBonus){row.reason='ALREADY_POSTED';row.reasonText=REASONS.ALREADY_POSTED;}}
  const result={policyVersion:policy.version,entries,truncated:orders.length>500,examined:Math.min(500,orders.length),totalBonus:entries.filter(e=>['READY','DEMO'].includes(e.reason)).reduce((s,e)=>s+e.amountBonus,0),applied:0,notice:'Сухой расчёт: балансы не изменены. Запись прошлых начислений не включена.'};
  const id=randomUUID();await this.prisma.$executeRawUnsafe('INSERT INTO "CustomerBenefitPreview" ("id","policyVersion","actorId","result") VALUES ($1,$2,$3,$4::jsonb)',id,policy.version,actorId,JSON.stringify(result));return {id,...result};
 }
 async journal(){return this.prisma.$queryRawUnsafe('SELECT * FROM "CustomerBenefitPosting" ORDER BY "createdAt" DESC LIMIT 100');}
}
module.exports={CustomerBenefitService,orderReason,REASONS};
