'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
for(const l of fs.readFileSync('/etc/softice/display-backend.env','utf8').split(/\r?\n/))if(l.startsWith('DATABASE_URL='))process.env.DATABASE_URL=l.slice(13).trim().replace(/^(['"])(.*)\1$/,'$2');
const {PrismaClient}=require(process.cwd()+'/node_modules/@prisma/client'),db=new PrismaClient();
const {CustomerBenefitService}=require(process.cwd()+'/src/modules/customer_benefits/CustomerBenefitService');
const {CustomerBenefitEventService,tomskDay}=require(process.cwd()+'/src/modules/customer_benefits/CustomerBenefitEventService');
(async()=>{
 const service=new CustomerBenefitService({prisma:db}),data=await service.read();if(data.current.version!==4||data.current.status!=='LIVE')throw Error('POLICY_CHANGED');
 const rules=data.current.rules.map(r=>['welcome_bonus','birthday_bonus','photo_bonus'].includes(r.key)?{...r,mode:'live'}:r);
 assert.deepEqual(rules.filter(r=>['welcome_bonus','birthday_bonus','photo_bonus'].includes(r.key)).map(r=>r.value),[10,30,20]);
 const now=new Date(),fixture={version:4,rules,createdAt:new Date(now.getTime()-60000)};
 const original=CustomerBenefitService.prototype.policy;
 const count=await db.bonusTransaction.count();
 try{
  CustomerBenefitService.prototype.policy=async()=>fixture;
  await assert.rejects(db.$transaction(async tx=>{
   const id=randomUUID(),day=tomskDay(now),birthday=new Date('1990-'+day.slice(5)+'T00:00:00Z');
   await tx.customer.create({data:{id,phone:'+7'+String(Date.now()).slice(-10),name:'ROLLBACK TEST',status:'active',phoneVerifiedAt:now,birthday,createdAt:now}});
   const scoped=new Proxy(tx,{get:(target,key)=>key==='$transaction'?fn=>fn(tx):Reflect.get(target,key)});
   const engine=new CustomerBenefitEventService({prisma:scoped,clock:()=>now});
   assert.equal((await engine.grant('welcome_bonus',id)).amountBonus,10);
   assert.equal((await engine.grant('welcome_bonus',id)).duplicate,true);
   assert.equal((await engine.grant('birthday_bonus',id)).amountBonus,30);
   assert.equal((await engine.grant('birthday_bonus',id)).duplicate,true);
   assert.equal((await tx.bonusAccount.findUnique({where:{customerId:id}})).balanceBonus,40);
   throw Error('INTENTIONAL_ROLLBACK');
  },{timeout:20000}),{message:'INTENTIONAL_ROLLBACK'});
 }finally{CustomerBenefitService.prototype.policy=original;}
 assert.equal(await db.bonusTransaction.count(),count);
 console.log('REAL_DB_EVENT_ROLLBACK_TEST_PASSED');
 const [owner]=await db.$queryRawUnsafe('SELECT id FROM "AdminUser" WHERE login=$1 AND status=$2 AND $3=ANY(roles)','julcapp','ACTIVE','PLATFORM_OWNER');if(!owner)throw Error('OWNER_NOT_FOUND');
 const reason='Прямое поручение владельца 16.10.2026: включить серверные обработчики регистрации10, дня рождения30 и фото20. Регистрация только новая, день рождения раз в год по Томску, фото после подтверждённой публикации. Без исторического начисления.';
 const draft=await service.save({baseVersion:4,rules,reason,actorId:owner.id});
 const live=await service.activate({version:draft.version,reason,actorId:owner.id});
 console.log('ACTIVE_BENEFIT_POLICY',JSON.stringify({version:live.version,rules:live.rules.map(({key,value,mode})=>({key,value,mode}))}));
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1}).finally(()=>db.$disconnect());
