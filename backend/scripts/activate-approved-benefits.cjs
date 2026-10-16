'use strict';
// Run on the deployment host, from its backend root. Does not post historical rewards.
const fs=require('node:fs');
for(const line of fs.readFileSync('/etc/softice/display-backend.env','utf8').split(/\r?\n/)){
 if(line.startsWith('DATABASE_URL='))process.env.DATABASE_URL=line.slice(13).trim().replace(/^(['"])(.*)\1$/,'$2');
}
const {PrismaClient}=require(process.cwd()+'/node_modules/@prisma/client');
const {CustomerBenefitService}=require(process.cwd()+'/src/modules/customer_benefits/CustomerBenefitService');
const {INITIAL_RULES}=require(process.cwd()+'/src/modules/customer_benefits/BenefitRules');
const prisma=new PrismaClient();
(async()=>{
 const [owner]=await prisma.$queryRawUnsafe('SELECT id,roles FROM "AdminUser" WHERE login=$1 AND status=$2','julcapp','ACTIVE');
 if(!owner?.roles?.includes('PLATFORM_OWNER'))throw Error('OWNER_NOT_FOUND');
 const service=new CustomerBenefitService({prisma}), data=await service.read();
 if(data.active || data.current.version!==2)throw Error('POLICY_CHANGED: inspect current policy before maintenance activation');
 const approved={purchase_percent:5,referral_invitee:50,referral_inviter:50,milestone_count:4,milestone_bonus:100};
 const rules=data.current.rules.map(row=>{
  if(Object.hasOwn(approved,row.key)){
   if(row.value!==approved[row.key])throw Error('APPROVED_VALUE_MISMATCH '+row.key);
   return {...row,mode:'live'};
  }
  return row.key==='club_initial_topup'?INITIAL_RULES.find(r=>r.key===row.key):row.key==='fiftieth_count'?row:{...row,mode:'draft'};
 });
 const before=await prisma.bonusTransaction.count();
 const reason='Прямое поручение владельца 16.10.2026: включить заданные серверные правила 5%, 50/50, 4 друга/100 для будущих завершённых реальных покупок. Историю не начислять.';
 const draft=await service.save({baseVersion:data.current.version,rules,reason,actorId:owner.id});
 const live=await service.activate({version:draft.version,reason,actorId:owner.id});
 console.log(JSON.stringify({liveVersion:live.version,status:live.status,rules:live.rules.map(({key,value,mode})=>({key,value,mode})),bonusTransactionsBefore:before,bonusTransactionsAfter:await prisma.bonusTransaction.count()}));
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
