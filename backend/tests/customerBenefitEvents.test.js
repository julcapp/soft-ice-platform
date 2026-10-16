const test=require('node:test'),assert=require('node:assert/strict');
const {eligible,eventKey,tomskDay,CustomerBenefitEventService}=require('../src/modules/customer_benefits/CustomerBenefitEventService');
const now=new Date('2026-10-16T18:00:00Z'),policy={createdAt:new Date('2026-10-16T00:00:00Z')};
const c={id:'c',status:'active',createdAt:new Date('2026-10-16T10:00:00Z'),phoneVerifiedAt:new Date('2026-10-16T11:00:00Z'),birthday:new Date('1990-10-17T00:00:00Z')};
test('birthday follows Tomsk calendar and never uses future birthday',()=>{assert.equal(tomskDay(now),'2026-10-17');assert.equal(eligible('birthday_bonus',c,policy,now),true);assert.equal(eligible('birthday_bonus',{...c,birthday:new Date('2030-10-17')},policy,now),false);});
test('registration excludes historical customers and unverified or blocked profiles',()=>{assert.equal(eligible('welcome_bonus',c,policy,now),true);for(const patch of [{createdAt:new Date('2026-10-15')},{phoneVerifiedAt:null},{status:'blocked'}])assert.equal(eligible('welcome_bonus',{...c,...patch},policy,now),false);});
test('registration key is lifetime and birthday key is annual independent of birth date or policy revision',()=>{assert.equal(eventKey('welcome_bonus',c,'2027-01-01'),'registration:c');assert.equal(eventKey('birthday_bonus',c,'2026-10-17'),'birthday:c:2026');assert.equal(eventKey('birthday_bonus',c,'2026-11-18'),'birthday:c:2026');});
test('inactive rule creates no customer balance',async()=>{const tx={$queryRawUnsafe:async sql=>sql.includes('PolicyVersion')?[{rules:[{key:'welcome_bonus',mode:'draft',value:10}]}]:[]};const service=new CustomerBenefitEventService({prisma:{$transaction:fn=>fn(tx)}});assert.deepEqual(await service.grant('welcome_bonus','c'),{granted:false});});
test('editing a later policy does not lose a pending registration or change its event-time reward',async()=>{
 const customer={...c,createdAt:new Date('2026-10-16T12:00:00Z'),phoneVerifiedAt:new Date('2026-10-16T12:01:00Z')};
 const latest={version:8,createdAt:new Date('2026-10-16T13:00:00Z'),rules:[{key:'welcome_bonus',mode:'live',value:20}]};
 const original={version:6,createdAt:new Date('2026-10-16T10:00:00Z'),rules:[{key:'welcome_bonus',mode:'live',value:10}]};let credited=0;
 const tx={
  $queryRawUnsafe:async sql=>sql.includes('rules @>')?[{createdAt:original.createdAt}]:sql.includes('"createdAt"<=$1')?[original]:sql.includes('FROM "CustomerBenefitPolicyVersion"')?[latest]:[],
  customer:{findUnique:async()=>customer},bonusTransaction:{findFirst:async()=>null,create:async()=>({id:'bonus'})},
  bonusAccount:{upsert:async({create})=>{credited=create.balanceBonus;return {balanceBonus:credited};}},$executeRawUnsafe:async()=>1,
 };
 const result=await new CustomerBenefitEventService({prisma:{$transaction:fn=>fn(tx)},clock:()=>new Date('2026-10-16T14:00:00Z')}).grant('welcome_bonus','c');
 assert.equal(result.amountBonus,10);assert.equal(credited,10);
});
