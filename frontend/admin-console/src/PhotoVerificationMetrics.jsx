import React, { useEffect, useMemo, useState } from 'react';
import { ErrorState, Skeleton, StatisticCard, StatusBadge } from './components';
import { getPhotoVerificationMetrics } from './api/photoVerificationClient';

const PERIODS = [['today', 'Сегодня'], ['7d', '7 дней'], ['30d', '30 дней']];
function duration(seconds) { if (seconds == null) return '—'; if (seconds < 60) return `${seconds} сек`; if (seconds < 3600) return `${Math.round(seconds / 60)} мин`; return `${Math.round((seconds / 3600) * 10) / 10} ч`; }

export function PhotoVerificationMetricsPage({ loadMetrics = getPhotoVerificationMetrics }) {
  const [period, setPeriod] = useState('7d');
  const [state, setState] = useState({ status: 'loading', data: null });
  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ status: 'loading', data: current.data }));
    loadMetrics({ signal: controller.signal, period }).then((data) => setState({ status: 'ready', data })).catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', data: null }); });
    return () => controller.abort();
  }, [loadMetrics, period]);
  const rangeLabel = useMemo(() => state.data?.period ? `${new Date(state.data.period.startAt).toLocaleDateString('ru-RU')} — ${new Date(state.data.period.endAt).toLocaleDateString('ru-RU')}` : '', [state.data]);
  if (state.status === 'loading' && !state.data) return <Skeleton />;
  if (state.status === 'error') return <ErrorState />;

  const { totals, decisions, quality = {}, channels, trend = [] } = state.data;
  return <section className="card" aria-label="Метрики проверки фотографий">
    <div className="card-heading"><div><h2>Операционные метрики</h2><p style={{ margin: '6px 0 0' }}>Нагрузка, качество модерации и надёжность публикаций. {rangeLabel}</p></div><StatusBadge status={(totals.publicationIncomplete + totals.rewardPending) > 0 ? 'PENDING' : 'ACTIVE'} /></div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }} aria-label="Период метрик">{PERIODS.map(([value, label]) => <button key={value} type="button" className="text-button" aria-pressed={period === value} disabled={state.status === 'loading'} onClick={() => setPeriod(value)}>{label}</button>)}</div>

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

    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-heading"><div><strong>Контроль качества AI</strong><p style={{ margin: '6px 0 0' }}>Сравнение AI-вердикта с последующим решением модератора.</p></div><StatusBadge status={quality.disagreements ? 'WARNING' : 'ACTIVE'} /></div>
      <div className="statistics">
        <StatisticCard label="Проверено человеком" value={quality.reviewedByHuman || 0} />
        <StatisticCard label="Совпадение AI / человек" value={`${quality.agreementPercent || 0}%`} detail={`${quality.agreements || 0} совпадений`} />
        <StatisticCard label="Расхождение" value={`${quality.disagreementPercent || 0}%`} detail={`${quality.disagreements || 0} случаев`} tone={quality.disagreements ? 'warning' : 'success'} />
        <StatisticCard label="AI approve → человек reject" value={quality.aiApproveHumanReject || 0} tone={quality.aiApproveHumanReject ? 'critical' : 'success'} />
        <StatisticCard label="AI reject → человек approve" value={quality.aiRejectHumanApprove || 0} tone={quality.aiRejectHumanApprove ? 'warning' : 'success'} />
        <StatisticCard label="AI сам отправил на ручную" value={quality.aiEscalated || 0} />
      </div>
      {!!quality.escalationReasons?.length && <div style={{ marginTop: 12 }}><strong>Частые причины ручной проверки</strong><ol>{quality.escalationReasons.map((item) => <li key={item.reasonCode}>{item.reasonCode}: <strong>{item.count}</strong></li>)}</ol></div>}
    </div>

    <div className="tables" style={{ marginTop: 16 }}>{channels.map((channel) => <div className="card" key={channel.channel}><div className="card-heading"><strong>{channel.channel}</strong><StatusBadge status={channel.failed ? 'WARNING' : 'ACTIVE'} /></div><p>Опубликовано: <strong>{channel.published}</strong> / {channel.total} · Успех: <strong>{channel.successPercent}%</strong></p><p>Ошибки: <strong>{channel.failed}</strong> · Ожидает: <strong>{channel.pending}</strong> · Не настроено: <strong>{channel.notConfigured}</strong></p></div>)}</div>

    <div className="card" style={{ marginTop: 16 }}><div className="card-heading"><strong>Динамика решений по дням</strong><StatusBadge status="ACTIVE" /></div>{!trend.length && <p>За выбранный период решений пока нет.</p>}{!!trend.length && <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th align="left">Дата</th><th>Auto approve</th><th>Auto reject</th><th>Ручная</th></tr></thead><tbody>{trend.map((row) => <tr key={row.day}><td>{new Date(row.day).toLocaleDateString('ru-RU')}</td><td align="center">{row.autoApproved}</td><td align="center">{row.autoRejected}</td><td align="center">{row.manual}</td></tr>)}</tbody></table></div>}</div>
  </section>;
}
