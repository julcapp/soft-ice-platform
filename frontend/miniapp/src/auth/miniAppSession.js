function saveAccessToken(token) {
  if (!token) return;
  sessionStorage.setItem('soft_ice_access_token', token);
  sessionStorage.setItem('access_token', token);
}

async function createSession(endpoint, body) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'Не удалось выполнить вход.');
    error.code = payload?.error?.code || 'AUTH_FAILED';
    error.status = response.status;
    throw error;
  }
  const attributes = payload?.data?.attributes || {};
  saveAccessToken(attributes.access_token);
  return {
    accessToken: attributes.access_token || null,
    customerId: attributes.customer_id || null,
    expiresAt: attributes.expires_at || null,
  };
}

export function detectMiniAppProvider() {
  if (window.WebApp?.initData) return 'max';
  if (window.Telegram?.WebApp?.initData) return 'telegram';
  return null;
}

export async function bootstrapMiniAppSession() {
  const provider = detectMiniAppProvider();

  if (provider === 'max') {
    return {
      provider,
      ...(await createSession('/api/v1/auth/max-mini-app/sessions', {
        max_init_data: window.WebApp.initData,
        source_channel: 'max_mini_app',
      })),
    };
  }

  if (provider === 'telegram') {
    return {
      provider,
      ...(await createSession('/api/v1/auth/telegram-mini-app/sessions', {
        telegram_init_data: window.Telegram.WebApp.initData,
        source_channel: 'telegram_mini_app',
      })),
    };
  }

  return { provider: 'browser', accessToken: null, customerId: null, expiresAt: null };
}
