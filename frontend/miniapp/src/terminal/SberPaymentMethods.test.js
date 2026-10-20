import {test} from 'node:test';import assert from 'node:assert/strict';
import {getTerminalPaymentMethods} from './TerminalPaymentApi.js';
test('Sber availability comes only from its gateway and does not enable POS or YooKassa SBP',async()=>{
 const original=globalThis.fetch;
 try{
 globalThis.fetch=async url=>({ok:true,json:async()=>String(url).includes('sber-sbp')?{data:{available:false,reasonCode:'SBER_QR_NOT_CONFIGURED'}}:{data:{attributes:{methods:[{id:'sbp',available:false},{id:'test_card',available:true}]}}}});
 const methods=await getTerminalPaymentMethods({machineId:'M1'});assert.equal(methods.find(x=>x.id==='sber_sbp').available,false);assert.equal(methods.find(x=>x.id==='sbp').available,false);assert.equal(methods.find(x=>x.id==='test_card').available,true);
 globalThis.fetch=async url=>({ok:!String(url).includes('sber-sbp'),json:async()=>({data:{attributes:{methods:[]}}})});
 assert.equal((await getTerminalPaymentMethods({machineId:'M1'})).find(x=>x.id==='sber_sbp').available,false);
 }finally{globalThis.fetch=original;}
});
