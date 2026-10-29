const headers = { 'X-Admin-Role': 'PROJECT_ADMIN', 'X-Admin-Subject': 'crm-workspace', 'Content-Type': 'application/json' };

async function request(path, options = {}) {
  const response = await fetch(`/api/v1/admin/crm${path}`, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) {
    const error = new Error('Не удалось загрузить данные CRM.');
    error.status = response.status;
    throw error;
  }
  return (await response.json()).data;
}

export const getCRMDashboard = ({ signal } = {}) => request('/dashboard', { signal });
export const getCRMCustomers = ({ signal, query = '' } = {}) => request(`/customers?query=${encodeURIComponent(query)}`, { signal });
export const getCRMCustomer = (customerId, { signal } = {}) => request(`/customers/${customerId}`, { signal });

export const updateCRMCustomer = (customerId, payload, { signal, idempotencyKey } = {}) => request(`/customers/${customerId}`, { method: 'PATCH', signal, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined, body: JSON.stringify(payload) });
export const topUpCRMCustomer = (customerId, payload, { signal, idempotencyKey } = {}) => request(`/customers/${customerId}/top-ups`, { method: 'POST', signal, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined, body: JSON.stringify(payload) });
export const assignCRMSegment = (customerId, segmentId, payload = {}, { signal, idempotencyKey } = {}) => request(`/customers/${customerId}/segments/${segmentId}`, { method: 'POST', signal, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined, body: JSON.stringify(payload) });
export const queueCRMNotification = (customerId, payload, { signal, idempotencyKey } = {}) => request(`/customers/${customerId}/notifications`, { method: 'POST', signal, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined, body: JSON.stringify(payload) });
export const createCRMCampaign = (payload, { signal, idempotencyKey } = {}) => request('/campaigns', { method: 'POST', signal, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined, body: JSON.stringify(payload) });

export const adjustCRMCustomerBonus = (customerId, payload, { signal, idempotencyKey } = {}) => request(`/customers/${customerId}/bonus-adjustments`, { method: 'POST', signal, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined, body: JSON.stringify(payload) });
export const eraseAndReleaseCRMCustomer = (customerId, payload = {}, { signal, idempotencyKey } = {}) => request(`/customers/${customerId}/erase-and-release`, { method: 'POST', signal, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined, body: JSON.stringify(payload) });
