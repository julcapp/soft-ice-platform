'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {summarizePointShift}=require('../src/modules/timopos/TimoPosShiftSummary');
const point={id:'point-1',code:'001',name:'Точка №001'};
const seller={id:'seller-1',fullName:'Иванов Иван Иванович'};
const shift={id:'shift-1',status:'OPEN',startedAt:'2026-11-14T08:00:00Z'};
const tx=(id,method,amountKopecks,status='SUCCEEDED',more={})=>
 ({id,method,amountKopecks,status,shiftId:shift.id,pointId:point.id,sellerId:seller.id,...more});
const issue=(id,amountKopecks,more={})=>({id,amountKopecks,status:'ISSUED',
 shiftId:shift.id,pointId:point.id,sellerId:seller.id,prepaid:true,
 prepaidOrderId:'order-'+id,paymentVerified:true,...more});
test('admin and POS see cash, cashless, prepaid issued and two distinct totals',()=>{
 const t=[tx('cash','CASH',100000,'CASH_CONFIRMED',{fiscalized:true}),
 tx('card','CARD',45000,'SUCCEEDED',{verifiedByBackend:true}),
 tx('sbp','SBP',25000,'SUCCEEDED',{verifiedByBackend:true})];
 const result=summarizePointShift({point,seller,shift,transactions:t,issues:[issue('a',30000)]});
 assert.equal(result.point.code,'001');assert.equal(result.seller.fullName,'Иванов Иван Иванович');
 assert.equal(result.totals.cashKopecks,100000);
 assert.equal(result.totals.cashlessKopecks,70000);
 assert.equal(result.totals.prepaidIssuedKopecks,30000);
 assert.equal(result.totals.currentShiftRevenueKopecks,170000);
 assert.equal(result.totals.servicedValueKopecks,200000);
 assert.equal(result.totals.prepaidIssues,1);
});
test('prepaid issue does not count as new cash or cashless revenue',()=>{
 const r=summarizePointShift({point,seller,shift,issues:[issue('one',15900)]});
 assert.equal(r.totals.currentShiftRevenueKopecks,0);
 assert.equal(r.totals.prepaidIssuedKopecks,15900);
});
test('failed/pending payments and pending issues do not count',()=>{
 const r=summarizePointShift({point,seller,shift,transactions:[tx('a','CARD',30000,'PENDING'),
 tx('b','SBP',20000,'FAILED')],issues:[issue('p',10000,{status:'PENDING'})]});
 assert.equal(r.totals.currentShiftRevenueKopecks,0);
 assert.equal(r.totals.prepaidIssuedKopecks,0);
});
test('unverified bank payment or prepaid issue cannot inflate totals',()=>{
 assert.throws(()=>summarizePointShift({point,seller,shift,
 transactions:[tx('card','CARD',10000,'SUCCEEDED',{verifiedByBackend:false})]}),{code:'UNVERIFIED_PAYMENT'});
 assert.throws(()=>summarizePointShift({point,seller,shift,
 issues:[issue('p',10000,{paymentVerified:false})]}),{code:'PREPAID_NOT_VERIFIED'});
});
test('refunds are separate and may result in negative net shift revenue',()=>{
 const r=summarizePointShift({point,seller,shift,transactions:[
 tx('r','CARD',12000,'REFUNDED')]});
 assert.equal(r.totals.refundKopecks,12000);
 assert.equal(r.totals.netRevenueKopecks,-12000);
});
test('duplicate transaction or issue is rejected, not double counted',()=>{
 assert.throws(()=>summarizePointShift({point,seller,shift,
 transactions:[tx('x','CARD',100,'SUCCEEDED',{verifiedByBackend:true}),
 tx('x','CARD',100,'SUCCEEDED',{verifiedByBackend:true})]}),{code:'DUPLICATE_TRANSACTION'});
 assert.throws(()=>summarizePointShift({point,seller,shift,issues:[issue('one',100),issue('one',100)]}),{code:'DUPLICATE_ISSUE'});
});
test('foreign seller/point/shift events are not allowed in a summary',()=>{
 assert.throws(()=>summarizePointShift({point,seller,shift,
 transactions:[tx('x','CASH',100,'CASH_CONFIRMED',{fiscalized:true,pointId:'other'})]}),{code:'SCOPE_MISMATCH'});
 assert.throws(()=>summarizePointShift({point,seller,shift,
 issues:[issue('x',100,{sellerId:'other'})]}),{code:'SCOPE_MISMATCH'});
});
