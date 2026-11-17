import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Dashboard } from './App';
import { EmptyState, ErrorState, PermissionGate, Skeleton, StatisticCard } from './components';

const data = {
  freshness: { status: 'DEMO', message: 'Demo data', isDemo: true },
  permissionScope: { access: 'READ_ONLY' },
  summary: { revenueToday: { value: 100, currency: 'RUB' }, salesToday: 1, machinesOnline: 1, machinesTotal: 2, machinesRequiringAttention: 1, criticalAlerts: 1, lowCupStock: 1, lowIngredientStock: 1 },
  machineStatus: { distribution: [{ status: 'ONLINE', count: 1 }] },
  inventoryAlerts: [], operatorSummary: { active: 1, pendingServiceApprovals: 1 },
  maintenanceSummary: [], paymentSummary: { recent: [], salesTrend: [1], revenueTrend: [100] },
  recentEvents: [{ id: 'event-1', type: 'Alert', description: 'Attention', severity: 'CRITICAL', occurredAt: '2026-07-23T00:00:00Z' }],
};

describe('Admin Console dashboard components', () => {
  it('renders all key dashboard widget labels and demo freshness', () => {
    const html = renderToStaticMarkup(<Dashboard data={data} />);
    for (const label of ['Выручка за сегодня', 'Продажи за сегодня', 'Автоматы в сети / всего', 'Критические предупреждения', 'Активные операторы', 'Ожидают согласования', 'Динамика продаж', 'Динамика выручки', 'Состояние автоматов', 'Последние работы по обслуживанию', 'Последние платежи', 'Последние события платформы', 'Демонстрационные данные']) expect(html).toContain(label);
  });
  it('renders loading, empty, unavailable, stale and denied primitives', () => {
    expect(renderToStaticMarkup(<Skeleton />)).toContain('Загрузка панели управления');
    expect(renderToStaticMarkup(<EmptyState />)).toContain('За выбранный период данных нет');
    expect(renderToStaticMarkup(<ErrorState />)).toContain('Панель управления недоступна');
    expect(renderToStaticMarkup(<PermissionGate allowed={false} />)).toContain('Доступ запрещён');
    expect(renderToStaticMarkup(<StatisticCard label="Устаревший показатель" value="—" />)).toContain('Устаревший показатель');
  });
});
