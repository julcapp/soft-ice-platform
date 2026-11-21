export function adminAuthHeaders(extra = {}) {
  const token = typeof sessionStorage === 'undefined' ? '' : sessionStorage.getItem('admin_session_token') || '';
  return { ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
