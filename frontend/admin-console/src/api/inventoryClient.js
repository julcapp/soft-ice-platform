async function request(path, options = {}) {
  const response = await fetch(`/api/v1/admin/inventory${path}`, {
    signal: options.signal,
    headers: { 'X-Admin-Role': import.meta.env.VITE_ADMIN_DEMO_ROLE || 'ADMIN' },
  });
  if (!response.ok) { const error = new Error('Inventory read model is unavailable.'); error.status = response.status; throw error; }
  return (await response.json()).data;
}
export const getInventoryProjection = async (options) => {
  const [items, locations, balances, movements, reservations] = await Promise.all([
    request('/items', options), request('/locations', options), request('/balances', options),
    request('/movements', options), request('/reservations', options),
  ]);
  return { items, locations, balances, movements, reservations };
};
