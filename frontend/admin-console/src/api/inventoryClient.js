async function request(path, options = {}) {
  const response = await fetch(`/api/v1/admin/inventory${path}`, {
    signal: options.signal,
    method: options.method || 'GET',
    body: options.body,
    headers: { 'X-Admin-Role': import.meta.env.VITE_ADMIN_ROLE || import.meta.env.VITE_ADMIN_DEMO_ROLE || 'ADMIN', 'X-Organization-Id': import.meta.env.VITE_ORGANIZATION_ID || import.meta.env.VITE_DEMO_ORGANIZATION_ID || 'org_demo', 'Content-Type': 'application/json', ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}) },
  });
  if (!response.ok) { const error = new Error('Inventory read model is unavailable.'); error.status = response.status; throw error; }
  return (await response.json()).data;
}
export const getInventoryProjection = async (options) => {
  const [items, locations, balances, movements, reservations, reservationMetrics] = await Promise.all([
    request('/items', options), request('/locations', options), request('/balances', options),
    request('/movements', options), request('/reservations', options), request('/reservation-metrics', options),
  ]);
  return { items, locations, balances, movements, reservations, reservationMetrics };
};

export const createInventoryItem = (payload, options = {}) => request('/items', { ...options, method: 'POST', body: JSON.stringify(payload) });
export const createInventoryLocation = (payload, options = {}) => request('/locations', { ...options, method: 'POST', body: JSON.stringify(payload) });
export const recordInventoryMovement = (payload, options = {}) => request('/movements', { ...options, method: 'POST', body: JSON.stringify(payload) });
export const createInventoryReservation = (payload, options = {}) => request('/reservations', { ...options, method: 'POST', body: JSON.stringify(payload) });
export const consumeInventoryReservation = (reservationId, payload = {}, options = {}) => request(`/reservations/${reservationId}/consume`, { ...options, method: 'POST', body: JSON.stringify(payload) });
export const releaseInventoryReservation = (reservationId, payload = {}, options = {}) => request(`/reservations/${reservationId}/release`, { ...options, method: 'POST', body: JSON.stringify(payload) });
