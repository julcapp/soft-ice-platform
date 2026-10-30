/** @vitest-environment jsdom */
import React, { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { CatalogPricesPage, CatalogRow, CustomerPreview, filterCatalogItems } from './CatalogPrices';
import { catalogErrorMessage } from './api/catalogClient';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const mounted = [];
afterEach(() => { while (mounted.length) { const { root, container } = mounted.pop(); act(() => root.unmount()); container.remove(); } });

const item = (overrides = {}) => ({ id: 'ice-a', sku: 'ice-a', category: 'ICE_CREAM', nameRu: 'Пломбир', basePrice: 150, currency: 'RUB', active: true, configurationStatus: 'ACTIVE', configurationIssues: [], systemItem: false, freeItem: false, sortOrder: 1, machines: [{ id: 'a-1', machineId: 'machine-a', available: true, isCurrentFlavor: true, machine: { machineCode: 'A-01' } }], updatedAt: '2026-09-23T00:00:00.000Z', ...overrides });
const machines = [{ id: 'machine-a', machineCode: 'A-01', name: 'Тестовый аппарат', location: 'Тестовый стенд · зона A' }];

async function mount(client) {
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container); mounted.push({ root, container });
  await act(async () => { root.render(<CatalogPricesPage client={client} />); });
  return container;
}

function inputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('Каталог и цены', () => {
  it('maps backend catalog codes to Russian copy without exposing raw messages', () => {
    expect(catalogErrorMessage('CATALOG_CURRENT_FLAVOR_INVALID')).toContain('корректной ценой');
    expect(catalogErrorMessage('UNKNOWN_BACKEND_CODE')).toBe('Не удалось выполнить операцию с каталогом. Повторите попытку или проверьте настройки.');
  });

  it('opens as a dedicated admin section', () => {
    const html = renderToStaticMarkup(<CatalogPricesPage client={{ list: () => new Promise(() => {}) }} />);
    expect(html).toContain('Загрузка панели управления');
  });

  it('shows configuration status and protected system actions', () => {
    const system = item({ id: 'topping-none', sku: 'topping_none', category: 'TOPPING', nameRu: 'Без топпинга', basePrice: 0, systemItem: true, machines: [{ id: 'assignment-1', machineId: 'machine-a', available: true, isCurrentFlavor: false, machine: { machineCode: 'A-01' } }] });
    const html = renderToStaticMarkup(<table><tbody><CatalogRow item={system} machineId="machine-a" client={{}} busy="" run={vi.fn()} /></tbody></table>);
    expect(html).toContain('A-01'); expect(html).toContain('доступна'); expect(html).toContain('Активно'); expect(html).toContain('Системная'); expect(html).toContain('disabled');
  });

  it('fails closed in the customer preview when the current flavor has no price', () => {
    const html = renderToStaticMarkup(<CustomerPreview catalog={{ currentFlavor: item({ basePrice: null }), sprinkles: [], toppings: [], currency: 'RUB' }} />);
    expect(html).toContain('Каталог не готов');
    expect(html).toContain('Для текущего вкуса не задана цена.');
    expect(html).not.toContain('Финальная цена покупателя');
  });

  it('filters all, ice cream, add-ons, active, missing-price and selected-machine rows', () => {
    const rows = [item(), item({ id: 'top', category: 'TOPPING', configurationStatus: 'MISSING_PRICE', basePrice: null, machines: [] }), item({ id: 'spr', category: 'SPRINKLE', configurationStatus: 'INACTIVE', active: false })];
    expect(filterCatalogItems(rows, 'ALL', '')).toHaveLength(3);
    expect(filterCatalogItems(rows, 'ICE_CREAM', '')).toHaveLength(1);
    expect(filterCatalogItems(rows, 'ADDONS', '')).toHaveLength(2);
    expect(filterCatalogItems(rows, 'ACTIVE', '')).toHaveLength(1);
    expect(filterCatalogItems(rows, 'MISSING_PRICE', '')[0].id).toBe('top');
    expect(filterCatalogItems(rows, 'MACHINE', 'machine-a')).toHaveLength(2);
  });

  it('edits multiple rows, marks them dirty and saves once before authoritative refetch', async () => {
    let rows = [item(), item({ id: 'top', sku: 'top', category: 'TOPPING', nameRu: 'Oreo', basePrice: 20, machines: [] })];
    const client = { list: vi.fn(async () => rows), listMachines: vi.fn(async () => machines), getMachineCatalog: vi.fn(), updatePrices: vi.fn(async (changes) => { rows = rows.map((row) => ({ ...row, basePrice: changes.find((change) => change.id === row.id)?.basePrice ?? row.basePrice })); }) };
    const container = await mount(client);
    const priceInputs = [...container.querySelectorAll('.catalog-price input')];
    await act(async () => { inputValue(priceInputs[0], '160'); inputValue(priceInputs[1], '25'); });
    expect(container.querySelectorAll('[data-dirty="true"]')).toHaveLength(2);
    expect(container.textContent).toContain('Несохранённых изменений: 2');
    await act(async () => { container.querySelector('.catalog-save-bar button').click(); });
    expect(client.updatePrices).toHaveBeenCalledTimes(1);
    expect(client.updatePrices.mock.calls[0][0]).toEqual([{ id: 'ice-a', basePrice: 160, currency: 'RUB' }, { id: 'top', basePrice: 25, currency: 'RUB' }]);
    expect(client.list).toHaveBeenCalledTimes(2);
    expect(container.querySelectorAll('[data-dirty="true"]')).toHaveLength(0);
  });

  it('preserves edited values and dirty state after a failed save', async () => {
    const client = { list: vi.fn(async () => [item()]), listMachines: vi.fn(async () => machines), getMachineCatalog: vi.fn(), updatePrices: vi.fn(async () => { throw new Error('Сервер отклонил цену'); }) };
    const container = await mount(client); const input = container.querySelector('.catalog-price input');
    await act(async () => { inputValue(input, '175'); });
    await act(async () => { container.querySelector('.catalog-save-bar button').click(); });
    expect(input.value).toBe('175'); expect(container.querySelectorAll('[data-dirty="true"]')).toHaveLength(1); expect(container.textContent).toContain('Сервер отклонил цену');
  });

  it('blocks invalid bulk prices locally and keeps the draft dirty', async () => {
    const client = { list: vi.fn(async () => [item()]), listMachines: vi.fn(async () => machines), getMachineCatalog: vi.fn(), updatePrices: vi.fn() };
    const container = await mount(client); const input = container.querySelector('.catalog-price input');
    await act(async () => { inputValue(input, 'not-a-price'); });
    await act(async () => { container.querySelector('.catalog-save-bar button').click(); });
    expect(client.updatePrices).not.toHaveBeenCalled();
    expect(input.value).toBe('not-a-price');
    expect(container.querySelectorAll('[data-dirty="true"]')).toHaveLength(1);
    expect(container.querySelector('[role="alert"]').textContent).toContain('неотрицательные числа');
  });

  it('uses a backend machine selector and renders the customer preview from display catalog data', async () => {
    const catalog = { machine: machines[0], currentFlavor: { nameRu: 'Пломбир', basePrice: 150 }, currency: 'RUB', sprinkles: [{ id: 'spr', nameRu: 'Посыпка', basePrice: 20, currency: 'RUB' }], toppings: [] };
    const client = { list: vi.fn(async () => [item()]), listMachines: vi.fn(async () => machines), getMachineCatalog: vi.fn(async () => catalog) };
    const container = await mount(client); const select = container.querySelector('select[aria-label="Аппарат"]');
    await act(async () => { select.value = 'machine-a'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(client.getMachineCatalog).toHaveBeenCalledWith('machine-a', expect.any(Object));
    expect(container.textContent).toContain('Пломбир'); expect(container.textContent).toContain('Тестовый стенд · зона A'); expect(container.textContent).toContain('Pricing Engine / Promotion Engine');
    expect(renderToStaticMarkup(<CustomerPreview catalog={catalog} />)).toContain('150 RUB');
  });

  it('renders the backend fail-closed price error in Russian for the selected current flavor', async () => {
    const error = Object.assign(new Error('У одной из опубликованных позиций отсутствует корректная цена.'), { code: 'CATALOG_PRICE_INVALID' });
    const missingPriceFlavor = item({ basePrice: null, configurationStatus: 'MISSING_PRICE', configurationIssues: ['MISSING_BASE_PRICE'] });
    const client = { list: vi.fn(async () => [missingPriceFlavor]), listMachines: vi.fn(async () => machines), getMachineCatalog: vi.fn(async () => { throw error; }) };
    const container = await mount(client); const select = container.querySelector('select[aria-label="Аппарат"]');
    await act(async () => { select.value = 'machine-a'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    const alert = container.querySelector('.catalog-preview-error[role="alert"]');
    expect(alert.textContent).toContain('Каталог не готов');
    expect(alert.textContent).toContain('Для текущего вкуса не задана цена.');
  });

  it('refreshes the customer preview after switching the machine current flavor', async () => {
    let currentFlavorId = 'ice-a';
    const rows = [item(), item({ id: 'ice-b', sku: 'ice-b', nameRu: 'Шоколадное мороженое', machines: [{ id: 'b-1', machineId: 'machine-a', available: true, isCurrentFlavor: false, machine: { machineCode: 'A-01' } }] })];
    const client = {
      list: vi.fn(async () => rows),
      listMachines: vi.fn(async () => machines),
      getMachineCatalog: vi.fn(async () => ({ machine: machines[0], currentFlavor: rows.find((entry) => entry.id === currentFlavorId), currency: 'RUB', sprinkles: [], toppings: [] })),
      setCurrentFlavor: vi.fn(async (_machineId, catalogItemId) => { currentFlavorId = catalogItemId; }),
    };
    const container = await mount(client); const select = container.querySelector('select[aria-label="Аппарат"]');
    await act(async () => { select.value = 'machine-a'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    const chocolateRow = [...container.querySelectorAll('tbody tr')].find((row) => row.textContent.includes('Шоколадное мороженое'));
    await act(async () => { chocolateRow.querySelector('.catalog-actions button:last-child').click(); });
    expect(client.setCurrentFlavor).toHaveBeenCalledWith('machine-a', 'ice-b');
    expect(client.getMachineCatalog).toHaveBeenCalledTimes(2);
    expect(container.querySelector('.catalog-preview').textContent).toContain('Шоколадное мороженое');
  });
});