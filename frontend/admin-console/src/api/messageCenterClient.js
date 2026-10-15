async function request(path, signal) {
  const response = await fetch(`/api/v1/admin/messages${path}`, { signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error?.message || 'Центр сообщений недоступен.'), { status: response.status });
  return body.data;
}
export const messageCenterClient = {
  list: (filters, { signal } = {}) => request(`?${new URLSearchParams(filters)}`, signal),
  get: (id, { signal } = {}) => request(`/${encodeURIComponent(id)}`, signal),
};
