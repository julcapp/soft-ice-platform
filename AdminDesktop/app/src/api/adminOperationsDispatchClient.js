const adminHeaders = {
  'X-Admin-Role': import.meta.env.VITE_ADMIN_DEMO_ROLE || 'ADMIN',
  'X-Admin-Subject': import.meta.env.VITE_ADMIN_DEMO_SUBJECT || 'platform-owner',
};

async function request(path, options = {}) {
  const response = await fetch(`/api/v1/admin/dashboard${path}`, {
    ...options,
    headers: { ...adminHeaders, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || 'Не удалось выполнить операцию диспетчерской.');
  return body.data;
}

export function getOperationsDispatch({ category = 'ALL', severity = 'ALL', status = 'ALL', signal } = {}) {
  const params = new URLSearchParams({ category, severity, status, limit: '200' });
  return request(`/operations-dispatch?${params.toString()}`, { signal });
}
export function updateOperationsWorkItem(payload) {
  return request('/operations-dispatch/update', { method: 'POST', body: JSON.stringify(payload) });
}
export function getOperationsHistory(notificationKey, { signal } = {}) {
  return request(`/operations-dispatch/history?notificationKey=${encodeURIComponent(notificationKey)}`, { signal });
}
export function getServiceSpecialistCard(subject, { signal } = {}) {
  return request(`/operations-dispatch/specialist?subject=${encodeURIComponent(subject)}`, { signal });
}
