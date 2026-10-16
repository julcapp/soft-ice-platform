'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
for(const l of fs.readFileSync('/etc/softice/display-backend.env','utf8').split(/\r?\n/)){const i=l.indexOf('=');if(['DATABASE_URL','YOOKASSA_SHOP_ID','YOOKASSA_SECRET_KEY','YOOKASSA_API_BASE_URL'].includes(l.slice(0,i)))process.env[l.slice(0,i)]=l.slice(i+1).trim().replace(/^(['"])(.*)\1$/,'$2');}
const {PrismaClient}=require(process.cwd()+'/node_modules/@prisma/client'),db=new PrismaClient();
const {MiniAppClubTopupService}=require(process.cwd()+'/src/modules/club_account/MiniAppClubTopupService');
const {CustomerBenefitService}=require(process.cwd()+'/src/modules/customer_benefits/CustomerBenefitService');
(async()=>{
 const service=new CustomerBenefitService({prisma:db}),data=await service.read();if(data.current.version!==6||data.current.status!=='LIVE')throw Error('POLICY_CHANGED');
 await assert.rejects(db.$transaction(async tx=>{
  const customer=await tx.customer.create({data:{phone:'+7'+String(Date.now()).slice(-10),name:'ROLLBACK TEST',status:'active',phoneVerifiedAt:new Date()}});
  const [row]=await tx.$queryRawUnsafe('INSERT INTO "MiniAppClubTopupCheckout" (id,"customerId","policyVersion","amountCents","shopId") VALUES ($1,$2,6,15000,$3) RETURNING *',randomUUID(),customer.id,'fixture');
  const scoped=new Proxy(tx,{get:(target,key)=>key==='$transaction'?fn=>fn(tx):Reflect.get(target,key)}),engine=new MiniAppClubTopupService({prisma:scoped});
  const payment={id:randomUUID(),test:true,recipient:{account_id:'fixture'},amount:{value:'150.00',currency:'RUB'},metadata:{club_topup_id:row.id,customer_id:customer.id},status:'succeeded',paid:true};
  const a=await engine.apply(row,payment),b=await engine.apply(row,payment);assert.equal(a.status,'SUCCEEDED');assert.equal(b.status,'SUCCEEDED');
  assert.equal(await tx.customerTimelineEvent.count({where:{sourceEntityId:row.id}}),1);
  assert.equal(await tx.clubAccount.count({where:{customerId:customer.id}}),0);
  throw Error('INTENTIONAL_ROLLBACK');
 },{timeout:20000}),{message:'INTENTIONAL_ROLLBACK'});
 console.log('REAL_DB_TOPUP_ROLLBACK_TEST_PASSED');
 const [owner]=await db.$queryRawUnsafe('SELECT id FROM "AdminUser" WHERE login=$1 AND status=$2 AND $3=ANY(roles)','julcapp','ACTIVE','PLATFORM_OWNER');if(!owner)throw Error('OWNER_NOT_FOUND');
 const reason='Прямое поручение владельца 16.10.2026: подключить первоначальное пополнение150 через Mini App. Только подтверждённый тестовый магазин; тестовый денежный остаток отдельно от реального, без бонусного начисления.';
 const rules=data.current.rules.map(r=>r.key==='club_initial_topup'?{...r,mode:'live'}:r);
 const draft=await service.save({baseVersion:6,rules,reason,actorId:owner.id});const live=await service.activate({version:draft.version,reason,actorId:owner.id});console.log('CLUB_TOPUP_ACTIVE_POLICY',live.version);
 // Prepare one unpaid TEST checkout for the owner's explicitly designated test profile; never complete payment here.
 const customer=await db.customer.findUnique({where:{id:'251eda93-85b5-4cb4-83b7-00a5ce335150'}});if(!customer?.phoneVerifiedAt||customer.status!=='active')throw Error('TEST_PROFILE_NOT_READY');
 let Adapter;try{Adapter=require(process.cwd()+'/src/modules/payment/YooKassaPaymentProviderAdapter').YooKassaPaymentProviderAdapter;}catch{Adapter=require(process.cwd()+'/src/modules/payment/YooKassaPaymentAdapter').YooKassaPaymentAdapter;}
 const adapter=new Adapter({shopId:process.env.YOOKASSA_SHOP_ID,secretKey:process.env.YOOKASSA_SECRET_KEY,...(process.env.YOOKASSA_API_BASE_URL?{apiBaseUrl:process.env.YOOKASSA_API_BASE_URL}:{})});
 const result=await new MiniAppClubTopupService({prisma:db,adapter}).initiate(customer.id);
 console.log('TEST_TOPUP_READY',JSON.stringify({id:result.id,status:result.status,amountRub:result.amountRub,test:result.test,widgetTokenPresent:Boolean(result.confirmationToken)}));
})().catch(e=>{console.error(e.code||e.message,e.actual?.code||'',e.actual?.message||e.message);process.exitCode=1}).finally(()=>db.$disconnect());
