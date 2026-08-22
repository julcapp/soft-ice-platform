const adminHeaders = {
  'Content-Type': 'application/json',
  'X-Admin-Role': import.meta.env.VITE_ADMIN_DEMO_ROLE || 'ADMIN',
  'X-Admin-Subject': 'photo-verification-settings',
};

async function request(options = {}) {
  const response = await fetch('/api/v1/admin/photo-verification/settings', {
    ...options,
    headers: { ...adminHeaders, ...options.headers },
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body?.error?.message || 'Не удалось загрузить настройки проверки фотографий.');
    error.status = response.status;
    throw error;
  }
  return body.data;
}

export const getPhotoVerificationSettings = ({ signal } = {}) => request({ signal });
export const updatePhotoVerificationSettings = (patch, { signal } = {}) => request({
  signal,
  method: 'PATCH',
  body: JSON.stringify(patch),
});
