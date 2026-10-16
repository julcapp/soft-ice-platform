const test = require('node:test');
const assert = require('node:assert/strict');
const { MiniAppTestClubPurchaseService, testBalanceCents, orderCents, PROVIDER } = require('../src/modules/club_account/MiniAppTestClubPurchaseService');
function fixture({ funds = 15000, amount = 70 } = {}) {
  const state = { funds, debits: [], payments: [], events: [], audits: [], orders: ['a','b'].map(id => ({ id, customerId:'buyer', machineId:'TEST-MACHINE-001', status:'PAYMENT_PENDING', amount, currency:'RUB' })), flows: ['a','b'].map(id => ({ flowId:'flow-'+id, orderId:id, customerId:'buyer', machineId:'TEST-MACHINE-001', organizationId:'org', currentState:'AWAITING_PAYMENT', metadata:{ sourceChannel:'MINIAPP', fulfillmentMode:'PICKUP' } })) };
  let tail = Promise.resolve(), locked = false;
  const match = (rows, where) => rows.find(row => Object.entries(where).every(([key,value]) => row[key] === value));
  const tx = {
    $queryRawUnsafe: async (sql, a, b) => {
      if (sql.includes('pg_advisory')) { locked = true; return []; }
      if (sql.includes('FOR UPDATE')) { assert.ok(locked); return []; }
      if (sql.includes(' AS cents')) return [{ cents: state.funds - state.debits.reduce((sum,d)=>sum+d.amountCents,0) }];
      if (sql.includes('SELECT * FROM "MiniAppTestClubDebit"')) return state.debits.filter(d=>d.orderId===a&&d.customerId===b);
      throw Error(sql);
    },
    $executeRawUnsafe: async (sql,...args) => {
      if (sql.startsWith('UPDATE "Payment"')) return 1;
      assert.ok(sql.startsWith('INSERT INTO "MiniAppTestClubDebit"'));
      const [id,customerId,orderId,paymentId,amountCents] = args;
      state.debits.push({id,customerId,orderId,paymentId,amountCents}); return 1;
    },
    order: { findFirst: async ({where})=>match(state.orders,where), updateMany: async ({where,data})=>{ const row=state.orders.find(o=>o.id===where.id&&(typeof where.status==='string'?o.status===where.status:where.status.in.includes(o.status)));if(!row)return {count:0};Object.assign(row,data);return {count:1}; }, update: async ({where,data})=>Object.assign(match(state.orders,where),data) },
    saleFlow: { findFirst: async ({where})=>match(state.flows,where), update: async ({where,data})=>Object.assign(match(state.flows,where),data) },
    payment: { findUnique: async ({where})=>match(state.payments,where), create: async ({data})=>{ state.payments.push(data);return data; } },
    paymentAuditEntry: { create: async ({data})=>state.audits.push(data) },
    customerTimelineEvent: { create: async ({data})=>state.events.push(data) },
  };
  const prisma = { $transaction: fn => {
    const result = tail.then(async()=>{const saved=structuredClone(state);try{return await fn(tx);}catch(e){Object.assign(state,saved);throw e;}finally{locked=false;}});
    tail=result.catch(()=>{});return result;
  } };
  return { state, tx, prisma, service:new MiniAppTestClubPurchaseService({prisma,clock:()=>new Date('2026-10-16T11:00:00Z')}) };
}
test('one atomic test debit, common 72h pickup state, no bank/real wallet calls; replay once', async()=>{
  const f=fixture();const [first,repeat]=await Promise.all([f.service.pay({id:'buyer'},'a'),f.service.pay({id:'buyer'},'a')]);
  assert.equal(first.balanceRub,80);assert.equal(repeat.duplicate,true);assert.equal(f.state.debits.length,1);assert.equal(f.state.events.length,1);assert.equal(f.state.audits.length,1);
  assert.equal(f.state.payments[0].provider,PROVIDER);assert.equal(f.state.payments[0].providerPaymentId,undefined);assert.equal(f.state.payments[0].metadata.test,true);
  assert.equal(f.state.orders[0].status,'PAID');assert.equal(f.state.orders[0].expiresAt.toISOString(),'2026-10-19T11:00:00.000Z');assert.equal(f.state.flows[0].currentState,'PAID');
});
test('different orders cannot overdraw a wallet',async()=>{
  const f=fixture({funds:10000});const results=await Promise.allSettled([f.service.pay({id:'buyer'},'a'),f.service.pay({id:'buyer'},'b')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'CLUB_TEST_INSUFFICIENT_FUNDS');assert.equal(f.state.debits.length,1);
});
test('foreign buyer, real machine and pending bank checkout cannot spend test funds',async()=>{
  const f=fixture();await assert.rejects(f.service.pay({id:'other'},'a'),{code:'PREORDER_NOT_FOUND'});
  f.state.orders[0].machineId='REAL';await assert.rejects(f.service.pay({id:'buyer'},'a'),{code:'CLUB_TEST_MACHINE_REQUIRED'});
  f.state.orders[0].machineId='TEST-MACHINE-001';f.state.payments.push({id:'bank',orderId:'a',provider:'YOOKASSA',status:'PENDING'});
  await assert.rejects(f.service.pay({id:'buyer'},'a'),{code:'CLUB_PAYMENT_ALREADY_SELECTED'});assert.equal(f.state.debits.length,0);
});
test('a downstream failure rolls back debit, payment and order together',async()=>{
  const f=fixture();f.tx.customerTimelineEvent.create=async()=>{throw Error('timeline failure');};
  await assert.rejects(f.service.pay({id:'buyer'},'a'),/timeline failure/);assert.equal(f.state.payments.length,0);assert.equal(f.state.debits.length,0);assert.equal(f.state.orders[0].status,'PAYMENT_PENDING');
});
test('only completed TEST credits minus TEST debits count; invalid money fails closed',async()=>{
  const cents=await testBalanceCents({$queryRawUnsafe:async sql=>{assert.match(sql,/status='SUCCEEDED' AND test=TRUE/);assert.match(sql,/MiniAppTestClubDebit/);return [{cents:1234n}];}},'buyer');assert.equal(cents,1234);
  await assert.rejects(testBalanceCents({$queryRawUnsafe:async()=>[{cents:-1}]},'buyer'),{code:'CLUB_TEST_BALANCE_INVALID'});
  for(const amount of [0,-1,1.001,Infinity,999999999])assert.throws(()=>orderCents({amount,currency:'RUB'}));
  assert.throws(()=>orderCents({amount:10,currency:'USD'}));assert.equal(orderCents({amount:19.99,currency:'RUB'}),1999);
});

test('canceling test orders or expiring test gifts cannot credit a real ClubAccount',async()=>{
  const {ClubAccountRuntime}=require('../src/modules/club_account/ClubAccountRuntime');
  const runtime=new ClubAccountRuntime({clubAccountRepository:{findByCustomerId:async()=>{throw Error('Real wallet must not be read or created');}}});
  for(const order of [{paymentMethod:'test_club_account'},{machineId:'TEST-MACHINE-001'},{payment:{provider:'TEST_CLUB_ACCOUNT'}},{payment:{metadata:{test:true}}}]) {
    await assert.rejects(runtime.creditOrderReturn('buyer',{amount:70,...order}),{code:'TEST_ORDER_REAL_CREDIT_FORBIDDEN'});
  }
});
