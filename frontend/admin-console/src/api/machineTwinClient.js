async function request(path, { signal } = {}) {
  const response = await fetch(`/api/v1/admin/machine-twins${path}`, {
    signal, headers: { 'X-Admin-Role': import.meta.env.VITE_ADMIN_DEMO_ROLE || 'ADMIN' },
  });
  if (!response.ok) {
    const error = new Error('Machine Twin data is unavailable.');
    error.status = response.status;
    throw error;
  }
  return (await response.json()).data;
}
export const listMachineTwins = (options) => request('', options);
export const getMachineTwin = (machineId, options) => request(`/${encodeURIComponent(machineId)}`, options);
