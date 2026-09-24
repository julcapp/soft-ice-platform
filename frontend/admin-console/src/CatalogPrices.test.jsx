import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CatalogPricesPage, CatalogRow } from './CatalogPrices';

describe('Каталог и цены', () => {
  it('opens as a dedicated admin section', () => {
    const html = renderToStaticMarkup(<CatalogPricesPage client={{ list: () => new Promise(() => {}) }} />);
    expect(html).toContain('Загрузка панели управления');
  });

  it('shows price, machine availability, current flavor and protected system actions', () => {
    const item = {
      id: 'topping-none', sku: 'topping_none', category: 'TOPPING', nameRu: 'Без топпинга',
      basePrice: 0, currency: 'RUB', active: true, systemItem: true, freeItem: false,
      sortOrder: 0, updatedAt: '2026-09-23T00:00:00.000Z',
      machines: [{ id: 'assignment-1', machineId: 'machine-a', available: true, isCurrentFlavor: false, machine: { machineCode: 'A-01' } }],
    };
    const html = renderToStaticMarkup(<table><tbody><CatalogRow item={item} machine="machine-a" client={{}} busy="" run={vi.fn()} /></tbody></table>);
    expect(html).toContain('Без топпинга');
    expect(html).toContain('A-01 · доступна');
    expect(html).toContain('Системная');
    expect(html).toContain('disabled');
  });
});
