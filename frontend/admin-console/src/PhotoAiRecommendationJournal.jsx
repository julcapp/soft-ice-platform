import React, { useEffect, useState } from 'react';
import { ErrorState, Skeleton, StatusBadge } from './components';
import {
  applyPhotoAiRecommendationChange,
  applyPhotoAiRecommendationRollback,
  decidePhotoAiRecommendation,
  evaluatePhotoAiRecommendations,
  getPhotoAiRecommendationApplicationHistory,
  getPhotoAiRecommendationHistory,
  markPhotoAiRecommendationViewed,
  preparePhotoAiRecommendationChange,
  preparePhotoAiRecommendationRollback,
} from './api/photoVerificationClient';

function status(severity) { return severity === 'high' ? 'CRITICAL' : severity === 'medium' ? 'WARNING' : 'ACTIVE'; }
function decisionLabel(value) { return value === 'accept' ? 'Принято' : value === 'reject' ? 'Отклонено' : value === 'defer' ? 'Отложено' : 'Без решения'; }
function actionLabel(value) { return value === 'appeared' ? 'Появилась' : value === 'disappeared' ? 'Исчезла' : value === 'viewed' ? 'Просмотрена' : value === 'decision' ? 'Решение' : value; }
function rollbackLabel(item) { return item.rolledBack ? 'Откат выполнен' : item.rollbackAvailable ? 'Доступен откат' : 'Откат заблокирован'; }

