const PRICING_ENDPOINT = '/api/v1/pricing/quote';
const AWARENESS_ENDPOINT = '/api/v1/pricing/promotion-awareness';

export class PricingQuoteApiError extends Error {
  constructor(message, { code = 'PRICING_UI_REQUEST_FAILED', status = 0, details = [] } = {}) {
    super(message);
    this.name = 'PricingQuoteApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function getAccessToken() {
  const candidates = [
    window.localStorage?.getItem('soft_ice_access_token'),
    window.sessionStorage?.getItem('soft_ice_access_token'),
  ];
  return candidates.find(Boolean) || null;
}

function authHeaders(extra = {}) {
  const token = getAccessToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

export function resolveMachineId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('machineId') || params.get('machine_id') || null;
}

export async function getPromotionAwareness({ machineId, channel, signal }) {
  if (!machineId) return { active: null, upcoming: null };
  const params = new URLSearchParams({ machineId, channel, withinMinutes: '60' });
  const response = await fetch(`${AWARENESS_ENDPOINT}?${params}`, { headers: authHeaders(), signal });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new PricingQuoteApiError(payload?.error?.message || 'Не удалось проверить ближайшую акцию.', { code: payload?.error?.code || 'PROMOTION_AWARENESS_FAILED', status: response.status });
  return payload?.data || { active: null, upcoming: null };
}

export async function createPricingQuote({ machineId, channel, productId, name, signal }) {
  if (!machineId) {
    throw new PricingQuoteApiError('Не указан автомат для серверного расчёта цены.', {
      code: 'PRICING_UI_MACHINE_REQUIRED', status: 400,
    });
  }

  let response;
  try {
    response = await fetch(PRICING_ENDPOINT, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      signal,
      body: JSON.stringify({ machineId, channel, items: [{ id: productId, productId, name, quantity: 1 }] }),
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new PricingQuoteApiError('Не удалось связаться с сервером расчёта цены.', { code: 'PRICING_UI_NETWORK_ERROR' });
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new PricingQuoteApiError(payload?.error?.message || 'Сервер не смог рассчитать цену.', {
      code: payload?.error?.code || 'PRICING_UI_SERVER_ERROR', status: response.status, details: payload?.error?.details || [],
    });
  }

  if (!payload?.data?.id || !payload?.data?.lockedUntil) {
    throw new PricingQuoteApiError('Сервер вернул неполный расчёт цены.', { code: 'PRICING_UI_INVALID_RESPONSE', status: response.status });
  }
  return payload.data;
}
