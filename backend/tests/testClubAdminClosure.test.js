const test=require('node:test'),assert=require('node:assert/strict');
const {readTestClubAccount,readTestClubTopups,listPlatformTestTopups}=require('../src/modules/club_account/TestClubAdminProjection');
const {recordTestClubTopupMessage,backfillConfirmedTopupMessages}=require('../src/modules/club_account/TestClubTopupMessage');
test('test account sums confirmed credits minus debits independently from real funds',async()=>{
 const account=await readTestClubAccount({$queryRawUnsafe:async(sql,id)=>{assert.equal(id,'buyer');assert.match(sql,/status='SUCCEEDED'/);return [{creditCents:15000n,debitCents:700n}];}},'buyer');
 assert.deepEqual(account,{test:true,currency:'RUB',availableBalanceRub:143,creditedRub:150,debitedRub:7});
 await assert.rejects(readTestClubAccount({$queryRawUnsafe:async()=>[{creditCents:0,debitCents:1}]},'buyer'),{code:'CLUB_TEST_BALANCE_INVALID'});
});
test('test topup history is masked and not refundable; no invented receipt/commission/method',async()=>{
 const [row]=await readTestClubTopups({$queryRawUnsafe:async()=>[{id:'topup',status:'SUCCEEDED',amountCents:15000,providerPaymentId:'provider-secret-reference',confirmedAt:new Date()}]},'buyer');
 assert.equal(row.amountRub,150);assert.equal(row.test,true);assert.equal(row.refundAllowed,false);assert.equal(row.paymentMethodType,'UNKNOWN');assert.equal(row.economics,null);assert.ok(!JSON.stringify(row).includes('provider-secret-reference'));
});
test('pooled topups stay invisible to tenant admins and organization-filtered views',async()=>{
 let calls=0;const prisma={$queryRawUnsafe:async()=>{calls++;return [];} };
 for(const scope of [{},{platform:false},{platform:true,organizationId:'org'}])assert.deepEqual(await listPlatformTestTopups(prisma,{},scope),[]);
 assert.deepEqual(await listPlatformTestTopups(prisma,{provider:'OTHER'},{platform:true}),[]);assert.equal(calls,0);
 await listPlatformTestTopups(prisma,{status:'SUCCEEDED'},{platform:true});assert.equal(calls,1);
});
test('confirmation journal is idempotent and AVAILABLE without invented delivery times',async()=>{
 const sql=[];const tx={$executeRawUnsafe:async(query,...args)=>{sql.push({query,args});return 1;}};
 const row={id:'topup',customerId:'buyer',test:true,status:'SUCCEEDED',amountCents:15000,confirmedAt:new Date('2026-10-19T05:12:17Z'),providerPaymentId:'provider'};
 await recordTestClubTopupMessage(tx,row,new Date('2026-10-19T06:00:00Z'));assert.equal(sql.length,2);
 assert.match(sql[0].query,/ON CONFLICT.*DO NOTHING/);assert.match(sql[1].query,/'MINI_APP','AVAILABLE'/);assert.ok(!sql[1].query.includes('sentAt'));assert.ok(!sql[1].query.includes('DELIVERED'));assert.ok(sql[0].args.includes(row.id));
 for(const change of [{test:false},{status:'PENDING'},{confirmedAt:null},{providerPaymentId:null}])assert.equal(await recordTestClubTopupMessage(tx,{...row,...change}),null);
 assert.equal(sql.length,2);
});
test('historical repair writes only the missing journal, never financial postings or sends',async()=>{
 const result=await backfillConfirmedTopupMessages({$queryRawUnsafe:async sql=>{assert.match(sql,/NOT EXISTS/);return [];}});assert.deepEqual(result,{journaled:0,financialPostings:0,externalSends:0});
});
