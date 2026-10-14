async function request(path, { signal, method = 'GET', body } = {}) {
  const response = await fetch('/api/v1/admin/machines' + path, {
    method,
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Role': import.meta.env.VITE_ADMIN_DEMO_ROLE || 'ADMIN',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'Настройки аппарата недоступны.');
    error.status = response.status;
    error.code = payload?.error?.code;
    throw error;
  }
  return payload.data;
}
export const getMachineSettings = (machineId, options = {}) => request('/' + encodeURIComponent(machineId) + '/settings', options);
export const saveMachineSetting = (machineId, key, value, options = {}) => request('/' + encodeURIComponent(machineId) + '/settings/' + encodeURIComponent(key), { ...options, method: 'PUT', body: { value } });
