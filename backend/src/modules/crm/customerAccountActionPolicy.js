'use strict';
const ACTIONS = new Set(['edit','block','unblock','delete']);
function planCustomerAction(customer, request, now = new Date()) {
 if(!customer || !customer.id) throw new Error('CUSTOMER_NOT_FOUND');
 if(!request || !ACTIONS.has(request.action)) throw new Error('INVALID_ACTION');
 if(customer.status === 'deleted_released') throw new Error('CUSTOMER_ALREADY_DELETED');
 const reason=String(request.reason || '').trim();
 if (request.action==='edit') {
  const name=String(request.name||'').trim();
  if(!name || name.length>200) throw new Error('INVALID_NAME');
  return {action:'edit',name};
 }
 if (request.action==='block') {
  if(customer.status==='blocked') throw new Error('ALREADY_BLOCKED');
  if(!reason || reason.length>2000) throw new Error('BLOCK_REASON_REQUIRED');
  if(request.until) {
   const until=new Date(request.until);
   if(!Number.isFinite(until.getTime()) || until<=now) throw new Error('INVALID_BLOCK_EXPIRY');
   return {action:'block',reason,until:until.toISOString(),requiresScheduler:true};
  }
  return {action:'block',reason,until:null,requiresScheduler:false};
 }
 if(request.action==='unblock') {
  if(customer.status!=='blocked') throw new Error('NOT_BLOCKED');
  if(!reason || reason.length>2000) throw new Error('UNBLOCK_REASON_REQUIRED');
  return {action:'unblock',reason};
 }
 if(request.confirmCustomerId!==customer.id) throw new Error('DELETE_CONFIRMATION_MISMATCH');
 if(!reason || reason.length>2000) throw new Error('DELETE_REASON_REQUIRED');
 return {action:'delete',reason,requiresRetentionReview:true};
}
module.exports={planCustomerAction};

