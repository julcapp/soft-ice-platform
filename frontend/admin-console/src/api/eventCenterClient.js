const headers = { 'X-Admin-Role': 'PLATFORM_OWNER', 'X-Admin-Subject': 'event-center-console' };
async function request(path, options = {}) {
  const response = await fetch(`/api/v1/admin${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...headers, ...options.headers } });
  if (!response.ok) { const error = new Error('Не удалось выполнить запрос Центра событий.'); error.status = response.status; throw error; }
  return (await response.json()).data;
}
const query = (filters = {}) => { const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined)); return params.size ? `?${params}` : ''; };
export const listEvents = (filters, options = {}) => request(`/events${query(filters)}`, options);
export const getEvent = (eventId, options = {}) => request(`/events/${eventId}`, options);
export const getCorrelation = (correlationId, options = {}) => request(`/events/correlation/${correlationId}`, options);
export const getEvidence = (eventId, options = {}) => request(`/events/${eventId}/evidence`, options);
export const getComments = (eventId, options = {}) => request(`/events/${eventId}/comments`, options);
export const acknowledgeEvent = (eventId, comment) => request(`/events/${eventId}/acknowledge`, { method: 'POST', body: JSON.stringify({ comment }) });
export const setProcessingState = (eventId, status) => request(`/events/${eventId}/processing-state`, { method: 'PATCH', body: JSON.stringify({ status }) });
export const addEventComment = (eventId, body) => request(`/events/${eventId}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
export const addEventTag = (eventId, tag) => request(`/events/${eventId}/tags`, { method: 'POST', body: JSON.stringify({ tag }) });
export const setLegalHold = (eventId, enabled, reason) => request(`/events/${eventId}/legal-hold`, { method: enabled ? 'POST' : 'DELETE', body: JSON.stringify({ reason }) });
