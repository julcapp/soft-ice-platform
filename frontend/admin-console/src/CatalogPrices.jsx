import React, { useEffect, useMemo, useState } from 'react';
import { catalogClient } from './api/catalogClient';
import { EmptyState, ErrorState, Skeleton } from './components';

const CATEGORY_LABELS = { ICE_CREAM: 'Мороженое / вкус', SPRINKLE: 'Посыпка', TOPPING: 'Топпинг' };
const STATUS_LABELS = { ACTIVE: 'Активно', INACTIVE: 'Неактивно', MISSING_PRICE: 'Нет цены', CONFIG_ERROR: 'Ошибка настройки' };
const FILTERS = [['ALL', 'Все позиции'], ['ICE_CREAM', 'Мороженое'], ['ADDONS', 'Добавки'], ['ACTIVE', 'Активные'], ['MISSING_PRICE', 'Без цены'], ['MACHINE', 'По аппарату']];
const EMPTY_FORM = { category: 'ICE_CREAM', sku: '', nameRu: '', basePrice: '', currency: 'RUB', sortOrder: 0, mediaPath: '', active: true, systemItem: false, freeItem: false };
const priceText = (value) => value === null || value === undefined ? '' : String(value);

export function filterCatalogItems(items, filter, machineId) {
  if (filter === 'ICE_CREAM') return items.filter((item) => item.category === 'ICE_CREAM');
  if (filter === 'ADDONS') return items.filter((item) => item.category === 'SPRINKLE' || item.category === 'TOPPING');
  if (filter === 'ACTIVE') return items.filter((item) => item.configurationStatus === 'ACTIVE');
  if (filter === 'MISSING_PRICE') return items.filter((item) => item.configurationStatus === 'MISSING_PRICE');
  if (filter === 'MACHINE') return machineId ? items.filter((item) => item.machines?.some((entry) => entry.machineId === machineId)) : [];
  return items;
}

