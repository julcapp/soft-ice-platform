const test=require('node:test');
const assert=require('node:assert/strict');
const {INITIAL_RULES,validateRules,calculatePurchase}=require('../src/modules/customer_benefits/BenefitRules');
const {CustomerBenefitService,orderReason}=require('../src/modules/customer_benefits/CustomerBenefitService');
const valid=()=>({id:'order',customerId:'customer',machineId:'machine',currency:'RUB',status:'COMPLETED',amount:100,payment:{amount:100,currency:'RUB',status:'SUCCEEDED',refunds:[],metadata:{test:false}},machineDispenseAttempts:[{status:'DISPENSED',completedAt:new Date()}],customer:{phoneVerifiedAt:new Date(),status:'active'},paymentAttempts:[]});
test('initial values are demo or draft; no automatic live rules',()=>{assert.equal(validateRules(INITIAL_RULES).length,11);assert.equal(INITIAL_RULES.some(r=>r.mode==='live'),false);assert.equal(INITIAL_RULES.find(r=>r.key==='purchase_percent').value,5);});
test('whole bonus rounding uses paid amount; tiny test purchases yield zero',()=>{assert.equal(calculatePurchase(7,5),0);assert.equal(calculatePurchase(199.99,5),9);assert.equal(calculatePurchase(200,5),10);assert.equal(calculatePurchase(100,7),7);});
test('reject unknown, duplicate, negative, excessive and unsupported live rules',()=>{
 for(const patch of [{key:'unknown'},{value:-1},{value:101},{value:1.001}]){const rules=structuredClone(INITIAL_RULES);Object.assign(rules[0],patch);assert.throws(()=>validateRules(rules));}
 const rules=structuredClone(INITIAL_RULES);rules[6].mode='live';rules[6].value=100;assert.throws(()=>validateRules(rules),{code:'BENEFIT_NOT_READY'});
});
test('only completed paid confirmed ordinary real order qualifies',()=>{assert.equal(orderReason(valid()),null);for(const [field,value,code] of [['status','PAID','ORDER_NOT_COMPLETED'],['machineId','TEST-MACHINE-001','TEST_PAYMENT']]){const o=valid();o[field]=value;assert.equal(orderReason(o),code);}const o=valid();o.payment.refunds=[{}];assert.equal(orderReason(o),'REFUND_EXISTS');});
test('preorder, gift, unverified customer, unknown test mode are excluded',()=>{const o=valid();assert.equal(orderReason(o,{gift:true}),'GIFT_EXCLUDED');assert.equal(orderReason(o,{flow:{metadata:{fulfillmentMode:'PICKUP'}}}),'PREPAID_EXCLUDED');o.customer.phoneVerifiedAt=null;assert.equal(orderReason(o),'CUSTOMER_NOT_VERIFIED');o.customer.phoneVerifiedAt=new Date();o.payment.metadata={};assert.equal(orderReason(o),'PAYMENT_MODE_UNKNOWN');});
test('without active policy completion creates no account or posting',async()=>{const tx={$queryRawUnsafe:async()=>[]};const service=new CustomerBenefitService({prisma:tx});assert.deepEqual(await service.completeOrder(tx,'order'),{applied:0});});
test('demo preview estimates without changing bonus account',async()=>{
 const tx={saleFlow:{findUnique:async()=>({metadata:{},completedAt:new Date()})},giftTransfer:{findFirst:async args=>{assert.ok(args.where.originalOrderId);assert.equal(args.where.orderId,undefined);return null;}},referral:{findUnique:async()=>null}};
 const service=new CustomerBenefitService({prisma:tx});const result=await service.evaluate(tx,valid(),{rules:INITIAL_RULES,createdAt:new Date(0)});assert.equal(result[0].reason,'DEMO');assert.equal(result[0].amountBonus,5);
});
test('stable posting key independent of rule version prevents replay',async()=>{
 const rules=structuredClone(INITIAL_RULES);rules[0].mode='live';const tx={saleFlow:{findUnique:async()=>({metadata:{},completedAt:new Date()})},giftTransfer:{findFirst:async args=>{assert.ok(args.where.originalOrderId);assert.equal(args.where.orderId,undefined);return null;}},referral:{findUnique:async()=>null}};const service=new CustomerBenefitService({prisma:tx});const a=await service.evaluate(tx,valid(),{version:1,rules,createdAt:new Date(0)}),b=await service.evaluate(tx,valid(),{version:2,rules,createdAt:new Date(0)});assert.equal(a[0].operationKey,b[0].operationKey);assert.equal(a[0].reason,'READY');
});
test('duplicate completion credits account once and keeps one journal posting',async()=>{
 const rules=structuredClone(INITIAL_RULES);rules[0].mode='live';let postings=0,credits=0,bonusTransactions=0;
 const tx={
  $queryRawUnsafe:async(sql)=>sql.includes('FROM "CustomerBenefitPolicyVersion"')?[{version:1,rules,createdAt:new Date(0)}]:sql.includes('FROM "CustomerBenefitPosting"')?(postings?[{id:'posted'}]:[]):[],
  $executeRawUnsafe:async(sql)=>{if(sql.includes('INSERT INTO "CustomerBenefitPosting"'))postings++;},
  saleFlow:{findUnique:async()=>({metadata:{},completedAt:new Date()})},giftTransfer:{findFirst:async args=>{assert.ok(args.where.originalOrderId);assert.equal(args.where.orderId,undefined);return null;}},referral:{findUnique:async()=>null},
  order:{findUnique:async()=>valid(),update:async()=>({})},
  bonusAccount:{upsert:async()=>{credits++;return {balanceBonus:5};}},bonusTransaction:{findFirst:async()=>null,create:async()=>{bonusTransactions++;return {id:'bonus'};}}
 };
 const service=new CustomerBenefitService({prisma:tx});await service.completeOrder(tx,'order');await service.completeOrder(tx,'order');assert.equal(credits,1);assert.equal(postings,1);assert.equal(bonusTransactions,1);
});

