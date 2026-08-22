const authHeaders = () => ({ Authorization: `Bearer ${sessionStorage.getItem('access_token') || ''}` });
async function parse(response, fallback) {
  const body = await response.json();
  if (!response.ok) { const error = new Error(body?.error?.message || fallback); error.code = body?.error?.code; throw error; }
  return body.data;
}
export async function getPrivateChannelState({ signal } = {}) {
  return parse(await fetch('/api/v1/private-channel/me', { signal, headers: authHeaders() }), 'Не удалось загрузить подписку.');
}
export async function startPrivateChannelCheckout({ recurringEnabled }) {
  return parse(await fetch('/api/v1/private-channel/me/checkout', {
    method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ planCode: 'PRIVATE_TELEGRAM_MONTHLY', recurringEnabled, recurringConsentVersion: recurringEnabled ? 'private-channel-recurring-v1' : undefined }),
  }), 'Не удалось создать платёж.');
}
export async function cancelPrivateChannelSubscription(subscriptionId, atPeriodEnd = true) {
  return parse(await fetch(`/api/v1/private-channel/me/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ atPeriodEnd }),
  }), 'Не удалось отменить подписку.');
}
