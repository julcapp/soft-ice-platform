function accessToken() {
  return window.localStorage?.getItem('soft_ice_access_token')
    || window.sessionStorage?.getItem('soft_ice_access_token')
    || null;
}

function authHeaders(extra = {}) {
  const token = accessToken();
  return {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: authHeaders(options.headers || {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'Не удалось проверить оплату.');
    error.code = payload?.error?.code || 'PAYMENT_REQUEST_FAILED';
    error.status = response.status;
    throw error;
  }
  const attrs = payload?.data?.attributes;
  if (!attrs || !['SUCCESS', 'PENDING', 'ERROR', 'REFUNDED'].includes(attrs.user_state)) {
    const error = new Error('Сервер вернул некорректный статус платежа.');
    error.code = 'PAYMENT_RESPONSE_INVALID';
    throw error;
  }
  return {
    id: payload.data.id,
    orderId: attrs.order_id,
    status: attrs.status,
    userState: attrs.user_state,
    amount: attrs.amount,
    currency: attrs.currency,
    channel: attrs.channel,
    paymentMethod: attrs.payment_method,
    confirmationUrl: attrs.confirmation_url,
    providerStatus: attrs.provider_status,
    failureCode: attrs.failure_code,
    succeededAt: attrs.succeeded_at,
    failedAt: attrs.failed_at,
    canceledAt: attrs.canceled_at,
  };
}

export function startCustomerPayment(orderId, {
  channel = 'MINIAPP',
  method = 'sbp',
  returnUrl,
  idempotencyKey,
} = {}) {
  return request(`/api/v1/payments/orders/${encodeURIComponent(orderId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify({ channel, method, returnUrl }),
  });
}

export function refreshOrderPaymentStatus(orderId, { signal } = {}) {
  return request(`/api/v1/payments/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'GET',
    signal,
  });
}

export function buildPaymentReturnUrl(orderId, mode = 'payment-return') {
  const url = new URL(window.location.href);
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  url.searchParams.set('mode', mode);
  url.searchParams.set('orderId', orderId);
  return url.toString();
}
