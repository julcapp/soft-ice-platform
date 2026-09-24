export class MachineCatalogError extends Error {
  constructor(message, code = 'MACHINE_CATALOG_UNAVAILABLE') { super(message); this.code = code; }
}

export async function getMachineCatalog(machineId, { signal } = {}) {
  if (!machineId) throw new MachineCatalogError('Не указан идентификатор автомата.', 'CATALOG_MACHINE_REQUIRED');
  const response = await fetch(`/api/v1/catalog/machines/${encodeURIComponent(machineId)}`, { signal, headers: { Accept: 'application/json' } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new MachineCatalogError(payload?.error?.message || 'Каталог автомата недоступен.', payload?.error?.code);
  const catalog = payload?.data;
  if (!catalog?.currentFlavor || !Array.isArray(catalog.items)) throw new MachineCatalogError('Сервер вернул неполный каталог.', 'MACHINE_CATALOG_INVALID');
  return catalog;
}
