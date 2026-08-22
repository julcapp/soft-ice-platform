import React, { useEffect, useState } from 'react';
import { ErrorState, Skeleton, StatisticCard, StatusBadge } from './components';
import { getPhotoVerificationMetrics } from './api/photoVerificationClient';

function duration(seconds) {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds} сек`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} мин`;
  return `${Math.round((seconds / 3600) * 10) / 10} ч`;
}

export function PhotoVerificationMetricsPage({ loadMetrics = getPhotoVerificationMetrics }) {
  const [state, setState] = useState({ status: 'loading', data: null });

  useEffect(() => {
    const controller = new AbortController();
    loadMetrics({ signal: controller.signal })
      .then((data) => setState({ status: 'ready', data }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ status: 'error', data: null });
      });
    return () => controller.abort();
  }, [loadMetrics]);

  if (state.status === 'loading') return <Skeleton />;
  if (state.status === 'error') return <ErrorState />;

  const { totals, decisions, channels } = state.data;
  return <section className="card" aria-label="Метрики проверки фотографий">
    <div className="card-heading">
      <div><h2>Операционные метрики</h2><p style={{ margin: '6px 0 0' }}>Текущая нагрузка модерации, публикации и наград.</p></div>
      <StatusBadge status={(totals.publicationIncomplete + totals.rewardPending) > 0 ? 'PENDING' : 'ACTIVE'} />
    </div>

    <div className="statistics">
      <StatisticCard label="Фото загружено" value={totals.submitted} />
      <StatisticCard label="На ручной проверке" value={totals.manualReview} tone={totals.manualReview ? 'warning' : 'success'} />
      <StatisticCard label="Сбой публикации" value={totals.publicationIncomplete} tone={totals.publicationIncomplete ? 'critical' : 'success'} />
      <StatisticCard label="Ожидают награду" value={totals.rewardPending} tone={totals.rewardPending ? 'warning' : 'success'} />
      <StatisticCard label="Среднее время модерации" value={duration(decisions.averageModerationSeconds)} />
      <StatisticCard label="Auto approve" value={`${decisions.autoApprovePercent}%`} detail={`${decisions.autoApproved} фото`} />
      <StatisticCard label="Auto reject" value={`${decisions.autoRejectPercent}%`} detail={`${decisions.autoRejected} фото`} />
      <StatisticCard label="Ручная проверка" value={`${decisions.manualPercent}%`} detail={`${decisions.manualReview} решений`} />
    </div>

    <div className="tables" style={{ marginTop: 16 }}>
      {channels.map((channel) => <div className="card" key={channel.channel}>
        <div className="card-heading"><strong>{channel.channel}</strong><StatusBadge status={channel.failed ? 'WARNING' : 'ACTIVE'} /></div>
        <p>Опубликовано: <strong>{channel.published}</strong> / {channel.total}</p>
        <p>Ошибки: <strong>{channel.failed}</strong> · Ожидает: <strong>{channel.pending}</strong> · Не настроено: <strong>{channel.notConfigured}</strong></p>
      </div>)}
    </div>
  </section>;
}
