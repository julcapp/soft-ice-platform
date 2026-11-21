const adminHeaders = {
  'X-Admin-Role': import.meta.env.VITE_ADMIN_DEMO_ROLE || 'ADMIN',
  'X-Admin-Subject': 'admin-notification-center',
};

async function request(path, options = {}) {
  const response = await fetch(`/api/v1/admin/dashboard${path}`, {
    ...options,
    headers: { ...adminHeaders, ...(options.headers || {}) },
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body?.error?.message || 'Не удалось загрузить уведомления администратора.');
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }
  return body.data;
}

export const getAdminNotifications = ({ signal, limit = 100 } = {}) => request(`/notifications?limit=${limit}`, { signal });
export const markAdminNotificationRead = (notificationKey) => request('/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notificationKey }) });
export const markAllAdminNotificationsRead = () => request('/notifications/read-all', { method: 'POST' });
