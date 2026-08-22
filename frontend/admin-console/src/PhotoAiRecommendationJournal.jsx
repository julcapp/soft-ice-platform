import React, { useEffect, useState } from 'react';
import { ErrorState, Skeleton, StatusBadge } from './components';
import {
  decidePhotoAiRecommendation,
  evaluatePhotoAiRecommendations,
  getPhotoAiRecommendationHistory,
  markPhotoAiRecommendationViewed,
} from './api/photoVerificationClient';

function status(severity) { return severity === 'high' ? 'CRITICAL' : severity === 'medium' ? 'WARNING' : 'ACTIVE'; }
function decisionLabel(value) { return value === 'accept' ? 'Принято' : value === 'reject' ? 'Отклонено' : value === 'defer' ? 'Отложено' : 'Без решения'; }
function actionLabel(value) { return value === 'appeared' ? 'Появилась' : value === 'disappeared' ? 'Исчезла' : value === 'viewed' ? 'Просмотрена' : value === 'decision' ? 'Решение' : value; }

export function PhotoAiRecommendationJournal({ period = '7d' }) {
  const [state, setState] = useState({ status: 'loading', data: null, history: [] });
  const [comment, setComment] = useState({});
  const [busy, setBusy] = useState(null);

  async function reload(signal) {
    const [data, history] = await Promise.all([
      evaluatePhotoAiRecommendations({ signal, period }),
      getPhotoAiRecommendationHistory({ signal, period, limit: 50 }),
    ]);
    setState({ status: 'ready', data, history });
  }

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, status: 'loading' }));
    reload(controller.signal).catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', data: null, history: [] }); });
    return () => controller.abort();
  }, [period]);

  async function viewed(item) {
    if (item.journal?.viewedAt) return;
    setBusy(item.recommendationKey);
    try { await markPhotoAiRecommendationViewed(item.recommendationKey); await reload(); } finally { setBusy(null); }
  }

  async function decide(item, decision) {
    setBusy(item.recommendationKey);
    try {
      await decidePhotoAiRecommendation(item.recommendationKey, { decision, comment: comment[item.recommendationKey] || '' });
      await reload();
    } finally { setBusy(null); }
  }

  if (state.status === 'loading' && !state.data) return <Skeleton />;
  if (state.status === 'error') return <ErrorState />;
  const recommendations = state.data?.recommendations || [];

  return <section className="card" style={{ marginTop: 16 }} aria-label="Журнал рекомендаций AI">
    <div className="card-heading">
      <div><h2>Журнал рекомендаций AI</h2><p style={{ margin: '6px 0 0' }}>Появление, просмотр и решение администратора. Принятие рекомендации не изменяет настройки автоматически.</p></div>
      <StatusBadge status={recommendations.some((item) => item.severity === 'high' && !item.journal?.decision) ? 'WARNING' : 'ACTIVE'} />
    </div>

    <div style={{ display: 'grid', gap: 12 }}>
      {recommendations.map((item) => <article className="card" key={item.recommendationKey} onMouseEnter={() => viewed(item)}>
        <div className="card-heading"><strong>{item.title}</strong><StatusBadge status={status(item.severity)} /></div>
        <p>{item.description}</p>
        <p><strong>Рекомендуемое действие:</strong> {item.suggestedAction}</p>
        <p><strong>Статус:</strong> {decisionLabel(item.journal?.decision)}{item.journal?.viewedAt ? ' · просмотрена' : ' · новая'}</p>
        {item.journal?.decidedAt && <small>Решение: {new Date(item.journal.decidedAt).toLocaleString('ru-RU')} · {item.journal.decidedBy || 'admin'}</small>}
        <textarea
          value={comment[item.recommendationKey] || ''}
          onChange={(event) => setComment((current) => ({ ...current, [item.recommendationKey]: event.target.value }))}
          placeholder="Комментарий к решению (необязательно)"
          rows={2}
          style={{ width: '100%', marginTop: 10 }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <button type="button" disabled={busy === item.recommendationKey} onClick={() => decide(item, 'accept')}>Принять</button>
          <button type="button" disabled={busy === item.recommendationKey} onClick={() => decide(item, 'defer')}>Отложить</button>
          <button type="button" disabled={busy === item.recommendationKey} onClick={() => decide(item, 'reject')}>Отклонить</button>
        </div>
        <small style={{ display: 'block', marginTop: 8 }}>Любое решение остаётся advisory: settingsApplied=false.</small>
      </article>)}
      {!recommendations.length && <p>Активных рекомендаций за выбранный период нет.</p>}
    </div>

    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-heading"><strong>История</strong><StatusBadge status="READ_ONLY" /></div>
      {!state.history.length && <p>Событий журнала пока нет.</p>}
      {!!state.history.length && <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th align="left">Время</th><th align="left">Рекомендация</th><th align="left">Событие</th><th align="left">Решение</th><th align="left">Администратор</th></tr></thead>
        <tbody>{state.history.map((row) => <tr key={row.id}>
          <td>{new Date(row.occurredAt).toLocaleString('ru-RU')}</td>
          <td>{row.recommendationKey}</td><td>{actionLabel(row.action)}</td><td>{row.decision || '—'}</td><td>{row.actorId || '—'}</td>
        </tr>)}</tbody>
      </table></div>}
    </div>
  </section>;
}
