function accessToken() {
  return window.localStorage?.getItem('soft_ice_access_token') || window.sessionStorage?.getItem('soft_ice_access_token') || null;
}

async function request(url, options = {}) {
  const token = accessToken();
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'Не удалось обработать получение заказа.');
    error.code = payload?.error?.code || 'PICKUP_REQUEST_FAILED';
    error.status = response.status;
    throw error;
  }
  return payload?.data;
}

export async function issuePickupCode(orderId, { signal } = {}) {
  const data = await request(`/api/v1/orders/${encodeURIComponent(orderId)}/pickup-code`, { method: 'POST', signal });
  const a = data?.attributes || {};
  return { orderId: a.order_id, machineId: a.machine_id, code: a.code, qrPayload: a.qr_payload, qrDataUrl: a.qr_data_url, expiresAt: a.expires_at, amount: a.amount, currency: a.currency };
}

export async function redeemPickupCode({ machineId, code, qrPayload, signal } = {}) {
  const data = await request('/api/v1/orders/pickup/redeem', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ machineId, code, qrPayload }) });
  const a = data?.attributes || {};
  return { orderId: a.order_id, machineId: a.machine_id, amount: a.amount, currency: a.currency, dispenseAttemptId: a.dispense_attempt_id, dispenseStatus: a.dispense_status, duplicate: Boolean(a.duplicate) };
}

export async function getPickupStatus({ machineId, dispenseAttemptId, signal } = {}) {
  const data = await request(`/api/v1/orders/pickup/${encodeURIComponent(dispenseAttemptId)}/status?machineId=${encodeURIComponent(machineId)}`, { signal });
  const a = data?.attributes || {};
  return { status: a.status, failureCode: a.failure_code, finishedAt: a.finished_at };
}
