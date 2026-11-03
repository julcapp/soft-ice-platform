function accessToken() {
  return sessionStorage.getItem('access_token')
    || sessionStorage.getItem('soft_ice_access_token')
    || localStorage.getItem('soft_ice_access_token')
    || '';
}

function authHeaders() {
  const token = accessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parse(response, fallback) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message || fallback);
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }
  return body.data;
}

export function resolveHomeMachineId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('machineId')
    || params.get('machine_id')
    || sessionStorage.getItem('soft_ice_machine_id')
    || localStorage.getItem('soft_ice_last_machine_id')
    || null;
}

export async function getClubAccount({ signal } = {}) {
  const data = await parse(
    await fetch('/api/v1/club-account/me', { signal, headers: authHeaders() }),
    'Не удалось загрузить данные Клуба.',
  );
  return data?.attributes || data || null;
}

export async function getCatalog({ machineId, signal } = {}) {
  if (machineId) {
    const data = await parse(
      await fetch(`/api/v1/catalog/machines/${encodeURIComponent(machineId)}`, { signal }),
      'Не удалось загрузить каталог аппарата.',
    );
    return { mode: 'machine', machineId, ...data };
  }

  const items = await parse(
    await fetch('/api/v1/catalog/items', { signal }),
    'Не удалось загрузить актуальный каталог.',
  );
  return { mode: 'public', items: Array.isArray(items) ? items : [] };
}

export function resolveCatalogSummary(catalog) {
  if (!catalog) return { name: 'Мягкое мороженое', price: null, currency: 'RUB', machineLabel: null };

  if (catalog.mode === 'machine') {
    const item = catalog.currentFlavor || null;
    return {
      name: item?.nameRu || 'Мягкое мороженое',
      price: Number.isFinite(Number(item?.basePrice)) ? Number(item.basePrice) : null,
      currency: item?.currency || catalog.currency || 'RUB',
      machineLabel: catalog.machine?.name || catalog.machine?.code || catalog.machineId || null,
    };
  }

  const iceCream = (catalog.items || [])
    .filter((item) => item?.active !== false && item?.category === 'ICE_CREAM' && Number.isFinite(Number(item?.basePrice)))
    .sort((a, b) => Number(a.basePrice) - Number(b.basePrice));

  const item = iceCream[0] || null;
  return {
    name: item?.nameRu || 'Мягкое мороженое',
    price: item ? Number(item.basePrice) : null,
    currency: item?.currency || 'RUB',
    machineLabel: null,
  };
}
