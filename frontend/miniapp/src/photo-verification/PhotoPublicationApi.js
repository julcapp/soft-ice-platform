const authHeaders = () => ({ Authorization: `Bearer ${sessionStorage.getItem('access_token') || ''}` });

async function parse(response, fallback) {
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body?.error?.message || fallback);
    error.status = response.status;
    throw error;
  }
  return body.data;
}

export async function getMyPhotoPublications({ signal } = {}) {
  const response = await fetch('/api/v1/photo-verification/me/publications', { signal, headers: authHeaders() });
  return parse(response, 'Не удалось загрузить историю фотографий.');
}

export async function getActivePhotoChallenge({ signal } = {}) {
  const response = await fetch('/api/v1/photo-verification/me/challenges/active', { signal, headers: authHeaders() });
  return parse(response, 'Не удалось получить активное фотозадание.');
}

export async function submitChallengePhoto(photoChallengeId, blob, { signal } = {}) {
  const response = await fetch(`/api/v1/photo-verification/me/challenges/${encodeURIComponent(photoChallengeId)}/photo`, {
    method: 'POST',
    signal,
    headers: { ...authHeaders(), 'Content-Type': blob.type || 'image/jpeg' },
    body: blob,
  });
  return parse(response, 'Не удалось отправить фотографию на проверку.');
}
