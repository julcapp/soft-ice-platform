import React, { useEffect, useState } from 'react';
import { DataTable, ErrorState, Skeleton, StatisticCard, StatusBadge } from './components';
import { getMaintenanceProjection } from './api/maintenanceClient';

export function MaintenancePage({ client = getMaintenanceProjection }) {
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => { const controller = new AbortController(); client({ signal: controller.signal }).then((data) => setState({ status: 'ready', data })).catch((error) => error.name !== 'AbortError' && setState({ status: 'error' })); return () => controller.abort(); }, [client]);
  if (state.status === 'loading') return <Skeleton />;
  if (state.status === 'error') return <ErrorState />;
  return <MaintenanceProjection data={state.data} />;
}

export function MaintenanceProjection({ data }) {
  const kpi = data.kpis;
  return <div className="maintenance-page">
    {data.dataMode !== 'LIVE' && <p className="demo-marker">Базовая проекция · события обрабатываются адаптером в памяти</p>}
    <section className="statistics" aria-label="Показатели технического обслуживания">
      <StatisticCard label="Открытые сеансы обслуживания" value={kpi.openSessions} tone={kpi.openSessions ? 'warning' : 'success'} />
      <StatisticCard label="Ожидают согласования" value={kpi.pendingApprovals} tone={kpi.pendingApprovals ? 'warning' : 'success'} />
      <StatisticCard label="Доля согласованных работ" value={`${Math.round(kpi.approvalRate * 100)}%`} />
      <StatisticCard label="Успех теста с первой попытки" value={`${Math.round(kpi.firstTimePassRate * 100)}%`} />
      <StatisticCard label="Среднее время согласования" value={kpi.meanTimeToApproveMinutes == null ? '—' : `${kpi.meanTimeToApproveMinutes} мин`} />
    </section>
    <DataTable title="Очередь обслуживания автоматов" rows={data.sessions.map((session) => ({ id: session.sessionId, ...session }))} columns={[
      { key: 'machineCode', label: 'Автомат' }, { key: 'type', label: 'Процесс' },
      { key: 'operatorId', label: 'Оператор' }, { key: 'status', label: 'Статус', render: (value) => <StatusBadge status={value} /> },
      { key: 'lastEventType', label: 'Последний неизменяемый факт' },
    ]} />
  </div>;
}
