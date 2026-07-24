class OperatorWorkspaceApi {
  constructor(baseUrl = '/api/v1/operator-workspace') { this.baseUrl = baseUrl; }
  listMachines() { return this.request('/machines'); }
  getMachine(id) { return this.request(`/machines/${id}`); }
  openSession(id) { return this.request(`/machines/${id}/sessions`, 'POST', {}); }
  checklist(sessionId, itemId, status) { return this.request(`/sessions/${sessionId}/checklist/${itemId}`, 'PUT', { status }); }
  test(sessionId, type) { return this.request(`/sessions/${sessionId}/tests`, 'POST', { type, status: 'PASSED' }); }
  consume(sessionId, body) { return this.request(`/sessions/${sessionId}/consumptions`, 'POST', body); }
  complete(sessionId) { return this.request(`/sessions/${sessionId}/complete`, 'POST', { summary: 'Регламентное обслуживание завершено' }); }
  actions(machineId = '') { return this.request(`/actions${machineId ? `?machine_id=${machineId}` : ''}`); }
  async photo(sessionId, stage, file) {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    const checksum = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    return this.request(`/sessions/${sessionId}/photos`, 'POST', {
      stage, storage_key: `operator/${sessionId}/${stage.toLowerCase()}/${Date.now()}-${file.name}`,
      content_type: file.type || 'image/jpeg', checksum_sha256: checksum, captured_at: new Date().toISOString(),
    });
  }
  async request(path, method = 'GET', body) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method, headers: { 'Content-Type': 'application/json', 'X-Operator-ID': 'operator_demo', 'X-Operator-Role': 'OPERATOR', 'Idempotency-Key': crypto.randomUUID() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || 'Операция не выполнена.');
    return payload.data;
  }
}
export const operatorWorkspaceApi = new OperatorWorkspaceApi();
