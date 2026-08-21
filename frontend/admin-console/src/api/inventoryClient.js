async function request(path, options = {}) {
  const response = await fetch(`/api/v1/admin/inventory${path}`, {
    signal: options.signal,
    headers: { 'X-Admin-Role': import.meta.env.VITE_ADMIN_DEMO_ROLE || 'ADMIN', 'X-Organization-Id': import.meta.env.VITE_DEMO_ORGANIZATION_ID || 'org_demo' },
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
