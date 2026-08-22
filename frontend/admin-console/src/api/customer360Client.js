const headers = { 'X-Admin-Role': 'ADMIN', 'X-Admin-Subject': 'customer-360-workspace' };
async function request(path, options = {}) {
  const response = await fetch(`/api/v1/admin/customer-360${path}`, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body?.error?.message || 'Не удалось выполнить запрос Customer 360.');
    error.code = body?.error?.code;
    throw error;
  }
  return (await response.json()).data;
}
export const getCustomer360 = (customerId, { signal } = {}) => request(`/customers/${customerId}`, { signal });
export const getCustomerTimeline = (customerId, { signal } = {}) => request(`/customers/${customerId}/timeline`, { signal });
export const getCustomerPaymentProfile = (customerId, { signal } = {}) => request(`/customers/${customerId}/payment-profile`, { signal });
export const createCustomerRefund = (customerId, payload, { idempotencyKey } = {}) => request(`/customers/${customerId}/refunds`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) }, body: JSON.stringify(payload) });
async function requestAdmin(path, { signal } = {}) {
  const response = await fetch(`/api/v1/admin/customers${path}`, { signal, headers });
  if (!response.ok) throw new Error('Не удалось загрузить внешние каналы клиента.');
  return (await response.json()).data;
}
export const getExternalChannels = (customerId, options) => requestAdmin(`/${customerId}/external-channels`, options);
export const getCustomerEngagement = (customerId, options) => requestAdmin(`/${customerId}/engagement`, options);
