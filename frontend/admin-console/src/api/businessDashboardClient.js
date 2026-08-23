const adminHeaders = {
  'X-Admin-Role': import.meta.env.VITE_ADMIN_DEMO_ROLE || 'ADMIN',
  'X-Admin-Subject': 'business-dashboard',
};

async function request(path, { signal } = {}) {
  const response = await fetch(`/api/v1/admin/dashboard${path}`, { signal, headers: adminHeaders });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body?.error?.message || 'Не удалось загрузить данные бизнес-дашборда.');
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }
  return body.data;
}

export async function getBusinessDashboard({ signal, from, to } = {}) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return request(`/business?${params.toString()}`, { signal });
}

export const getFinancialReadiness = ({ signal } = {}) => request('/financial-readiness', { signal });
