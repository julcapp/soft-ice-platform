const headers = { 'X-Admin-Role': 'ADMIN', 'X-Admin-Subject': 'admin-console' };
export async function getMaintenanceProjection({ signal } = {}) {
  const response = await fetch('/api/v1/admin/maintenance/projection', { headers, signal });
  if (!response.ok) { const error = new Error('Maintenance projection is unavailable.'); error.status = response.status; throw error; }
  const body = await response.json(); return body.data?.attributes || body.data;
}

async function mutateMaintenance(path, payload = {}, { signal, idempotencyKey, method = 'POST' } = {}) {
  const response = await fetch(`/api/v1/admin/maintenance${path}`, { method, signal, headers: { ...headers, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) }, body: JSON.stringify(payload) });
  if (!response.ok) { const error = new Error('Maintenance operation failed.'); error.status = response.status; throw error; }
  const body = await response.json(); return body.data?.attributes || body.data;
}
export const createMaintenancePlan = (payload, options) => mutateMaintenance('/plans', payload, options);
export const openMaintenanceSession = (payload, options) => mutateMaintenance('/sessions', payload, options);
export const completeMaintenanceChecklistItem = (sessionId, itemId, payload, options = {}) => mutateMaintenance(`/sessions/${sessionId}/checklist/${itemId}`, payload, { ...options, method: 'PUT' });
export const attachMaintenancePhoto = (sessionId, payload, options) => mutateMaintenance(`/sessions/${sessionId}/photos`, payload, options);
export const recordMaintenanceReplacement = (sessionId, payload, options) => mutateMaintenance(`/sessions/${sessionId}/replacements`, payload, options);
export const recordMaintenanceTestDispense = (sessionId, payload, options) => mutateMaintenance(`/sessions/${sessionId}/test-dispense`, payload, options);
export const submitMaintenanceSession = (sessionId, payload = {}, options) => mutateMaintenance(`/sessions/${sessionId}/submit`, payload, options);
export const approveMaintenanceSession = (sessionId, payload = {}, options) => mutateMaintenance(`/sessions/${sessionId}/approve`, payload, options);
export const rejectMaintenanceSession = (sessionId, payload = {}, options) => mutateMaintenance(`/sessions/${sessionId}/reject`, payload, options);
