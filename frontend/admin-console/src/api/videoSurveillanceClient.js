const headers = { 'X-Admin-Role': import.meta.env.VITE_ADMIN_DEMO_ROLE || 'ADMIN', 'X-Admin-Subject': 'admin-console-video' };
async function request(path, options = {}) { const response = await fetch(`/api/v1/admin${path}`, { ...options, headers: { ...headers, ...options.headers } }); if (!response.ok) { const error = new Error('Данные видеонаблюдения недоступны.'); error.status = response.status; throw error; } return (await response.json()).data; }
export const listCameras = (machineId, options) => request(`/machines/${encodeURIComponent(machineId)}/cameras`, options);
export const listVideoFragments = (machineId, options) => request(`/machines/${encodeURIComponent(machineId)}/video-fragments`, options);
export const listVideoIncidents = (machineId, options) => request(`/machines/${encodeURIComponent(machineId)}/video-incidents`, options);
export const checkCamera = (machineId, cameraId) => request(`/machines/${encodeURIComponent(machineId)}/cameras/${encodeURIComponent(cameraId)}/check`, { method: 'POST' });
export const controlRecording = (machineId, cameraId) => request(`/machines/${encodeURIComponent(machineId)}/cameras/${encodeURIComponent(cameraId)}/control-recording`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
