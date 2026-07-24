import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MachineTwinDetail, MachineTwinsList } from './MachineTwins';
import { ComponentList, FreshnessIndicator, MachineTwinDiagram, SnapshotHistory, SourceStatusPanel } from './machineTwinComponents';
import { ErrorState, Skeleton } from './components';

const twin = {
  machineId: 'machine_demo_001', externalMachineId: 'SIM-001', name: 'Demo Machine',
  model: 'Simulator v1', serialNumber: 'DEMO-1', location: 'Tomsk', operationalStatus: 'ONLINE',
  connectivityStatus: 'ONLINE', lastHeartbeatAt: '2026-07-23T12:00:00Z',
  freshness: { status: 'DEMO', explanation: 'Visible simulator data.' },
  currentMenu: { name: 'Soft ice cream' }, activePrice: { amount: 130, currency: 'RUB' },
  activeAdvertisingPlacement: null, assignedOperator: { name: 'Operator' }, openServiceTasks: [],
  activeFaults: [], recentSalesSummary: { count24h: 10 }, inventorySummary: { items: [] },
  recentTestRuns: [{ status: 'PASSED' }], predictionSummary: { status: 'FOUNDATION_ONLY', explanation: 'Unavailable', modelVersion: 'deterministic-v1' },
  sourceStatus: { telemetry: { label: 'Machine Simulator', status: 'DEMO' } },
  components: [{ componentId: 'c1', componentType: 'CONTROLLER', displayName: 'Controller', healthScore: 100, status: 'HEALTHY' }],
  dataMode: 'DEMO', generatedAt: '2026-07-23T12:00:00Z',
};

describe('Admin Console Machine Digital Twin', () => {
  it('renders list and complete detail read model with visible demo marker', () => {
    expect(renderToStaticMarkup(<MachineTwinsList data={[twin]} />)).toContain('Открыть цифровой двойник');
    const html = renderToStaticMarkup(<MachineTwinDetail twin={twin} />);
    for (const label of ['Симулятор автомата', 'Операционная сводка', 'Идентификация автомата', 'Доступность источников', 'Схема автомата', 'Прогноз состояния', 'Проекции только для чтения']) expect(html).toContain(label);
    expect(html).not.toContain('<form');
  });
  it('renders components, events/snapshots, stale, empty, unavailable and denied states', () => {
    expect(renderToStaticMarkup(<ComponentList components={twin.components} />)).toContain('Controller');
    expect(renderToStaticMarkup(<MachineTwinDiagram components={twin.components} />)).toContain('Независимая от производителя');
    expect(renderToStaticMarkup(<SnapshotHistory snapshots={[]} />)).toContain('Снимки не загружены');
    expect(renderToStaticMarkup(<FreshnessIndicator freshness={{ status: 'STALE', explanation: 'Устаревшая телеметрия' }} />)).toContain('Устарело');
    expect(renderToStaticMarkup(<SourceStatusPanel sources={{ payments: { status: 'UNAVAILABLE' } }} />)).toContain('Недоступно');
    expect(renderToStaticMarkup(<MachineTwinsList data={[]} />)).toContain('Цифровых двойников нет');
    expect(renderToStaticMarkup(<Skeleton />)).toContain('Загрузка панели управления');
    expect(renderToStaticMarkup(<ErrorState />)).toContain('Панель управления недоступна');
    expect(renderToStaticMarkup(<ErrorState kind="denied" />)).toContain('Доступ запрещён');
  });
});
