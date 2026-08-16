const headers = { 'X-Admin-Role': 'PLATFORM_OWNER', 'X-Admin-Subject': 'organization-360-console' };
async function request(path, { signal } = {}) {
  const response = await fetch(`/api/v1/organizations${path}`, { signal, headers });
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
