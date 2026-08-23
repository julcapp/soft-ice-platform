const BASE = '/api/v1/admin/promotions';

function headers(json = false) {
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    'X-Admin-Role': import.meta.env.VITE_ADMIN_DEMO_ROLE || 'ADMIN',
  };
}

async function request(path = '', options = {}) {
  const response = await fetch(`${BASE}${path}`, { ...options, headers: { ...headers(Boolean(options.body)), ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'Promotion Engine request failed.');
    error.status = response.status;
    error.code = payload?.error?.code || 'PROMOTION_ADMIN_REQUEST_FAILED';
    throw error;
  }
  return payload?.data ?? payload;
}

export const promotionClient = {
  list: () => request(''),
  get: (id) => request(`/${id}`),
  approvals: (id) => request(`/${id}/approvals`),
  funnel: (id, versionId) => request(`/${id}/channel-funnel${versionId ? `?promotionVersionId=${encodeURIComponent(versionId)}` : ''}`),
  runNow: (id, durationMinutes) => request(`/${id}/run-now`, { method: 'POST', body: JSON.stringify({ durationMinutes }) }),
  pause: (id, reason) => request(`/${id}/pause`, { method: 'POST', body: JSON.stringify({ reason }) }),
  resume: (id, reason) => request(`/${id}/resume`, { method: 'POST', body: JSON.stringify({ reason }) }),
  end: (id, reason) => request(`/${id}/end`, { method: 'POST', body: JSON.stringify({ reason }) }),
  emergencyStop: (id, reason) => request(`/${id}/emergency-stop`, { method: 'POST', body: JSON.stringify({ reason }) }),
  safetyCheck: (id) => request(`/${id}/safety-check`, { method: 'POST', body: '{}' }),
};
