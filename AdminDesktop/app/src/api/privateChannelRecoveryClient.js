const headers = () => ({ Authorization: `Bearer ${sessionStorage.getItem('access_token') || ''}`, 'Content-Type': 'application/json' });

async function parse(response, fallback) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message || fallback);
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }
  return body.data;
}

export async function getPrivateChannelRecovery({ signal, limit = 100 } = {}) {
  return parse(await fetch(`/api/v1/admin/private-channel/recovery?limit=${encodeURIComponent(limit)}`, { signal, headers: headers() }), 'Не удалось загрузить очередь восстановления подписок.');
}

export async function retryPrivateChannelRenewal(attemptId) {
  return parse(await fetch(`/api/v1/admin/private-channel/recovery/${encodeURIComponent(attemptId)}/retry`, { method: 'POST', headers: headers(), body: '{}' }), 'Не удалось повторить продление.');
}

export async function expireExhaustedPrivateChannelAccess(limit = 100) {
  return parse(await fetch('/api/v1/admin/private-channel/recovery/expire-exhausted-access', { method: 'POST', headers: headers(), body: JSON.stringify({ limit }) }), 'Не удалось обработать истёкший доступ.');
}
