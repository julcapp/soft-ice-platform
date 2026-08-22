const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${sessionStorage.getItem('access_token') || ''}`,
});

export async function getMyPhotoPublications({ signal } = {}) {
  const response = await fetch('/api/v1/photo-verification/me/publications', { signal, headers: headers() });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body?.error?.message || 'Не удалось загрузить историю фотографий.');
    error.status = response.status;
    throw error;
  }
  return body.data || [];
}
