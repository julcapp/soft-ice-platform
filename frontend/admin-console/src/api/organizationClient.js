const headers = { 'X-Admin-Role': 'PLATFORM_OWNER', 'X-Admin-Subject': 'organization-360-console' };
async function request(path, { signal, method = 'GET', body, idempotencyKey } = {}) {
  const response = await fetch(`/api/v1/organizations${path}`, { signal, method, body, headers: { ...headers, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) } });
  if (!response.ok) { const error = new Error(response.status === 403 ? 'Нет доступа к этой организации.' : 'Не удалось загрузить данные организации.'); error.status = response.status; throw error; }
  return (await response.json()).data;
}
export const getOrganizations = (options) => request('', options);
export const getOrganization = (id, options) => request(`/${id}`, options);
export const getOrganizationUnits = (id, options) => request(`/${id}/units`, options);
export const getOrganizationMembers = (id, options) => request(`/${id}/members`, options);
export const getOrganizationLocations = (id, options) => request(`/${id}/locations`, options);
export const getOrganizationMachines = (id, options) => request(`/${id}/machines`, options);
export const getOrganizationResponsibilities = (id, options) => request(`/${id}/responsibilities`, options);
export const getOrganizationEvents = (id, options) => request(`/${id}/events`, options);
export const getOrganizationMetrics = (id, options) => request(`/${id}/metrics`, options);

export const createOrganization = (payload, options = {}) => request('', { ...options, method: 'POST', body: JSON.stringify(payload) });
export const updateOrganization = (id, payload, options = {}) => request(`/${id}`, { ...options, method: 'PATCH', body: JSON.stringify(payload) });
export const createOrganizationUnit = (id, payload, options = {}) => request(`/${id}/units`, { ...options, method: 'POST', body: JSON.stringify(payload) });
export const updateOrganizationUnit = (id, unitId, payload, options = {}) => request(`/${id}/units/${unitId}`, { ...options, method: 'PATCH', body: JSON.stringify(payload) });
export const createOrganizationMember = (id, payload, options = {}) => request(`/${id}/members`, { ...options, method: 'POST', body: JSON.stringify(payload) });
export const updateOrganizationMember = (id, memberId, payload, options = {}) => request(`/${id}/members/${memberId}`, { ...options, method: 'PATCH', body: JSON.stringify(payload) });
export const assignOrganizationRole = (id, memberId, payload, options = {}) => request(`/${id}/members/${memberId}/roles`, { ...options, method: 'POST', body: JSON.stringify(payload) });
export const createOrganizationLocation = (id, payload, options = {}) => request(`/${id}/locations`, { ...options, method: 'POST', body: JSON.stringify(payload) });
export const updateOrganizationLocation = (id, locationId, payload, options = {}) => request(`/${id}/locations/${locationId}`, { ...options, method: 'PATCH', body: JSON.stringify(payload) });
export const assignOrganizationMachine = (id, payload, options = {}) => request(`/${id}/machines`, { ...options, method: 'POST', body: JSON.stringify(payload) });
export const assignOrganizationResponsibility = (id, payload, options = {}) => request(`/${id}/responsibilities`, { ...options, method: 'POST', body: JSON.stringify(payload) });
