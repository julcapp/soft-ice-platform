const { ApiError } = require('../../platform/errors/ApiError');
function assertCustomerAccess(customer, now = new Date()) {
  if (!customer) return;
  if (customer.deletedAt || customer.status === 'deleted') throw new ApiError({ statusCode: 403, code: 'CUSTOMER_ACCOUNT_DELETED', message: 'Учётная запись удалена.' });
  if (customer.status === 'blocked' && (!customer.blockedUntil || new Date(customer.blockedUntil) > now)) throw new ApiError({ statusCode: 403, code: 'CUSTOMER_ACCOUNT_BLOCKED', message: 'Учётная запись заблокирована.' });
}
function effectiveCustomerStatus(customer, now = new Date()) {
  return customer.status === 'blocked' && customer.blockedUntil && new Date(customer.blockedUntil) <= now ? 'active' : customer.status;
}
module.exports = { assertCustomerAccess, effectiveCustomerStatus };
