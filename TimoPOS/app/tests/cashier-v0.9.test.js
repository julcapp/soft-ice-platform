'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../prototype-v0.9/cashier.html'),'utf8');
const code=html.match(/<script id="app">([\s\S]*?)<\/script>/);
assert.ok(code,'inline demo logic exists');
const scope={module:{exports:{}},console};
vm.runInNewContext(code[1],scope,{timeout:500});
const {CATALOG,TAX,kopecks,fmt,calc}=scope.module.exports;
const product=(sku,qty=1)=>({...CATALOG.find(x=>x.sku===sku),qty});
test('demo is explicitly offline and has no external script/style dependencies',()=>{
 assert.match(html,/ККТ не подключена/);
 assert.match(html,/без реальных платежей/);
 assert.doesNotMatch(html,/<script\s+src=|https?:\/\/|<iframe\b|@import/i);
});
test('catalog separates commodity and service, with VAT and without VAT',()=>{
 assert.ok(CATALOG.some(x=>x.kind==='service'));
 assert.ok(CATALOG.some(x=>x.kind==='commodity'));
 for(const x of CATALOG)assert.ok(TAX[x.vat]);
 for(const name of ['NO_VAT','22','10','5','7','0'])assert.ok(TAX[name]);
});
test('cash parses integer kopecks, rejects non-money and precision > 2',()=>{
 assert.equal(kopecks('300.50'),30050);
 assert.equal(kopecks('300,50'),30050);
 assert.equal(kopecks('0'),0);
 assert.equal(kopecks('12.345'),null);
 assert.equal(kopecks('-1'),null);
 assert.equal(kopecks('1e3'),null);
});
test('mixed cart totals 95 rub commodity plus 30 rub service',()=>{
 const result=calc([product('ICE-01'),product('SERV-01')]);
 assert.equal(result.total,12500);
 assert.equal(result.breakdown['22'].gross,9500);
 assert.equal(result.breakdown['7'].gross,3000);
 assert.equal(result.breakdown['22'].vat,Math.round(9500*22/122));
 assert.equal(result.breakdown['7'].vat,Math.round(3000*7/107));
});
test('NO_VAT and zero rated VAT stay separate groups',()=>{
 const result=calc([product('TOP-01'),product('SERV-02')]);
 assert.equal(result.breakdown.NO_VAT.vat,0);
 assert.equal(result.breakdown['0'].vat,0);
 assert.equal(Object.keys(result.breakdown).length,2);
});
test('quantity changes update total in integer kopecks',()=>{
 assert.equal(calc([product('ICE-01',3)]).total,28500);
 assert.throws(()=>calc([product('ICE-01',0)]),/BAD_QTY/);
});
test('issuance button requires staged payment and demo receipt confirmation',()=>{
 assert.match(html,/if\(!pay\|\|!fiscal\|\|issued\)return/);
 assert.match(html,/if\(!pickup\|\|!pickupFiscal\|\|pickupIssued\)return/);
});
test('X-report excludes prepaid fulfilments from point revenue',()=>{
 assert.match(html,/operations\.filter\(x=>x\.kind==="SALE"\)/);
 assert.match(html,/operations\.filter\(x=>x\.kind==="PREPAID_ISSUE"\)/);
 assert.match(html,/Предоплаченные выдачи не увеличивают выручку точки/);
});
test('prepaid demo forbids issuing without confirmation',()=>{
 assert.match(html,/pickup=\$\("pickup"\)\.value==="123456"/);
 assert.match(html,/pickupFiscal=true/);
});