export function PhotoAiRecommendationJournal({ period = '7d' }) {
  const [state, setState] = useState({ status: 'loading', data: null, history: [], applications: [] });
  const [comment, setComment] = useState({});
  const [busy, setBusy] = useState(null);
  const [prepared, setPrepared] = useState({});
  const [rollback, setRollback] = useState({});
  const [notice, setNotice] = useState('');

  async function reload(signal) {
    const [data, history, applications] = await Promise.all([
      evaluatePhotoAiRecommendations({ signal, period }),
      getPhotoAiRecommendationHistory({ signal, period, limit: 50 }),
      getPhotoAiRecommendationApplicationHistory({ signal, limit: 100 }),
    ]);
    setState({ status: 'ready', data, history, applications });
  }

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, status: 'loading' }));
    setPrepared({}); setRollback({});
    reload(controller.signal).catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', data: null, history: [], applications: [] }); });
    return () => controller.abort();
  }, [period]);

  async function viewed(item) {
    if (item.journal?.viewedAt) return;
    setBusy(item.recommendationKey);
    try { await markPhotoAiRecommendationViewed(item.recommendationKey); await reload(); } finally { setBusy(null); }
  }

  async function decide(item, decision) {
    setBusy(item.recommendationKey); setNotice('');
    try {
      await decidePhotoAiRecommendation(item.recommendationKey, { decision, comment: comment[item.recommendationKey] || '' });
      setPrepared((current) => { const next = { ...current }; delete next[item.recommendationKey]; return next; });
      await reload();
    } finally { setBusy(null); }
  }

  async function prepare(item) {
    setBusy(item.recommendationKey); setNotice('');
    try {
      const result = await preparePhotoAiRecommendationChange(item.recommendationKey);
      setPrepared((current) => ({ ...current, [item.recommendationKey]: result }));
    } catch (error) {
      setNotice(error.code === 'PHOTO_AI_RECOMMENDATION_NO_SAFE_PATCH' ? 'Для этой рекомендации нет безопасного автоматизированного diff. Изменение нужно выполнить вручную после анализа.' : 'Не удалось подготовить изменение.');
    } finally { setBusy(null); }
  }

  async function apply(item) {
    const plan = prepared[item.recommendationKey]; if (!plan) return;
    setBusy(item.recommendationKey); setNotice('');
    try {
      await applyPhotoAiRecommendationChange(plan.preparationId);
      setPrepared((current) => { const next = { ...current }; delete next[item.recommendationKey]; return next; });
      setNotice('Изменение применено. Оно сохранено в постоянной истории и будет доступно после перезагрузки страницы.');
      await reload();
    } catch (error) { setNotice(error.code === 'PHOTO_AI_RECOMMENDATION_SETTINGS_CHANGED' ? 'Настройки изменились после подготовки diff. Подготовьте изменение заново.' : 'Не удалось применить изменение.'); }
    finally { setBusy(null); }
  }

  async function prepareRollback(application) {
    setBusy(application.preparationId); setNotice('');
    try {
      const result = await preparePhotoAiRecommendationRollback(application.preparationId);
      setRollback((current) => ({ ...current, [application.preparationId]: result }));
    } catch (error) { setNotice(error.code === 'PHOTO_AI_RECOMMENDATION_ROLLBACK_SETTINGS_CHANGED' ? 'Настройки после применения уже изменились. Автоматический откат заблокирован.' : 'Не удалось подготовить откат.'); }
    finally { setBusy(null); }
  }

  async function applyRollback(application) {
    const plan = rollback[application.preparationId]; if (!plan) return;
    setBusy(application.preparationId); setNotice('');
    try {
      await applyPhotoAiRecommendationRollback(plan.rollbackId);
      setRollback((current) => { const next = { ...current }; delete next[application.preparationId]; return next; });
      setNotice('Предыдущее значение восстановлено. История применения и отката сохранена.');
      await reload();
    } catch (error) { setNotice(error.code === 'PHOTO_AI_RECOMMENDATION_ROLLBACK_SETTINGS_CHANGED' ? 'Текущие настройки изменились после подготовки rollback. Подготовьте откат заново.' : 'Не удалось выполнить откат.'); }
    finally { setBusy(null); }
  }

  if (state.status === 'loading' && !state.data) return <Skeleton />;
  if (state.status === 'error') return <ErrorState />;
  const recommendations = state.data?.recommendations || [];

  return <section className="card" style={{ marginTop: 16 }} aria-label="Журнал рекомендаций AI">
    <div className="card-heading"><div><h2>Журнал рекомендаций AI</h2><p style={{ margin: '6px 0 0' }}>Применения и откаты сохраняются между сессиями админ-панели.</p></div><StatusBadge status={recommendations.some((item) => item.severity === 'high' && !item.journal?.decision) ? 'WARNING' : 'ACTIVE'} /></div>
    {notice && <p role="status"><strong>{notice}</strong></p>}

    <div style={{ display: 'grid', gap: 12 }}>
      {recommendations.map((item) => { const plan = prepared[item.recommendationKey]; return <article className="card" key={item.recommendationKey} onMouseEnter={() => viewed(item)}>
        <div className="card-heading"><strong>{item.title}</strong><StatusBadge status={status(item.severity)} /></div>
        <p>{item.description}</p><p><strong>Рекомендуемое действие:</strong> {item.suggestedAction}</p><p><strong>Статус:</strong> {decisionLabel(item.journal?.decision)}{item.journal?.viewedAt ? ' · просмотрена' : ' · новая'}</p>
        <textarea value={comment[item.recommendationKey] || ''} onChange={(event) => setComment((current) => ({ ...current, [item.recommendationKey]: event.target.value }))} placeholder="Комментарий к решению (необязательно)" rows={2} style={{ width: '100%', marginTop: 10 }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}><button type="button" disabled={busy === item.recommendationKey} onClick={() => decide(item, 'accept')}>Принять</button><button type="button" disabled={busy === item.recommendationKey} onClick={() => decide(item, 'defer')}>Отложить</button><button type="button" disabled={busy === item.recommendationKey} onClick={() => decide(item, 'reject')}>Отклонить</button>{item.journal?.decision === 'accept' && !plan && <button type="button" disabled={busy === item.recommendationKey} onClick={() => prepare(item)}>Подготовить изменение</button>}</div>
        {plan && <DiffCard title="Изменение подготовлено — ещё не применено" plan={plan} buttonLabel="Применить это изменение" disabled={busy === item.recommendationKey} onConfirm={() => apply(item)} />}
      </article>; })}
      {!recommendations.length && <p>Активных рекомендаций за выбранный период нет.</p>}
    </div>

    <div className="card" style={{ marginTop: 16 }} aria-label="История применений и откатов"><div className="card-heading"><div><strong>История применений и откатов</strong><p style={{ margin: '6px 0 0' }}>Постоянный журнал. Доступен после перезагрузки и для другого администратора.</p></div><StatusBadge status="READ_ONLY" /></div>
      {!state.applications.length && <p>Применённых AI-рекомендаций пока нет.</p>}
      <div style={{ display: 'grid', gap: 10 }}>{state.applications.map((application) => { const rollbackPlan = rollback[application.preparationId]; return <article className="card" key={application.preparationId}>
        <div className="card-heading"><strong>{application.recommendationKey}</strong><StatusBadge status={application.rolledBack ? 'INACTIVE' : application.rollbackAvailable ? 'ACTIVE' : 'WARNING'} /></div>
        <p>Применено: <strong>{new Date(application.appliedAt).toLocaleString('ru-RU')}</strong> · {application.actorId || 'admin'}</p>
        <p><strong>{rollbackLabel(application)}</strong>{application.rollbackBlockedReason === 'settings_changed_after_application' ? ' — текущие настройки уже отличаются от применённого состояния.' : ''}</p>
        <table style={{ width: '100%' }}><thead><tr><th align="left">Поле</th><th align="left">До</th><th align="left">После применения</th><th align="left">Сейчас</th></tr></thead><tbody>{Object.keys(application.patch || {}).map((key) => <tr key={key}><td>{key}</td><td>{String(application.before?.[key])}</td><td>{String(application.after?.[key])}</td><td>{String(application.current?.[key])}</td></tr>)}</tbody></table>
        {application.rollbackAvailable && !rollbackPlan && <button type="button" style={{ marginTop: 10 }} disabled={busy === application.preparationId} onClick={() => prepareRollback(application)}>Подготовить откат</button>}
        {rollbackPlan && <DiffCard title="Откат подготовлен — ещё не выполнен" plan={rollbackPlan} buttonLabel="Вернуть предыдущую настройку" disabled={busy === application.preparationId} onConfirm={() => applyRollback(application)} />}
        {application.rolledBackAt && <small>Откат выполнен {new Date(application.rolledBackAt).toLocaleString('ru-RU')} · {application.rolledBackBy || 'admin'}</small>}
      </article>; })}</div>
    </div>

    <div className="card" style={{ marginTop: 16 }}><div className="card-heading"><strong>История рекомендаций</strong><StatusBadge status="READ_ONLY" /></div>{!state.history.length && <p>Событий журнала пока нет.</p>}{!!state.history.length && <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th align="left">Время</th><th align="left">Рекомендация</th><th align="left">Событие</th><th align="left">Решение</th><th align="left">Администратор</th></tr></thead><tbody>{state.history.map((row) => <tr key={row.id}><td>{new Date(row.occurredAt).toLocaleString('ru-RU')}</td><td>{row.recommendationKey}</td><td>{actionLabel(row.action)}</td><td>{row.decision || '—'}</td><td>{row.actorId || '—'}</td></tr>)}</tbody></table></div>}</div>
  </section>;
}

function DiffCard({ title, plan, buttonLabel, disabled, onConfirm }) {
  return <div className="card" style={{ marginTop: 12 }}><strong>{title}</strong><table style={{ width: '100%', marginTop: 8 }}><thead><tr><th align="left">Поле</th><th align="left">До</th><th align="left">После</th></tr></thead><tbody>{Object.keys(plan.patch || {}).map((key) => <tr key={key}><td>{key}</td><td>{String(plan.before?.[key])}</td><td>{String(plan.after?.[key])}</td></tr>)}</tbody></table><p><small>Перед подтверждением backend повторно проверит, что текущие настройки совпадают с показанным состоянием «До».</small></p><button type="button" disabled={disabled} onClick={onConfirm}>{buttonLabel}</button></div>;
}
