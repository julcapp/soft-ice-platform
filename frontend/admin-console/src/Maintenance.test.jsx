import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MaintenanceProjection } from './Maintenance';

describe('Maintenance Runtime projection', () => {
  it('renders KPIs and the multi-machine approval queue', () => {
    const html = renderToStaticMarkup(<MaintenanceProjection data={{ dataMode: 'IN_MEMORY_FOUNDATION', kpis: { openSessions: 2, pendingApprovals: 1, approvalRate: .5, firstTimePassRate: .75, meanTimeToApproveMinutes: 18 }, sessions: [{ sessionId: 's1', machineCode: 'SI-TOM-001', type: 'PREVENTIVE', operatorId: 'op1', status: 'SUBMITTED', lastEventType: 'Maintenance.SessionSubmitted' }] }} />);
    for (const label of ['Открытые сеансы обслуживания', 'Ожидают согласования', 'Доля согласованных работ', 'Успех теста с первой попытки', 'Среднее время согласования', 'Очередь обслуживания автоматов', 'SI-TOM-001']) expect(html).toContain(label);
  });
});
