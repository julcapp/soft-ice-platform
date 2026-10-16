'use strict';
const {randomUUID}=require('node:crypto');
const {CustomerBenefitService}=require('./CustomerBenefitService');
function tomskDay(now){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tomsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
function eventKey(rule,customer,day){return rule==='welcome_bonus'?`registration:${customer.id}`:`birthday:${customer.id}:${day.slice(0,4)}`;}
function eligible(rule,customer,policy,now){
 if(!customer?.phoneVerifiedAt||customer.status!=='active')return false;
 if(rule==='welcome_bonus')return new Date(customer.createdAt)>=new Date(policy.createdAt)&&new Date(customer.phoneVerifiedAt)>=new Date(policy.createdAt)&&new Date(customer.phoneVerifiedAt)<=now;
 if(rule==='birthday_bonus')return customer.birthday&&new Date(customer.birthday)<=now&&new Date(customer.birthday).toISOString().slice(5,10)===tomskDay(now).slice(5);
 return false;
}
class CustomerBenefitEventService{
 constructor({prisma,clock=()=>new Date()}){Object.assign(this,{prisma,clock});this.running=false;}
 async grant(ruleKey,customerId){return this.prisma.$transaction(async tx=>{
  await tx.$queryRawUnsafe('SELECT id FROM "Customer" WHERE id=$1 FOR UPDATE',customerId);
  let policy=await new CustomerBenefitService({prisma:tx}).policy();
  let rule=policy?.rules.find(r=>r.key===ruleKey);
  if(rule?.mode!=='live'||!Number.isInteger(rule.value)||rule.value<=0)return {granted:false};
  const customer=await tx.customer.findUnique({where:{id:customerId}}),now=this.clock();
  let eligibilityPolicy=policy;
  if(ruleKey==='welcome_bonus'&&customer?.phoneVerifiedAt){
   const first=await tx.$queryRawUnsafe('SELECT "createdAt" FROM "CustomerBenefitPolicyVersion" WHERE status=\'LIVE\' AND rules @> $1::jsonb ORDER BY version ASC LIMIT 1',JSON.stringify([{key:'welcome_bonus',mode:'live'}]));
   const atEvent=await tx.$queryRawUnsafe('SELECT * FROM "CustomerBenefitPolicyVersion" WHERE status=\'LIVE\' AND "createdAt"<=$1 ORDER BY version DESC LIMIT 1',new Date(customer.phoneVerifiedAt));
   const eventRule=atEvent[0]?.rules.find(r=>r.key==='welcome_bonus');
   if(!first.length||eventRule?.mode!=='live'||!Number.isInteger(eventRule.value)||eventRule.value<=0)return {granted:false};
   policy=atEvent[0];rule=eventRule;eligibilityPolicy={...policy,createdAt:first[0].createdAt};
  }
  if(!eligible(ruleKey,customer,eligibilityPolicy,now))return {granted:false};
  const key=eventKey(ruleKey,customer,tomskDay(now));
  const posted=await tx.$queryRawUnsafe('SELECT id FROM "CustomerBenefitEventPosting" WHERE "operationKey"=$1',key);
  if(posted.length)return {granted:false,duplicate:true};
  // Existing registration/birthday ledgers must never be credited a second time.
  const duplicate=await tx.bonusTransaction.findFirst({where:{customerId,type:ruleKey==='welcome_bonus'?'WELCOME_BONUS':'BIRTHDAY_REWARD',...(ruleKey==='birthday_bonus'?{createdAt:{gte:new Date(tomskDay(now).slice(0,4)+'-01-01T00:00:00+07:00')}}:{})}});
  if(duplicate)return {granted:false,duplicate:true};
  const account=await tx.bonusAccount.upsert({where:{customerId},create:{customerId,balanceBonus:rule.value},update:{balanceBonus:{increment:rule.value}}});
  const transaction=await tx.bonusTransaction.create({data:{customerId,type:ruleKey==='welcome_bonus'?'WELCOME_BONUS':'BIRTHDAY_REWARD',direction:'credit',amountBonus:rule.value,source:'CUSTOMER_BENEFIT_EVENTS',reason:`${ruleKey}; версия ${policy.version}`,referenceEntityType:'CustomerBenefitPolicyVersion',referenceEntityId:String(policy.version),balanceAfterBonus:account.balanceBonus}});
  await tx.$executeRawUnsafe('INSERT INTO "CustomerBenefitEventPosting" (id,"operationKey","policyVersion","customerId","ruleKey","amountBonus","bonusTransactionId") VALUES ($1,$2,$3,$4,$5,$6,$7)',randomUUID(),key,policy.version,customerId,ruleKey,rule.value,transaction.id);
  return {granted:true,amountBonus:rule.value,transactionId:transaction.id};
 });}
 async runOnce(){if(this.running)return;this.running=true;try{
  const now=this.clock(),policy=await new CustomerBenefitService({prisma:this.prisma}).policy();if(!policy)return;
  for(const key of ['welcome_bonus','birthday_bonus']){
   if(policy.rules.find(r=>r.key===key)?.mode!=='live')continue;
   let enabledSince=policy.createdAt;
   if(key==='welcome_bonus'){const first=await this.prisma.$queryRawUnsafe('SELECT \"createdAt\" FROM \"CustomerBenefitPolicyVersion\" WHERE status=\'LIVE\' AND rules @> $1::jsonb ORDER BY version ASC LIMIT 1',JSON.stringify([{key:'welcome_bonus',mode:'live'}]));if(!first.length)continue;enabledSince=first[0].createdAt;}
   const day=tomskDay(now),prefix=key==='welcome_bonus'?'registration:':'birthday:',suffix=key==='welcome_bonus'?'':':'+day.slice(0,4);
   const rows=await this.prisma.$queryRawUnsafe(`SELECT c.id FROM "Customer" c WHERE c.status='active' AND c."phoneVerifiedAt" IS NOT NULL AND ${key==='welcome_bonus'?`c."createdAt">=$1 AND c."phoneVerifiedAt">=$1 AND (SELECT pv.rules FROM "CustomerBenefitPolicyVersion" pv WHERE pv.status='LIVE' AND pv."createdAt"<=c."phoneVerifiedAt" ORDER BY pv.version DESC LIMIT 1) @> '[{"key":"welcome_bonus","mode":"live"}]'::jsonb`:`to_char(c.birthday,'MM-DD')=$1`} AND NOT EXISTS (SELECT 1 FROM "CustomerBenefitEventPosting" p WHERE p."operationKey"=$2||c.id||$3) AND NOT EXISTS (SELECT 1 FROM "BonusTransaction" b WHERE b."customerId"=c.id AND b.type=$4 ${key==='birthday_bonus'?'AND b."createdAt">=$5':''}) ORDER BY c.id LIMIT 100`,key==='welcome_bonus'?new Date(enabledSince):day.slice(5),prefix,suffix,key==='welcome_bonus'?'WELCOME_BONUS':'BIRTHDAY_REWARD',...(key==='birthday_bonus'?[new Date(day.slice(0,4)+'-01-01T00:00:00+07:00')]:[]));
   for(const row of rows)await this.grant(key,row.id);
  }
 }finally{this.running=false;}}
 start(logger=console){const run=()=>this.runOnce().catch(e=>logger.error('benefit_event_worker_failed',{code:e.code||'BENEFIT_EVENT_FAILED'}));const first=setTimeout(run,10000),timer=setInterval(run,60000);first.unref();timer.unref();return ()=>{clearTimeout(first);clearInterval(timer);};}
}
module.exports={CustomerBenefitEventService,tomskDay,eventKey,eligible};
