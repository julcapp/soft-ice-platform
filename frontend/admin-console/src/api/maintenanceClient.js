const headers = { 'X-Admin-Role': 'ADMIN', 'X-Admin-Subject': 'admin-console' };
export async function getMaintenanceProjection({ signal } = {}) {
  const response = await fetch('/api/v1/admin/maintenance/projection', { headers, signal });
  if (!response.ok) { const error = new Error('Maintenance projection is unavailable.'); error.status = response.status; throw error; }
  const body = await response.json(); return body.data?.attributes || body.data;
}
