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
      reservationMetrics: { active: 1, expired: 0, released: 0, consumed: 0, failed: 0, insufficientStock: 0 },
      movements: [{ id: 'movement_1', itemId: 'ingredient_mix', locationId: 'warehouse_main', movementType: 'RECEIPT', delta: 10, reason: 'delivery', occurredAt: '2026-07-23T10:00:00Z' }],
    }} />);
    expect(html).toContain('Текущие остатки');
    expect(html).toContain('Журнал движений');
    expect(html).toContain('Резервы');
    expect(html).toContain('Недостаточный остаток');
    expect(html).toContain('Vanilla mix');
    expect(html).not.toContain('<button');
  });
});
