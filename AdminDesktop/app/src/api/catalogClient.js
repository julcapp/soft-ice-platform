const BASE = '/api/v1/admin/catalog';
const headers = { 'Content-Type': 'application/json', 'X-Admin-Role': import.meta.env.VITE_ADMIN_DEMO_ROLE || 'ADMIN' };

const ERROR_MESSAGES = {
  CATALOG_CATEGORY_INVALID: 'Выбрана неподдерживаемая категория каталога.',
  CATALOG_CURRENCY_UNSUPPORTED: 'Сейчас каталог поддерживает только цены в RUB.',
  CATALOG_CURRENT_FLAVOR_DEACTIVATION_BLOCKED: 'Сначала выберите другой текущий вкус для аппарата.',
  CATALOG_CURRENT_FLAVOR_INVALID: 'Текущим вкусом может быть только активное мороженое с корректной ценой.',
  CATALOG_CURRENT_FLAVOR_MISSING: 'У аппарата не выбран доступный текущий вкус.',
  CATALOG_ITEM_NOT_FOUND: 'Позиция каталога не найдена.',
  CATALOG_MACHINE_NOT_FOUND: 'Аппарат не найден.',
  CATALOG_MUTATION_FORBIDDEN: 'Недостаточно прав для изменения каталога.',
  CATALOG_PRICE_CHANGES_INVALID: 'Изменения цен содержат повторяющиеся или пустые позиции.',
  CATALOG_PRICE_CHANGES_REQUIRED: 'Нет цен для сохранения.',
  CATALOG_PRICE_INVALID: 'У одной из опубликованных позиций отсутствует корректная цена.',
  CATALOG_PRICE_REQUIRED: 'Для активной коммерческой позиции нужна явная цена.',
  CATALOG_REQUIRED_FIELDS: 'Заполните код и русское название позиции.',
  CATALOG_SYSTEM_ITEM_PROTECTED: 'Защищённую системную позицию нельзя изменить таким образом.',
  CATALOG_SYSTEM_PRICE_INVALID: 'Системная позиция «Без ...» должна иметь цену 0 RUB.',
  CATALOG_ZERO_PRICE_REQUIRES_REASON: 'Нулевая цена допустима только для системной или явно бесплатной позиции.',
};

export function catalogErrorMessage(code) {
  return ERROR_MESSAGES[code] || 'Не удалось выполнить операцию с каталогом. Повторите попытку или проверьте настройки.';
}

async function request(path = '', options = {}) {
  const response = await fetch(`${BASE}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = payload?.error?.code;
    throw Object.assign(new Error(catalogErrorMessage(code)), { status: response.status, code });
  }
  return payload.data;
}

export const catalogClient = {
  list: ({ signal } = {}) => request('/items', { signal }),
  listMachines: ({ signal } = {}) => request('/machines', { signal }),
  getMachineCatalog: (machineId, { signal } = {}) => request(`/machines/${encodeURIComponent(machineId)}`, { signal }),
  create: (item) => request('/items', { method: 'POST', body: JSON.stringify(item) }),
  update: (id, patch) => request(`/items/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  updatePrice: (id, value) => request(`/items/${encodeURIComponent(id)}/price`, { method: 'PATCH', body: JSON.stringify(value) }),
  updatePrices: (changes) => request('/items/prices', { method: 'PATCH', body: JSON.stringify({ changes }) }),
  setAvailability: (machineId, itemId, available) => request(`/machines/${encodeURIComponent(machineId)}/items/${encodeURIComponent(itemId)}`, { method: 'PUT', body: JSON.stringify({ available }) }),
  setCurrentFlavor: (machineId, catalogItemId) => request(`/machines/${encodeURIComponent(machineId)}/current-flavor`, { method: 'PUT', body: JSON.stringify({ catalogItemId }) }),
};
