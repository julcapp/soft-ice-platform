const authHeaders = () => ({ Authorization: `Bearer ${sessionStorage.getItem('access_token') || ''}` });

async function parse(response, fallback) {
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body?.error?.message || fallback);
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }
  return body.data;
}

export async function getProfileState({ signal } = {}) {
  return parse(await fetch('/api/v1/customers/me/profile-state', { signal, headers: authHeaders() }), 'Не удалось загрузить профиль.');
}

export async function patchProfile(payload) {
  return parse(await fetch('/api/v1/customers/me/profile', { method: 'PATCH', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }), 'Не удалось сохранить профиль.');
}

export async function requestEmailVerification(email) {
  return parse(await fetch('/api/v1/customers/me/email-verifications', { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }), 'Не удалось отправить письмо подтверждения.');
}

export async function saveMarketingEmailConsent(isGranted, rulesVersion) {
  return parse(await fetch('/api/v1/customers/me/marketing-email-consent', { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ isGranted, rulesVersion }) }), 'Не удалось сохранить согласие.');
}

export async function getNotifications({ signal } = {}) {
  return parse(await fetch('/api/v1/customers/me/notifications', { signal, headers: authHeaders() }), 'Не удалось загрузить уведомления.');
}

export async function markNotificationRead(notificationId) {
  return parse(await fetch(`/api/v1/customers/me/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST', headers: authHeaders() }), 'Не удалось отметить уведомление прочитанным.');
}

export async function recordReferralAction(action, destination, surface = 'miniapp_referral') {
  return parse(await fetch('/api/v1/customers/me/referral-link-actions', {
    method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, destination, surface }),
  }), 'Не удалось зафиксировать действие с реферальной ссылкой.');
}