test('first real purchase awards both referral sides and one threshold gift',async()=>{
 const rules=structuredClone(INITIAL_RULES);for(const r of rules)if(r.mode==='demo')r.mode='live';
 const order=valid();order.createdAt=new Date('2026-10-15T10:00:00Z');
 const tx={saleFlow:{findUnique:async()=>({metadata:{},completedAt:new Date()})},giftTransfer:{findFirst:async()=>null},
 referral:{findUnique:async()=>({id:'ref',referrerCustomerId:'inviter',referredCustomerId:'customer',status:'pending',createdAt:new Date('2026-10-14')}),count:async()=>2},
 order:{findMany:async()=>[]},customer:{findUnique:async()=>({phoneVerifiedAt:new Date(),status:'active'})}};
 const rows=await new CustomerBenefitService({prisma:tx}).evaluate(tx,order,{rules,createdAt:new Date(0)});
 assert.deepEqual(rows.map(r=>[r.ruleKey,r.amountBonus]),[['purchase_percent',5],['referral_invitee',50],['referral_inviter',50],['milestone_bonus',100]]);
 tx.order.findMany=async()=>[{...valid(),id:'earlier',machineDispenseAttempts:[{status:'DISPENSED',completedAt:new Date('2026-10-14')}]}];
 const repeat=await new CustomerBenefitService({prisma:tx}).evaluate(tx,order,{rules,createdAt:new Date(0)});
 assert.deepEqual(repeat.map(r=>r.ruleKey),['purchase_percent']);
});

test('historical preview keeps anonymous orders without querying a null bonus customer',async()=>{
 let saved;
 const p={$queryRawUnsafe:async()=>[{version:1,rules:INITIAL_RULES}],$executeRawUnsafe:async(sql,id,version,actor,result)=>{saved=JSON.parse(result);},
 order:{findMany:async()=>[{id:'anonymous-order',customerId:null,status:'CREATED',payment:null,machineDispenseAttempts:[],customer:null}]},
 saleFlow:{findUnique:async()=>null},giftTransfer:{findFirst:async()=>null},
 bonusTransaction:{findFirst:async()=>{throw Error('Anonymous customer must not reach bonus lookup');}}};
 const result=await new CustomerBenefitService({prisma:p}).preview({version:1,actorId:'auditor'});
 assert.equal(result.examined,1);assert.equal(result.applied,0);assert.equal(result.totalBonus,0);
 assert.equal(result.entries[0].customerId,null);assert.equal(result.entries[0].reason,'ORDER_NOT_COMPLETED');assert.equal(saved.entries.length,1);
});
