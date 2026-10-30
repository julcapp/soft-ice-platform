'use strict';
const { planCustomerAction } = require('./customerAccountActionPolicy');
function error(message, code, statusCode = 422) { return Object.assign(new Error(message), {code,statusCode}); }
async function manageCustomerAccount({repository, audit, customerId, request, context, clock = () => new Date()}) {
 if (!repository || typeof repository.findCustomer !== 'function' || typeof repository.applyAccountAction !== 'function') throw new TypeError('Account repository capabilities missing');
 if (typeof audit !== 'function') throw new TypeError('Audit callback required');
 if (!context?.actorId) throw error('Admin identity required', 'ADMIN_IDENTITY_REQUIRED',403);
 if (!customerId || typeof customerId !== 'string') throw error('Invalid customer ID', 'INVALID_CUSTOMER_ID');
 const customer=await repository.findCustomer(customerId);
 if (!customer) throw error('Customer not found','CUSTOMER_NOT_FOUND',404);
 let plan;
 try { plan=planCustomerAction(customer,request,clock()); }
 catch (e) { throw error(e.message,e.message); }
 if (plan.action==='delete') throw error('Retention review is required before deletion','CUSTOMER_DELETE_REVIEW_REQUIRED',409);
 if (plan.requiresScheduler && typeof repository.hasExpiryScheduler==='function' && !(await repository.hasExpiryScheduler())) throw error('Expiry scheduler is not enabled','CUSTOMER_EXPIRY_SCHEDULER_REQUIRED',409);
 // The repository must commit the mutation and durable audit atomically.
 const updated=await repository.applyAccountAction({customerId,plan,actorId:context.actorId,correlationId:context.correlationId,audit});
 return updated;
}
module.exports={manageCustomerAccount};