export function CatalogPricesPage({ client = catalogClient }) {
  const [state, setState] = useState({ status: 'loading', items: [], machines: [] });
  const [form, setForm] = useState(EMPTY_FORM);
  const [machineId, setMachineId] = useState('');
  const [preview, setPreview] = useState({ status: 'idle', catalog: null, error: null });
  const [filter, setFilter] = useState('ALL');
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState({ tone: '', text: '' });

  async function load() {
    const [items, machines] = await Promise.all([client.list(), client.listMachines()]);
    setState({ status: 'ready', items, machines });
    return { items, machines };
  }

  useEffect(() => { load().catch((error) => setState({ status: 'error', items: [], machines: [], error })); }, []);
  useEffect(() => {
    if (!machineId) { setPreview({ status: 'idle', catalog: null, error: null }); return undefined; }
    const controller = new AbortController();
    setPreview({ status: 'loading', catalog: null, error: null });
    client.getMachineCatalog(machineId, { signal: controller.signal }).then((catalog) => setPreview({ status: 'ready', catalog, error: null })).catch((error) => { if (error.name !== 'AbortError') setPreview({ status: 'error', catalog: null, error }); });
    return () => controller.abort();
  }, [machineId, client]);

  const dirtyIds = useMemo(() => Object.keys(drafts).filter((id) => {
    const item = state.items.find((entry) => entry.id === id);
    return item && drafts[id] !== priceText(item.basePrice);
  }), [drafts, state.items]);
  const visibleItems = useMemo(() => filterCatalogItems(state.items, filter, machineId), [state.items, filter, machineId]);

  async function run(key, action, success) {
    setBusy(key); setNotice({ tone: '', text: '' });
    try { await action(); await load(); setNotice({ tone: 'success', text: success }); return true; }
    catch (error) { setNotice({ tone: 'error', text: error.message }); return false; }
    finally { setBusy(''); }
  }

  async function saveChanges() {
    const changes = dirtyIds.map((id) => ({ id, basePrice: drafts[id] === '' ? null : Number(drafts[id]), currency: state.items.find((item) => item.id === id)?.currency || 'RUB' }));
    if (changes.some((change) => change.basePrice !== null && (!Number.isFinite(change.basePrice) || change.basePrice < 0))) {
      setNotice({ tone: 'error', text: 'Проверьте изменённые цены: нужны неотрицательные числа.' }); return;
    }
    setBusy('prices'); setNotice({ tone: '', text: '' });
    try {
      await client.updatePrices(changes);
      await load();
      setDrafts({});
      setNotice({ tone: 'success', text: `Сохранено изменений: ${changes.length}. Каталог перечитан с сервера.` });
    } catch (error) { setNotice({ tone: 'error', text: error.message }); }
    finally { setBusy(''); }
  }

  async function submit(event) {
    event.preventDefault();
    const saved = await run('create', () => client.create({ ...form, basePrice: form.basePrice === '' ? null : Number(form.basePrice), sortOrder: Number(form.sortOrder) }), 'Позиция добавлена и зафиксирована в аудите.');
    if (saved) setForm(EMPTY_FORM);
  }

  if (state.status === 'loading') return <Skeleton />;
  if (state.status === 'error') return <ErrorState />;
  return <div className="catalog-admin">
    {notice.text && <div className={`catalog-notice is-${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
    <section className="card catalog-toolbar"><div><strong>Единый коммерческий каталог</strong><p>Базовая цена хранится в PostgreSQL. Promotion Engine применяется после неё; исторические PricingSnapshot не изменяются.</p></div><label>Аппарат<select aria-label="Аппарат" value={machineId} onChange={(event) => setMachineId(event.target.value)}><option value="">Выберите аппарат</option>{state.machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.machineCode} · {machine.name}</option>)}</select></label></section>
    <section className="card catalog-preview" aria-label="Что увидит покупатель"><div className="card-heading"><h2>Что увидит покупатель</h2><span>Данные display-каталога</span></div>{!machineId && <p>Выберите аппарат, чтобы проверить опубликованный ассортимент.</p>}{preview.status === 'loading' && <p>Проверяем каталог аппарата…</p>}{preview.status === 'error' && <div className="catalog-preview-error" role="alert"><strong>Ошибка настройки</strong><span>{preview.error?.message || 'Каталог аппарата не готов к публикации.'}</span></div>}{preview.status === 'ready' && <CustomerPreview catalog={preview.catalog} />}</section>
    <section className="card table-card"><div className="card-heading"><h2>Позиции каталога</h2><span>Показано: {visibleItems.length} из {state.items.length}</span></div><div className="catalog-filters" role="group" aria-label="Фильтры каталога">{FILTERS.map(([value, label]) => <button type="button" className={filter === value ? 'is-active' : ''} key={value} disabled={value === 'MACHINE' && !machineId} onClick={() => setFilter(value)}>{label}</button>)}</div>{!visibleItems.length ? <EmptyState title="Нет позиций по выбранному фильтру" /> : <div className="table-scroll"><table><thead><tr><th>Категория</th><th>SKU</th><th>Название</th><th>Базовая цена</th><th>Статус</th><th>Тип</th><th>Порядок</th><th>Автоматы</th><th>Изменено</th><th>Действия</th></tr></thead><tbody>{visibleItems.map((item) => <CatalogRow key={item.id} item={item} machineId={machineId} client={client} busy={busy} run={run} price={drafts[item.id] ?? priceText(item.basePrice)} dirty={dirtyIds.includes(item.id)} onPriceChange={(value) => setDrafts((current) => ({ ...current, [item.id]: value }))} />)}</tbody></table></div>}<div className="catalog-save-bar"><span>{dirtyIds.length ? `Несохранённых изменений: ${dirtyIds.length}` : 'Все изменения сохранены'}</span><button type="button" className="primary-button" disabled={!dirtyIds.length || busy === 'prices'} onClick={saveChanges}>Сохранить изменения</button></div></section>
    <section className="card"><div className="card-heading"><h2>Добавить позицию</h2><span>Коммерческое изменение</span></div><form className="catalog-form" onSubmit={submit}><label>Категория<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Код / SKU<input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></label><label>Русское название<input required value={form.nameRu} onChange={(e) => setForm({ ...form, nameRu: e.target.value })} /></label><label>Базовая цена<input min="0" step="0.01" required value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} /></label><label>Валюта<input maxLength="3" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></label><label>Порядок<input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></label><label>Медиа-путь<input value={form.mediaPath} onChange={(e) => setForm({ ...form, mediaPath: e.target.value })} placeholder="/media/ice/..." /></label><label className="catalog-check"><input type="checkbox" checked={form.systemItem} onChange={(e) => setForm({ ...form, systemItem: e.target.checked })} />Системная позиция</label><label className="catalog-check"><input type="checkbox" checked={form.freeItem} onChange={(e) => setForm({ ...form, freeItem: e.target.checked })} />Осознанно бесплатная</label><button className="primary-button" disabled={busy === 'create'}>Добавить</button></form></section>
  </div>;
}

export function CustomerPreview({ catalog }) {
  const addOns = [...(catalog.sprinkles || []), ...(catalog.toppings || [])];
  return <div className="catalog-preview-grid"><div><span>Аппарат</span><strong>{catalog.machine?.machineCode} · {catalog.machine?.name}</strong></div><div><span>Текущий вкус</span><strong>{catalog.currentFlavor?.nameRu}</strong></div><div><span>Базовая цена</span><strong>{priceText(catalog.currentFlavor?.basePrice)} {catalog.currency}</strong></div><div className="catalog-preview-addons"><span>Добавки в продаже</span>{addOns.map((item) => <div key={item.id}><b>{item.nameRu}</b><small>{priceText(item.basePrice)} {item.currency}</small></div>)}</div><p>Финальная цена покупателя рассчитывается Pricing Engine / Promotion Engine.</p></div>;
}

export function CatalogRow({ item, machineId, client, busy, run, price = priceText(item.basePrice), dirty = false, onPriceChange = () => {} }) {
  const key = `item:${item.id}`;
  return <tr className={dirty ? 'catalog-row-dirty' : ''} data-dirty={dirty ? 'true' : 'false'}><td>{CATEGORY_LABELS[item.category] || item.category}</td><td><code>{item.sku}</code></td><td>{item.nameRu}</td><td><div className="catalog-price"><input aria-label={`Цена ${item.nameRu}`} min="0" step="0.01" value={price} onChange={(e) => onPriceChange(e.target.value)} /><span>{item.currency}</span>{dirty && <small>Изменено</small>}</div></td><td><span className={`catalog-status is-${String(item.configurationStatus || '').toLowerCase()}`} title={(item.configurationIssues || []).join('; ')}>{STATUS_LABELS[item.configurationStatus] || 'Ошибка настройки'}</span></td><td>{item.systemItem ? 'Системная' : item.freeItem ? 'Бесплатная' : 'Коммерческая'}</td><td>{item.sortOrder}</td><td>{(item.machines || []).map((entry) => <div key={entry.id}>{entry.machine?.machineCode || entry.machineId} · {entry.available ? 'доступна' : 'скрыта'}{entry.isCurrentFlavor ? ' · текущий вкус' : ''}</div>)}</td><td>{item.updatedAt ? new Date(item.updatedAt).toLocaleString('ru-RU') : '—'}</td><td><div className="catalog-actions"><button disabled={item.systemItem || busy === key} onClick={() => run(key, () => client.update(item.id, { active: !item.active }), item.active ? 'Позиция деактивирована.' : 'Позиция активирована.')}>{item.active ? 'Деактивировать' : 'Активировать'}</button><button disabled={!machineId || busy === key} onClick={() => run(key, () => client.setAvailability(machineId, item.id, true), 'Позиция назначена автомату.')}>Назначить</button><button disabled={!machineId || item.systemItem || busy === key} onClick={() => run(key, () => client.setAvailability(machineId, item.id, false), 'Позиция снята с автомата.')}>Убрать</button>{item.category === 'ICE_CREAM' && <button disabled={!machineId || busy === key} onClick={() => run(key, () => client.setCurrentFlavor(machineId, item.id), 'Текущий вкус автомата обновлён.')}>Текущий вкус</button>}</div></td></tr>;
}
