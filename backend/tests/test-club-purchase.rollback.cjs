'use strict';
// Explicit acceptance check: fixture data exists only inside a transaction that ALWAYS rolls back.
if (process.env.TEST_CLUB_ROLLBACK_CHECK !== '1') throw Error('Set TEST_CLUB_ROLLBACK_CHECK=1 explicitly');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {PrismaClient} = require('../node_modules/@prisma/client');
const {MiniAppTestClubPurchaseService,testBalanceCents} = require('../src/modules/club_account/MiniAppTestClubPurchaseService');
const db = new PrismaClient();
const rollback = new Error('TEST_FIXTURES_ROLLBACK');
const customerId = randomUUID();
(async()=>{try{
  try { await db.$transaction(async tx=>{
    const context = await tx.saleFlow.findFirst({where:{machineId:'TEST-MACHINE-001'}});
    assert.ok(context,'Existing TEST machine organization context required');
    const [policy] = await tx.$queryRawUnsafe('SELECT version FROM "CustomerBenefitPolicyVersion" WHERE status=\'LIVE\' ORDER BY version DESC LIMIT 1');
    assert.ok(policy);
    await tx.customer.create({data:{id:customerId,name:'ROLLBACK TEST ONLY',status:'active',phoneVerifiedAt:new Date()}});
    // Simulated provider result is NEVER committed, not a real bank confirmation.
    const topupId=randomUUID();
    await tx.$executeRawUnsafe('INSERT INTO "MiniAppClubTopupCheckout" (id,"customerId","policyVersion","amountCents","shopId",status,"confirmedAt") VALUES ($1,$2,$3,15000,\'ROLLBACK_FIXTURE_NOT_BANK\',\'SUCCEEDED\',CURRENT_TIMESTAMP)',topupId,customerId,policy.version);
    async function order(amount){
      const o=await tx.order.create({data:{customerId,machineId:'TEST-MACHINE-001',status:'PAYMENT_PENDING',amount,currency:'RUB'}});
      await tx.saleFlow.create({data:{flowId:randomUUID(),orderId:o.id,customerId,machineId:o.machineId,organizationId:context.organizationId,locationId:context.locationId,correlationId:randomUUID(),currentState:'AWAITING_PAYMENT',metadata:{sourceChannel:'MINIAPP',fulfillmentMode:'PICKUP'}}});
      return o.id;
    }
    const now=new Date('2026-10-16T11:00:00Z');
    const service=new MiniAppTestClubPurchaseService({prisma:{$transaction:fn=>fn(tx)},clock:()=>now});
    const firstId=await order(70);
    const first=await service.pay({id:customerId},firstId);assert.equal(first.balanceRub,80);
    assert.equal((await service.pay({id:customerId},firstId)).duplicate,true);
    assert.equal(await testBalanceCents(tx,customerId),8000);
    const paid=await tx.order.findUnique({where:{id:firstId}});assert.equal(paid.status,'PAID');assert.equal(paid.expiresAt.toISOString(),'2026-10-19T11:00:00.000Z');
    const payment=await tx.payment.findUnique({where:{orderId:firstId}});assert.equal(payment.provider,'TEST_CLUB_ACCOUNT');assert.equal(payment.channel,'MINIAPP');assert.equal(payment.providerPaymentId,null);assert.equal(payment.metadata.test,true);
    const secondId=await order(90);await assert.rejects(service.pay({id:customerId},secondId),{code:'CLUB_TEST_INSUFFICIENT_FUNDS'});
    assert.equal(await tx.payment.count({where:{customerId}}),1);
    assert.equal(await tx.clubAccount.count({where:{customerId}}),0);assert.equal(await tx.bonusAccount.count({where:{customerId}}),0);
    assert.equal(await tx.machineDispenseAttempt.count({where:{orderId:firstId}}),0);
    assert.equal((await tx.$queryRawUnsafe('SELECT * FROM "MiniAppTestClubDebit" WHERE "customerId"=$1',customerId)).length,1);
    assert.equal(await tx.customerTimelineEvent.count({where:{customerId,eventType:'CLUB_TEST_PURCHASE'}}),1);
    console.log('TEST_CLUB_ROLLBACK_ASSERTIONS_PASSED');
    throw rollback;
  },{timeout:30000}); } catch(error){if(error!==rollback)throw error;}
  assert.equal(await db.customer.count({where:{id:customerId}}),0);
  console.log('FIXTURES_ROLLED_BACK');
}finally{await db.$disconnect();}})().catch(error=>{console.error(error.code||error.message);process.exitCode=1;});
