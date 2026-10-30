const test=require('node:test');const assert=require('node:assert/strict');
const {releaseExpiredBlocks}=require('../src/modules/crm/customerBlockExpiry');
test('rejects missing audit implementation',async()=>{await assert.rejects(()=>releaseExpiredBlocks({repository:{releaseExpiredBlocks:async()=>[]}}))});
test('reports every released block to audit',async()=>{const events=[];const count=await releaseExpiredBlocks({repository:{releaseExpiredBlocks:async()=>[{id:'a'},{id:'b'}]},audit:async(e)=>events.push(e),clock:()=>new Date('2026-10-30T12:00:00Z')});assert.equal(count,2);assert.deepEqual(events.map(x=>x.customerId),['a','b'])});

