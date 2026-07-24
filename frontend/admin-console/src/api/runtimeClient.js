async function request(base, path = '', options = {}) {
  const response = await fetch(`/api/v1/admin/${base}${path}`, { signal: options.signal, headers: { 'X-Admin-Role': import.meta.env.VITE_ADMIN_DEMO_ROLE || 'ADMIN' } });
  if (!response.ok) { const error = new Error('Admin read model is unavailable.'); error.status = response.status; throw error; }
  return (await response.json()).data;
}
export const listMachineRuntime = (options) => request('machine-runtime', '', options);
export const getMachineRuntime = (machineId, options) => request('machine-runtime', `/${encodeURIComponent(machineId)}`, options);
export const listPlatformEvents = (options) => request('platform-events', '', options);
export const getPlatformEvent = (eventId, options) => request('platform-events', `/${encodeURIComponent(eventId)}`, options);
export const listDeadLetters = (options) => request('platform-events', '/dead-letter', options);
