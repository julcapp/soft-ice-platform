import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InventoryProjection } from './Inventory';

describe('Inventory read-only projection', () => {
  it('renders balances and immutable movement journal', () => {
    const html = renderToStaticMarkup(<InventoryProjection data={{
      items: [{ id: 'ingredient_mix', name: 'Vanilla mix' }],
      locations: [{ id: 'warehouse_main', name: 'Main warehouse' }],
      balances: [{ itemId: 'ingredient_mix', locationId: 'warehouse_main', onHand: 10, reserved: 2, available: 8 }],
      reservations: [{ id: 'reservation_1', status: 'ACTIVE' }],
      movements: [{ id: 'movement_1', itemId: 'ingredient_mix', locationId: 'warehouse_main', movementType: 'RECEIPT', delta: 10, reason: 'delivery', occurredAt: '2026-07-23T10:00:00Z' }],
    }} />);
    expect(html).toContain('Текущие остатки');
    expect(html).toContain('Журнал движений');
    expect(html).toContain('Vanilla mix');
    expect(html).not.toContain('<button');
  });
});
