const test=require('node:test');const assert=require('node:assert/strict');const {manageCustomerAccount}=require('../src/modules/crm/manageCustomerAccount');
const customer={id:'abc',status:'active'};
const repo={findCustomer:async()=>customer,applyAccountAction:async({plan})=>({id:'abc',status:plan.action==='block'?'blocked':'active'}),hasExpiryScheduler:async()=>true};
const context={actorId:'admin1'};
test('reject missing admin identity',async()=>assert.rejects(()=>manageCustomerAccount({repository:repo,audit:async()=>{},customerId:'abc',request:{action:'edit',name:'A'}}),{code:'ADMIN_IDENTITY_REQUIRED'}));
test('reject unsafe deletion without retention review',async()=>assert.rejects(()=>manageCustomerAccount({repository:repo,audit:async()=>{},context,customerId:'abc',request:{action:'delete',reason:'requested',confirmCustomerId:'abc'}}),{code:'CUSTOMER_DELETE_REVIEW_REQUIRED'}));
test('reject expiry when scheduler absent',async()=>assert.rejects(()=>manageCustomerAccount({repository:{...repo,hasExpiryScheduler:async()=>false},audit:async()=>{},context,customerId:'abc',request:{action:'block',reason:'test',until:'2099-01-01'}}),{code:'CUSTOMER_EXPIRY_SCHEDULER_REQUIRED'}));
test('apply validated edit through repository',async()=>{const r=await manageCustomerAccount({repository:repo,audit:async()=>{},context,customerId:'abc',request:{action:'edit',name:'Anna'}});assert.equal(r.id,'abc')});
test('do not write without durable audit',async()=>assert.rejects(()=>manageCustomerAccount({repository:repo,context,customerId:'abc',request:{action:'edit',name:'Anna'}}),TypeError));

