'use strict';
const fs=require('node:fs');for(const l of fs.readFileSync('/etc/softice/display-backend.env','utf8').split(/\r?\n/))if(l.startsWith('DATABASE_URL='))process.env.DATABASE_URL=l.slice(13).trim().replace(/^(['"])(.*)\1$/,'$2');
const {PrismaClient}=require(process.cwd()+'/node_modules/@prisma/client'),db=new PrismaClient();
(async()=>{
 const {CustomerBenefitEventService}=require(process.cwd()+'/src/modules/customer_benefits/CustomerBenefitEventService');
 await new CustomerBenefitEventService({prisma:db}).runOnce();
 const {CustomerBenefitService}=require(process.cwd()+'/src/modules/customer_benefits/CustomerBenefitService'),s=new CustomerBenefitService({prisma:db});
 console.log('ACTIVE_VERSION',(await s.policy()).version,'BENEFIT_JOURNAL_ROWS',(await s.journal()).length);
 const c=await db.customer.findUnique({where:{id:'251eda93-85b5-4cb4-83b7-00a5ce335150'}});
 const {MiniAppPreorderService}=require(process.cwd()+'/src/modules/order/MiniAppPreorderService');
 const a=await new MiniAppPreorderService({prisma:db}).account(c);console.log('CLUB_OFFER',JSON.stringify(a.clubOffer),'TEST_BALANCE',a.testClubBalanceRub,'REAL_BALANCE',a.clubBalance);
 const {SchedulerService}=require(process.cwd()+'/src/modules/scheduler/SchedulerService');const schedule=await new SchedulerService({prisma:db}).list();console.log('NEW_SCHEDULES',schedule.items.filter(x=>['customer-benefit-event-worker','miniapp-test-club-topup-reconciliation'].includes(x.id)).map(x=>({id:x.id,schedule:x.scheduleTechnical}))); 
 const p=await db.$queryRawUnsafe('SELECT status,"amountCents",test FROM "MiniAppClubTopupCheckout" WHERE "customerId"=$1',c.id);console.log('TOPUP_STATUS',JSON.stringify(p));
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1}).finally(()=>db.$disconnect());
