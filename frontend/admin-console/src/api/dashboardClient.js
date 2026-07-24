export async function getDashboard({ signal } = {}) {
  const response = await fetch('/api/v1/admin/dashboard', {
    signal,
    headers: { 'X-Admin-Role': import.meta.env.VITE_ADMIN_DEMO_ROLE || 'ADMIN' },
  });
  if (!response.ok) {
    const error = new Error('Dashboard data is unavailable.');
    error.status = response.status;
    throw error;
  }
  return response.json();
}
