const adminHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Admin-Role': import.meta.env.VITE_ADMIN_DEMO_ROLE || 'ADMIN',
});

async function request(path, options = {}) {
  const response = await fetch(`/api/v1/admin/equipment${path}`, {
    ...options,
    headers: { ...adminHeaders(), ...(options.headers || {}) },
  });
  if (!response.ok) {
    const error = new Error('Данные тестового контура оборудования недоступны.');
    error.status = response.status;
    throw error;
  }
  return (await response.json()).data;
}

export const getEquipmentSandbox = (machineId = 'TEST-MACHINE-001', { signal } = {}) => request(`/machines/${encodeURIComponent(machineId)}`, { signal });

export const createTestDispense = (machineId = 'TEST-MACHINE-001', payload = {}, { signal } = {}) => request(`/machines/${encodeURIComponent(machineId)}/test-dispense`, {
  method: 'POST',
  signal,
  body: JSON.stringify({ payload }),
});
