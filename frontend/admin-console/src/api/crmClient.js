const headers = { 'X-Admin-Role': 'PROJECT_ADMIN', 'X-Admin-Subject': 'crm-workspace' };

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
