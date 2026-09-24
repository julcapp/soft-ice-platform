const BASE = '/api/v1/admin/catalog';
const headers = { 'Content-Type': 'application/json', 'X-Admin-Role': import.meta.env.VITE_ADMIN_DEMO_ROLE || 'ADMIN' };

async function request(path = '', options = {}) {
  const response = await fetch(`${BASE}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload?.error?.message || 'Не удалось обновить каталог.'), { status: response.status, code: payload?.error?.code });
  return payload.data;
}

export const catalogClient = {
  list: ({ signal } = {}) => request('/items', { signal }),
  create: (item) => request('/items', { method: 'POST', body: JSON.stringify(item) }),
  update: (id, patch) => request(`/items/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  updatePrice: (id, value) => request(`/items/${encodeURIComponent(id)}/price`, { method: 'PATCH', body: JSON.stringify(value) }),
  setAvailability: (machineId, itemId, available) => request(`/machines/${encodeURIComponent(machineId)}/items/${encodeURIComponent(itemId)}`, { method: 'PUT', body: JSON.stringify({ available }) }),
  setCurrentFlavor: (machineId, catalogItemId) => request(`/machines/${encodeURIComponent(machineId)}/current-flavor`, { method: 'PUT', body: JSON.stringify({ catalogItemId }) }),
};
