const { ApiError } = require('../../platform/errors/ApiError');
const fail = (statusCode, code, message) => new ApiError({ statusCode, code, message });
class OrganizationRegistry {
  constructor({ token = process.env.DADATA_API_TOKEN, fetchImpl = globalThis.fetch } = {}) { this.token = token; this.fetch = fetchImpl; this.requests = new Map(); }
  configuration() { return { configured: Boolean(this.token), provider: 'DaData' }; }
  async lookup(inn, actorId) {
    if (typeof inn !== 'string' || !/^(\d{10}|\d{12})$/.test(inn)) throw fail(422, 'ORGANIZATION_INN_INVALID', 'ИНН должен содержать 10 или 12 цифр.');
    if (!this.token) throw fail(503, 'ORGANIZATION_REGISTRY_NOT_CONFIGURED', 'Поиск по ИНН ещё не подключён. Заполните реквизиты вручную.');
    const now = Date.now(), key = actorId || 'unknown';
    for (const [id, entry] of this.requests) if (now - entry.started >= 60000) this.requests.delete(id);
    const rate = this.requests.get(key) || { started: now, count: 0 };
    if (rate.count >= 20) throw fail(429, 'ORGANIZATION_REGISTRY_LIMIT', 'Слишком много запросов. Повторите через минуту.');
    rate.count++; this.requests.set(key, rate);
    let result;
    try {
      const response = await this.fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Token ${this.token}` }, body: JSON.stringify({ query: inn, branch_type: 'MAIN', count: 1 }), signal: AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error('provider');
      result = await response.json();
    } catch (_) { throw fail(502, 'ORGANIZATION_REGISTRY_UNAVAILABLE', 'Сервис проверки временно недоступен. Можно заполнить данные вручную.'); }
    const found = result?.suggestions?.find((item) => item.data?.inn === inn);
    if (!found) throw fail(404, 'ORGANIZATION_REGISTRY_NOT_FOUND', 'Организация с этим ИНН не найдена. Проверьте номер.');
    const d = found.data, person = d.managers?.find((item) => item.type === 'EMPLOYEE');
    const fio = d.type === 'INDIVIDUAL' ? d.fio : person?.fio;
    const name = [fio?.surname, fio?.name, fio?.patronymic].filter(Boolean).join(' ');
    return { source: 'DaData', fetchedAt: new Date().toISOString(), registryStatus: d.state?.status || null, actualityDate: d.state?.actuality_date ? new Date(d.state.actuality_date).toISOString() : null, organization: {
      fullName: d.name?.full_with_opf || found.value || '', shortName: d.name?.short_with_opf || found.value || '', organizationType: d.type === 'INDIVIDUAL' ? 'ИП' : d.opf?.short || 'Другая организация', inn: d.inn, kpp: d.kpp || '', ogrn: d.ogrn || '', legalAddress: d.address?.data?.source || d.address?.unrestricted_value || d.address?.value || '', directorName: name || d.management?.name || '', directorPosition: d.type === 'INDIVIDUAL' ? 'Индивидуальный предприниматель' : person?.post || d.management?.post || '', phone: d.phones?.[0]?.value || '', email: d.emails?.[0]?.value || '', website: d.sites?.[0]?.value || '',
    } };
  }
}
module.exports = { OrganizationRegistry };
