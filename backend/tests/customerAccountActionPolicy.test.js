const test=require('node:test');const assert=require('node:assert/strict');const {planCustomerAction}=require('../src/modules/crm/customerAccountActionPolicy');
const c={id:'customer-001',status:'active'};
test('edit validates name',()=>{assert.equal(planCustomerAction(c,{action:'edit',name:' Иван '}).name,'Иван');assert.throws(()=>planCustomerAction(c,{action:'edit',name:' '}))});
test('block requires reason',()=>{assert.throws(()=>planCustomerAction(c,{action:'block'}));assert.equal(planCustomerAction(c,{action:'block',reason:'moderation'}).action,'block')});
test('temporary block requires future date and scheduler',()=>{assert.throws(()=>planCustomerAction(c,{action:'block',reason:'x',until:'2020-01-01'},new Date('2026-10-30')));assert.equal(planCustomerAction(c,{action:'block',reason:'x',until:'2026-11-01'},new Date('2026-10-30')).requiresScheduler,true)});
test('unblock only blocked user',()=>{assert.throws(()=>planCustomerAction(c,{action:'unblock',reason:'x'}));assert.equal(planCustomerAction({...c,status:'blocked'},{action:'unblock',reason:'approved'}).action,'unblock')});
test('delete requires id confirmation and retention review',()=>{assert.throws(()=>planCustomerAction(c,{action:'delete',reason:'x',confirmCustomerId:'other'}));assert.equal(planCustomerAction(c,{action:'delete',reason:'x',confirmCustomerId:c.id}).requiresRetentionReview,true)});
test('deleted identities cannot be modified',()=>assert.throws(()=>planCustomerAction({...c,status:'deleted_released'},{action:'edit',name:'Test'})));

