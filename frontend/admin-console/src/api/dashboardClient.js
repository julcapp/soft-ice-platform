export async function getDashboard({ signal } = {}) {
  const response = await fetch('/api/v1/admin/dashboard', {
    signal,
    headers: adminAuthHeaders(),
  });
  if (!response.ok) {
    const error = new Error('Dashboard data is unavailable.');
    error.status = response.status;
    throw error;
  }
  return response.json();
}
import { adminAuthHeaders } from './adminAuth';
