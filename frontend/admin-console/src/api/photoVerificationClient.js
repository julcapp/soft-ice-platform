const adminHeaders = {
  'Content-Type': 'application/json',
  'X-Admin-Role': import.meta.env.VITE_ADMIN_DEMO_ROLE || 'ADMIN',
  'X-Admin-Subject': 'photo-verification-settings',
};

async function requestPath(path, options = {}) {
  const response = await fetch(`/api/v1/admin/photo-verification${path}`, {
    ...options,
    headers: { ...adminHeaders, ...options.headers },
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body?.error?.message || 'Не удалось выполнить запрос проверки фотографий.');
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }
  return body.data;
}

const request = (options = {}) => requestPath('/settings', options);
export const getPhotoVerificationSettings = ({ signal } = {}) => request({ signal });
export const updatePhotoVerificationSettings = (patch, { signal } = {}) => request({ signal, method: 'PATCH', body: JSON.stringify(patch) });
export const getPhotoVerificationMetrics = ({ signal, period = '7d' } = {}) => requestPath(`/metrics?period=${encodeURIComponent(period)}`, { signal });
export const getPhotoReviewQueue = ({ signal, limit = 50 } = {}) => requestPath(`/reviews?limit=${encodeURIComponent(limit)}`, { signal });
export const getPhotoReviewItem = (photoChallengeId, { signal } = {}) => requestPath(`/reviews/${encodeURIComponent(photoChallengeId)}`, { signal });
export const submitPhotoReviewDecision = (photoChallengeId, decision, { signal } = {}) => requestPath(`/reviews/${encodeURIComponent(photoChallengeId)}/decision`, {
  signal, method: 'POST', body: JSON.stringify(decision),
});
export const getPhotoOperationalIssues = ({ signal, limit = 100 } = {}) => requestPath(`/operations?limit=${encodeURIComponent(limit)}`, { signal });
export const retryPhotoOperationalIssue = (photoChallengeId, { signal } = {}) => requestPath(`/operations/${encodeURIComponent(photoChallengeId)}/retry`, {
  signal, method: 'POST', body: '{}',
});

export async function getPhotoReviewPreview(photoChallengeId, { signal } = {}) {
  const response = await fetch(`/api/v1/admin/photo-verification/reviews/${encodeURIComponent(photoChallengeId)}/preview`, {
    signal,
    headers: { 'X-Admin-Role': adminHeaders['X-Admin-Role'], 'X-Admin-Subject': 'photo-verification-preview' },
  });
  if (!response.ok) {
    const error = new Error('Не удалось загрузить превью фотографии.');
    error.status = response.status;
    throw error;
  }
  return response.blob();
}
