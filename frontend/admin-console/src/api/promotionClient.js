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
    error.details = payload?.error?.details || [];
    throw error;
  }
  return payload?.data ?? payload;
}

export const promotionClient = {
  list: () => request(''),
  get: (id) => request(`/${id}`),
  updateDraft: (id, patch) => request(`/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  createVersion: (id, version = {}) => request(`/${id}/versions`, { method: 'POST', body: JSON.stringify(version) }),
  validate: (id) => request(`/${id}/validate`, { method: 'POST', body: '{}' }),
  requestApproval: (id, reason = null) => request(`/${id}/approval-requests`, { method: 'POST', body: JSON.stringify({ reason }) }),
  approve: (id, reason = null) => request(`/${id}/approve`, { method: 'POST', body: JSON.stringify({ reason }) }),
  reject: (id, reason) => request(`/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  schedule: (id, startsAt, endsAt = null) => request(`/${id}/schedule`, { method: 'POST', body: JSON.stringify({ startsAt, endsAt }) }),
  approvals: (id) => request(`/${id}/approvals`),
  funnel: (id, versionId) => request(`/${id}/channel-funnel${versionId ? `?promotionVersionId=${encodeURIComponent(versionId)}` : ''}`),
  runNow: (id, durationMinutes) => request(`/${id}/run-now`, { method: 'POST', body: JSON.stringify({ durationMinutes }) }),
  pause: (id, reason) => request(`/${id}/pause`, { method: 'POST', body: JSON.stringify({ reason }) }),
  resume: (id, reason) => request(`/${id}/resume`, { method: 'POST', body: JSON.stringify({ reason }) }),
  end: (id, reason) => request(`/${id}/end`, { method: 'POST', body: JSON.stringify({ reason }) }),
  emergencyStop: (id, reason) => request(`/${id}/emergency-stop`, { method: 'POST', body: JSON.stringify({ reason }) }),
  safetyCheck: (id) => request(`/${id}/safety-check`, { method: 'POST', body: '{}' }),
};
