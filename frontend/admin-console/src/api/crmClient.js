const headers = { 'X-Admin-Role': 'PROJECT_ADMIN', 'X-Admin-Subject': 'crm-workspace' };

async function request(path, options = {}) {
  const response = await fetch(`/api/v1/admin/crm${path}`, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload?.error?.message || 'Не удалось загрузить данные CRM.');
    error.status = response.status;
    error.code = payload?.error?.code;
    throw error;
  }
  return (await response.json()).data;
}

export const getCRMDashboard = ({ signal } = {}) => request('/dashboard', { signal });
export const getCRMCustomers = ({ signal, query = '', limit = 100 } = {}) => request(`/customers?query=${encodeURIComponent(query)}&limit=${limit}`, { signal });
export const getCRMCustomer = (customerId, { signal } = {}) => request(`/customers/${customerId}`, { signal });
export const queueCRMNotification = (customerId, { channel, body, subject = null }, { idempotencyKey } = {}) => request(`/customers/${customerId}/notifications`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
  body: JSON.stringify({ channel, body, subject }),
});
