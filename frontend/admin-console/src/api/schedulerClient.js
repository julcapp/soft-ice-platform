const API_BASE = import.meta.env.VITE_API_BASE || '';

export async function getScheduler({ signal } = {}) {
  const response = await fetch(`${API_BASE}/api/v1/admin/scheduler`, {
    signal,
    credentials: 'include',
  });
  if (!response.ok) {
    const error = new Error('Scheduler unavailable');
    error.status = response.status;
    throw error;
  }
  return response.json();
}
