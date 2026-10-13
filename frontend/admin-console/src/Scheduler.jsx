import React, { useEffect, useState } from 'react';
import { DataTable, ErrorState, Skeleton, StatisticCard, StatusBadge } from './components';
import { getScheduler } from './api/schedulerClient';

const sourceLabel = {
  NODE_INTERVAL: 'Backend interval',
  SYSTEMD_TIMER: 'systemd timer',
};

export function SchedulerPage({ client = getScheduler }) {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    client({ signal: controller.signal })
      .then((data) => setState({ status: 'ready', data }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ status: 'unavailable' });
      });
    return () => controller.abort();
  }, [client]);

  if (state.status === 'loading') return <Skeleton />;
  if (state.status === 'unavailable') return <ErrorState />;

  const jobs = state.data?.jobs || [];
  const active = jobs.filter((job) => job.status === 'ACTIVE').length;
  const notConfigured = jobs.filter((job) => job.status === 'NOT_CONFIGURED').length;
  const systemd = jobs.filter((job) => job.source === 'SYSTEMD_TIMER').length;

  return <div className="scheduler-workspace">
    <section className="statistics">
      <StatisticCard label="Регулярных процессов" value={jobs.length} />
      <StatisticCard label="Активно" value={active} tone="success" />
      <StatisticCard label="systemd timer" value={systemd} />
      <StatisticCard label="Требуют настройки" value={notConfigured} tone={notConfigured ? 'warning' : 'success'} />
    </section>

    {notConfigured > 0 && <section className="card scheduler-warning">
      <div>
        <strong>Есть незавершённая настройка расписания</strong>
        <p>Внешние задания не считаются работающими, пока их наличие и состояние не подтверждены на сервере.</p>
      </div>
      <StatusBadge status="WARNING" />
    </section>}

    <DataTable
      title="Реестр регулярных операций"
      rows={jobs}
      columns={[
        { key: 'name', label: 'Операция' },
        { key: 'scope', label: 'Раздел' },
        { key: 'cadence', label: 'Периодичность' },
        { key: 'source', label: 'Механизм', render: (value) => sourceLabel[value] || value },
        { key: 'status', label: 'Статус', render: (value) => <StatusBadge status={value} /> },
      ]}
    />

    <section className="card scheduler-note">
      <h2>Назначение раздела</h2>
      <p>Scheduler — реестр того, что система должна выполнять регулярно. Фактически произошедшие события и ошибки продолжают фиксироваться отдельно в «Центре событий».</p>
      <small>Backend запущен: {state.data?.processStartedAt ? new Date(state.data.processStartedAt).toLocaleString('ru-RU') : '—'}</small>
    </section>
  </div>;
}
